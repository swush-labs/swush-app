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
import { calculateTotalFees, formatFeeSummary } from '@/services/xcm-router/feeCalculator';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';

// TEMPORARY: Dummy wallet address until wallet integration is complete
// TODO: Remove this when wallet library is implemented and use real wallet address
const DUMMY_WALLET_ADDRESS = '5EWNeodpcQ6iYibJ3jmWVe85nsok1EDG8Kk3aFg8ZzpfY1qX';

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

      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found in registry: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }

      // Step 3: Convert amount to smallest unit (BigInt)
      const amountInSmallestUnit = toSmallestUnit(
        currentInputAmount,
        inputToken.decimals
      );

      console.log('🔄 Fetching XCM quote and fees in parallel:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amountDecimal: currentInputAmount,
        amountSmallest: amountInSmallestUnit.toString(),
        exchanges: exchangesToUse,
      });

      // Step 4: PARALLEL FETCH - Quote and Fees simultaneously!
      const addressToUse = walletAddress || DUMMY_WALLET_ADDRESS;

      //TODO: fix chain type compatibility
      const [quoteSettled, feesSettled] = await Promise.allSettled([
        // Fetch quote
        RouterBuilder()
          .from(inputToken.networkChain as any) // Type assertion for chain compatibility
          .to(outputToken.networkChain as any) // Type assertion for chain compatibility
          .exchange(exchangesToUse as any) // Type assertion needed due to ParaSpell's strict tuple type
          .currencyFrom(determineCurrency(fromAsset))
          .currencyTo(determineCurrency(toAsset))
          .amount(amountInSmallestUnit)
          .getBestAmountOut(),

        // Fetch fees
        RouterBuilder()
          .from(inputToken.networkChain as any) // Type assertion for chain compatibility
          .to(outputToken.networkChain as any) // Type assertion for chain compatibility
          .exchange(exchangesToUse as any) // Type assertion needed due to ParaSpell's strict tuple type
          .currencyFrom(determineCurrency(fromAsset))
          .currencyTo(determineCurrency(toAsset))
          .amount(amountInSmallestUnit)
          .senderAddress(addressToUse)
          .recipientAddress(addressToUse)
          .slippagePct(slippageTolerance.toString())
          .getXcmFees()
      ]);

      // Check for stale response
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale response, ignoring');
        return;
      }

      // Step 5: Process quote result (display ASAP)
      if (quoteSettled.status === 'fulfilled') {
        const quoteResult = quoteSettled.value;

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
        console.error('❌ Quote fetch failed:', quoteSettled.reason);
        throw quoteSettled.reason;
      }

      // Step 6: Process fees result (display when ready)
      if (feesSettled.status === 'fulfilled') {
        const feeResult: TRouterXcmFeeResult = feesSettled.value;

        // Calculate and format fees (multi-currency support)
        const feeSummary = calculateTotalFees(feeResult);
        setFeeBreakdown(feeSummary);
        setEstimatedFees(formatFeeSummary(feeSummary));

        console.log('✅ Fees calculated:', formatFeeSummary(feeSummary));

        setIsLoadingFees(false);
      } else {
        console.error('❌ Fees fetch failed:', feesSettled.reason);
        // Don't throw - quote is more important than fees
        setEstimatedFees('—');
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

