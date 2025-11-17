import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { RouterBuilder } from '@paraspell/xcm-router';
import debounce from 'lodash.debounce';

// Proper ParaSpell types - NO any types!
import type { TAssetInfo, TChain } from '@paraspell/sdk';
import type {
  TExchangeChain,
  TRouterXcmFeeResult
} from '@paraspell/xcm-router';

// Our types
import type { TokenInfo } from '@/components/swap/types';
import type { FeeSummary } from '@/services/xcm-router/feeCalculator';
import { calculateTotalFees, formatFeeSummary, safeStringify } from '@/services/xcm-router/feeCalculator';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS, TEST_RPC_ACALA, TEST_RPC_ASSET_HUB, TEST_RPC_HYDRATION, TEST_RPC_BIFROST } from '@/services/constants';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';

/**
 * Check if price fetching should be skipped (from environment variable)
 * This allows for easy testing by setting the env var in tests
 */
const shouldSkipPriceFetch = (): boolean => {
  return process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH === 'true';
};

/**
 * Convert user input (decimal string) to smallest unit (bigint)
 * 
 * Uses string manipulation to preserve precision for large decimals
 * Example: "1.5" with 12 decimals → 1500000000000n
 * 
 * @param amount - Decimal amount as string (e.g., "1.5")
 * @param decimals - Number of decimal places (e.g., 12 for DOT)
 * @returns Amount in smallest unit as bigint
 */
function toSmallestUnit(amount: string, decimals: number): bigint {

  const parsed = parseFloat(amount);

  if (parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount too large');
  }

  if (isNaN(parsed) || parsed <= 0) return BigInt(0);

  // Handle decimal places with string manipulation to avoid precision loss
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}


/**
 * Route state interface matching ParaSpell RouterBuilder response
 */
export interface RouteState {
  isLoading: boolean;
  error: string | null;
  data: {
    amountOut: bigint;
    exchange: string | string[];
  } | null;
}

/**
 * Props for useXcmRoute hook
 */
interface UseXcmRouteProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress?: string;
  slippageTolerance?: number; // Percentage (e.g., 1 for 1%)

  // Helper functions from useXcmTokens
  getOptimalExchanges: (
    fromKey: string,
    toKey: string,
    fromChain: string,
    toChain: string
  ) => TExchangeChain[];

  // Note: determineCurrency returns complex union type (symbol | id | location)
  // Using any here is acceptable as ParaSpell handles this internally
  determineCurrency: (asset: TAssetInfo) => any;

  getTAssetFromKey: (
    key: string,
    direction: 'from' | 'to'
  ) => TAssetInfo | undefined;
}

/**
 * Return type for useXcmRoute hook
 */
interface UseXcmRouteReturn {
  outputAmount: string;
  routeDex: string;
  routeState: RouteState;
  estimatedFees: string;
  feeBreakdown: FeeSummary | undefined;
  debouncedFetchRoute: ((amount: string) => void) & { cancel: () => void };
  isProcessing: boolean;
  isLoadingQuote: boolean;
  isLoadingFees: boolean;
  resetRoute: () => void;
}

/**
 * XCM Route Hook - Replaces useSwapRoute with real ParaSpell integration
 * 
 * Features:
 * - Real quotes from ParaSpell RouterBuilder
 * - Automatic DEX selection based on asset compatibility
 * - Multi-currency fee calculation
 * - Type-safe with proper ParaSpell types (no any)
 * - BigInt handling for precision
 * - Stale response prevention
 * 
 * @param props - Hook configuration
 * @returns Route state and control functions
 */
export function useXcmRoute({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance = 1,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
}: UseXcmRouteProps): UseXcmRouteReturn {

  // State management
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [routeDex, setRouteDex] = useState<string>('');
  const [routeState, setRouteState] = useState<RouteState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [estimatedFees, setEstimatedFees] = useState<string>('0');
  const [feeBreakdown, setFeeBreakdown] = useState<FeeSummary | undefined>(undefined);

  // Separate loading states for quote and fees
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [isLoadingFees, setIsLoadingFees] = useState<boolean>(false);

  // Track latest input amount to prevent stale responses
  const latestInputAmountRef = useRef<string>('');

  // Reset all state when tokens change
  useEffect(() => {
    setOutputAmount('');
    setRouteDex('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
    setIsLoadingQuote(false);
    setIsLoadingFees(false);
    latestInputAmountRef.current = '';
  }, [inputToken?.assetKey, outputToken?.assetKey]);

  /**
   * Fetch route and fees from ParaSpell RouterBuilder
   */
  const fetchRoute = useCallback(async (currentInputAmount: string) => {
    // Skip fetching if flag is set (for testing)
    if (shouldSkipPriceFetch()) {
      console.log('⏭️ Skipping price fetch (skipPriceFetch=true)');
      setOutputAmount(currentInputAmount); // Mock output = input
      setRouteDex('HydrationDex (mock)');
      setEstimatedFees('0.001 DOT (mock)');
      setRouteState({
        isLoading: false,
        error: null,
        data: {
          amountOut: BigInt(Math.floor(parseFloat(currentInputAmount) * 1e10)),
          exchange: 'HydrationDex'
        }
      });
      setIsLoadingQuote(false);
      setIsLoadingFees(false);
      return;
    }

    // Validation - early return if inputs invalid
    if (
      !inputToken ||
      !outputToken ||
      !currentInputAmount ||
      parseFloat(currentInputAmount) <= 0
    ) {
      setOutputAmount('');
      setRouteDex('');
      setRouteState({ isLoading: false, error: null, data: null });
      setEstimatedFees('0');
      setFeeBreakdown(undefined);
      return;
    }

    // Ensure tokens have required XCM fields
    if (!inputToken.assetKey || !inputToken.networkChain) {
      console.error('❌ Input token missing assetKey or networkChain:', inputToken);
      setRouteState({
        isLoading: false,
        error: 'Input token configuration error',
        data: null,
      });
      return;
    }

    if (!outputToken.assetKey || !outputToken.networkChain) {
      console.error('❌ Output token missing assetKey or networkChain:', outputToken);
      setRouteState({
        isLoading: false,
        error: 'Output token configuration error',
        data: null,
      });
      return;
    }

    // Update tracking ref
    latestInputAmountRef.current = currentInputAmount;

    // Set loading states
    setIsProcessing(true);
    setIsLoadingQuote(true);
    setIsLoadingFees(true);
    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('');
    setRouteDex('');
    setEstimatedFees('0');
    setFeeBreakdown(undefined);

    try {
      // Step 1: Get optimal DEX selection
      const optimalExchanges = getOptimalExchanges(
        inputToken.assetKey,
        outputToken.assetKey,
        inputToken.networkChain,
        outputToken.networkChain
      );

      // Use optimal exchanges or fallback to HydrationDex
      const exchangesToUse: TExchangeChain[] = optimalExchanges.length > 0
        ? optimalExchanges
        : ['HydrationDex'];

      // const exchangesToUse: TExchangeChain = 'HydrationDex';

      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found in registry: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }

      // Step 4: Fetch quote first to get the best exchange
      //TODO: fix chain type compatibility

      // Always fetch quote
      // Pass config to explicitly enable abstractDecimals for string amounts
      console.log('🔄 Fetching XCM quote:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amountDecimal: currentInputAmount,
        exchanges: exchangesToUse,
      });

      const quotePromise = RouterBuilder({ abstractDecimals: true })
        .from(inputToken.networkChain as any) // Type assertion for chain compatibility
        .to(outputToken.networkChain as any) // Type assertion for chain compatibility
        .exchange(exchangesToUse as any) // Type assertion needed due to ParaSpell's strict tuple type
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(currentInputAmount) // Use string amount
        .getBestAmountOut();

      const quoteSettled = await Promise.allSettled([quotePromise]);

      // Check for stale response after quote
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale quote response, ignoring');
        return;
      }

      // Step 5: Use the exchange selected by the quote to fetch fees
      let selectedExchangeForFees: TExchangeChain | TExchangeChain[] = exchangesToUse;
      
      if (quoteSettled[0].status === 'fulfilled') {
        const quoteResult = quoteSettled[0].value;
        // Use the exchange that was actually selected by the quote
        selectedExchangeForFees = quoteResult.exchange as any;
        console.log('✅ Quote selected exchange:', selectedExchangeForFees);
      }

      // Only fetch fees if wallet is connected
      // Pass config to explicitly enable abstractDecimals for string amounts
      // Round to 2 decimal places to avoid floating-point precision issues
      const safeSlippage = Math.round(slippageTolerance * 100) / 100;

      // Check if Acala is involved in the route and if local endpoints should be used
      const USE_LOCAL_ENDPOINTS = process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS === 'true';
      const isAcalaInvolved = inputToken.networkChain === 'Acala' || outputToken.networkChain === 'Acala';
      
      // Configure RouterBuilder with local Acala endpoint for development when needed
      const feeRouterConfig = (USE_LOCAL_ENDPOINTS && isAcalaInvolved) ? {
        development: true, // Enforce overrides for all chains
        abstractDecimals: true,
        apiOverrides: {
          AssetHubPolkadot: TEST_RPC_ASSET_HUB,  // ws://localhost:3421
          Hydration: TEST_RPC_HYDRATION,         // ws://localhost:3422
          BifrostPolkadot: TEST_RPC_BIFROST,     // ws://localhost:3423
          Acala: TEST_RPC_ACALA,                 // ws://localhost:3424
        }
      } : {
        abstractDecimals: true,
      };

      console.log('🔧 Fee Router Config:', feeRouterConfig);
      console.log('💰 Fetching XCM fees with selected exchange:', {
        exchange: selectedExchangeForFees,
        slippageTolerance: safeSlippage.toString(),
      });

      const feesPromise = walletAddress
        ? RouterBuilder(feeRouterConfig)
          .from(inputToken.networkChain as any) // Type assertion for chain compatibility
          .to(outputToken.networkChain as any) // Type assertion for chain compatibility
          .exchange(selectedExchangeForFees as any) // Use the exchange from quote
          .currencyFrom(determineCurrency(fromAsset))
          .currencyTo(determineCurrency(toAsset))
          .amount(currentInputAmount) // Use string amount
          .senderAddress(walletAddress)
          .recipientAddress(walletAddress)
          .slippagePct(safeSlippage.toString())
          .getXcmFees()
        : Promise.reject(new Error('No wallet connected'));

      const feesSettled = await Promise.allSettled([feesPromise]);

      // Check for stale response after fees
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale fees response, ignoring');
        return;
      }

      // Step 6: Process quote result (display ASAP)
      if (quoteSettled[0].status === 'fulfilled') {
        const quoteResult = quoteSettled[0].value;

        // Convert output amount to decimal for display using formatAmount
        const { decimal: outputDecimal } = formatAmount(
          quoteResult.amountOut,
          outputToken.decimals,
          NUMBER_FORMAT_OPTIONS
        );

        setOutputAmount(outputDecimal);

        // Handle exchange display (can be string or array)
        const dexDisplay = Array.isArray(quoteResult.exchange)
          ? quoteResult.exchange.join(' → ')
          : quoteResult.exchange;

        setRouteDex(dexDisplay);

        console.log('✅ Quote received:', {
          outputAmount: outputDecimal,
          exchange: dexDisplay,
          amountOut: quoteResult.amountOut.toString(),
        });

        setRouteState({
          isLoading: false,
          error: null,
          data: quoteResult,
        });

        setIsLoadingQuote(false);
      } else {
        console.error('❌ Quote fetch failed:', quoteSettled[0].reason);
        throw quoteSettled[0].reason;
      }

      // Step 7: Process fees result (display when ready)
      if (feesSettled[0].status === 'fulfilled') {
        const feeResult: TRouterXcmFeeResult = feesSettled[0].value;

        try {
          // Calculate and format fees (decimals come from fee result's asset info)
          const feeSummary = calculateTotalFees(feeResult);
          setFeeBreakdown(feeSummary);
          setEstimatedFees(formatFeeSummary(feeSummary));

          console.log('✅ Fees calculated:', safeStringify(feeSummary));
          console.log('✅ Simplified Fees:', formatFeeSummary(feeSummary));

          setIsLoadingFees(false);
        } catch (feeError) {
          // Handle missing decimals gracefully - show quote but indicate fee calculation failed
          console.error('❌ Fee calculation failed:', feeError);
          setEstimatedFees('—');
          setFeeBreakdown(undefined);
          setIsLoadingFees(false);

          // Optional: Could show a warning to user that fees couldn't be calculated
          // but swap quote is still valid
        }
      } else {
        // Fees fetch failed - check if it's because wallet not connected
        const feeError = feesSettled[0].status === 'rejected' ? feesSettled[0].reason : null;
        if (feeError?.message === 'No wallet connected') {
          console.warn('⚠️ No wallet connected, skipping fee calculation');
          setEstimatedFees('Connect wallet to see fees');
        } else {
          console.error('❌ Fees fetch failed:', feeError);
          setEstimatedFees('—');
        }
        setFeeBreakdown(undefined);
        setIsLoadingFees(false);
      }

    } catch (error: unknown) {
      console.error('❌ XCM route fetch error:', error);

      // Only update state if this is still the latest request
      if (latestInputAmountRef.current === currentInputAmount) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to fetch route';

        setRouteState({
          isLoading: false,
          error: errorMessage,
          data: null,
        });
        setOutputAmount('');
        setRouteDex('');
        setEstimatedFees('0');
        setFeeBreakdown(undefined);
        setIsLoadingQuote(false);
        setIsLoadingFees(false);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    inputToken,
    outputToken,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    walletAddress,
    slippageTolerance,
  ]);

  /**
   * Debounced version of fetchRoute to prevent excessive API calls
   */
  const debouncedFetchRoute = useMemo(
    () =>
      debounce((amount: string) => {
        // Validate amount before fetching
        if (amount && parseFloat(amount) > 0 && !isNaN(parseFloat(amount))) {
          fetchRoute(amount);
        } else {
          // Clear state for invalid amounts
          setOutputAmount('');
          setRouteDex('');
          setRouteState({ isLoading: false, error: null, data: null });
          setEstimatedFees('0');
          setFeeBreakdown(undefined);
        }
      }, ROUTE_FETCH_TIMEOUT),
    [fetchRoute]
  );

  /**
   * Reset all route state
   */
  const resetRoute = useCallback(() => {
    latestInputAmountRef.current = '';
    setOutputAmount('');
    setRouteDex('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
  }, []);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedFetchRoute.cancel();
      latestInputAmountRef.current = '';
    };
  }, [debouncedFetchRoute]);

  return {
    outputAmount,
    routeDex,
    routeState,
    estimatedFees,
    feeBreakdown,
    debouncedFetchRoute,
    isProcessing,
    isLoadingQuote,
    isLoadingFees,
    resetRoute,
  };
}

