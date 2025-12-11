import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import debounce from 'lodash.debounce';

import type { TokenInfo } from '@/components/swap/types';
import {
  chainflipClient,
  formatDuration,
  type ChainflipQuote,
} from '@/services/chainflip';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Route state interface for Chainflip quotes
 */
export interface ChainflipRouteState {
  isLoading: boolean;
  error: string | null;
  data: ChainflipQuote | null;
}

/**
 * Props for useChainflipRoute hook
 */
interface UseChainflipRouteProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress?: string;
}

/**
 * Return type for useChainflipRoute hook
 */
interface UseChainflipRouteReturn {
  outputAmount: string;
  routeState: ChainflipRouteState;
  estimatedFees: string;
  estimatedDuration: string;
  quote: ChainflipQuote | null;
  debouncedFetchRoute: ((amount: string) => void) & { cancel: () => void };
  isProcessing: boolean;
  isLoadingQuote: boolean;
  resetRoute: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chainflip Route Hook - Fetches quotes from Chainflip Broker API
 * 
 * Features:
 * - Real quotes from Chainflip broker
 * - Automatic fee breakdown (network, broker, liquidity)
 * - Estimated swap duration
 * - Stale response prevention
 * - Debounced fetching
 * 
 * @param props - Hook configuration
 * @returns Route state and control functions
 */
export function useChainflipRoute({
  inputToken,
  outputToken,
  walletAddress,
}: UseChainflipRouteProps): UseChainflipRouteReturn {

  // State management
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [routeState, setRouteState] = useState<ChainflipRouteState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [estimatedFees, setEstimatedFees] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('');
  const [quote, setQuote] = useState<ChainflipQuote | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);

  // Track latest input amount to prevent stale responses
  const latestInputAmountRef = useRef<string>('');

  // Reset all state when tokens change
  useEffect(() => {
    setOutputAmount('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('');
    setEstimatedDuration('');
    setQuote(null);
    setIsLoadingQuote(false);
    latestInputAmountRef.current = '';
  }, [inputToken?.assetKey, outputToken?.assetKey]);

  /**
   * Validate that token has required Chainflip fields
   */
  const validateChainflipToken = useCallback((token: TokenInfo | null, label: string): boolean => {
    if (!token) {
      console.error(`❌ ${label} token is null`);
      return false;
    }
    if (!token.chainflipId) {
      console.error(`❌ ${label} token missing chainflipId:`, token);
      return false;
    }
    if (token.decimals === undefined) {
      console.error(`❌ ${label} token missing decimals:`, token);
      return false;
    }
    return true;
  }, []);

  /**
   * Fetch quote from Chainflip Broker API
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
      setRouteState({ isLoading: false, error: null, data: null });
      setEstimatedFees('');
      setEstimatedDuration('');
      setQuote(null);
      return;
    }

    // Validate Chainflip fields
    if (!validateChainflipToken(inputToken, 'Input')) {
      setRouteState({
        isLoading: false,
        error: 'Input token not configured for Chainflip',
        data: null,
      });
      return;
    }

    if (!validateChainflipToken(outputToken, 'Output')) {
      setRouteState({
        isLoading: false,
        error: 'Output token not configured for Chainflip',
        data: null,
      });
      return;
    }

    // Update tracking ref
    latestInputAmountRef.current = currentInputAmount;

    // Set loading states
    setIsProcessing(true);
    setIsLoadingQuote(true);
    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('');
    setEstimatedFees('');
    setEstimatedDuration('');
    setQuote(null);

    try {
      console.log('🔄 Fetching Chainflip quote:', {
        from: `${inputToken.symbol} (${inputToken.chainflipId})`,
        to: `${outputToken.symbol} (${outputToken.chainflipId})`,
        amount: currentInputAmount,
      });

      // Fetch quote from Chainflip (amount is passed as-is in human-readable format)
      const quoteResult = await chainflipClient.getQuote({
        sourceAsset: inputToken.chainflipId!,
        destinationAsset: outputToken.chainflipId!,
        amount: currentInputAmount,
      });

      // Check for stale response
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale Chainflip quote response, ignoring');
        return;
      }

      // egressAmount is already in human-readable format
      setOutputAmount(quoteResult.egressAmount);

      // Format fees for display (fees are already in human-readable format)
      const totalFees = formatChainflipFees(quoteResult.includedFees, inputToken.symbol);
      setEstimatedFees(totalFees);

      // Format duration
      setEstimatedDuration(formatDuration(quoteResult.estimatedDurationSeconds));

      // Store full quote for execution
      setQuote(quoteResult);

      console.log('✅ Chainflip quote received:', {
        outputAmount: quoteResult.egressAmount,
        fees: totalFees,
        duration: formatDuration(quoteResult.estimatedDurationSeconds),
      });

      setRouteState({
        isLoading: false,
        error: null,
        data: quoteResult,
      });

    } catch (error: unknown) {
      console.error('❌ Chainflip quote fetch error:', error);

      // Only update state if this is still the latest request
      if (latestInputAmountRef.current === currentInputAmount) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to fetch Chainflip quote';

        setRouteState({
          isLoading: false,
          error: errorMessage,
          data: null,
        });
        setOutputAmount('');
        setEstimatedFees('');
        setEstimatedDuration('');
        setQuote(null);
      }
    } finally {
      setIsProcessing(false);
      setIsLoadingQuote(false);
    }
  }, [inputToken, outputToken, validateChainflipToken]);

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
          setRouteState({ isLoading: false, error: null, data: null });
          setEstimatedFees('');
          setEstimatedDuration('');
          setQuote(null);
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
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('');
    setEstimatedDuration('');
    setQuote(null);
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
    routeState,
    estimatedFees,
    estimatedDuration,
    quote,
    debouncedFetchRoute,
    isProcessing,
    isLoadingQuote,
    resetRoute,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format Chainflip fees for display
 * Shows total fee with breakdown tooltip
 * Fees are already in human-readable format from the API
 */
function formatChainflipFees(
  fees: Array<{ type: string; asset: string; amount: string }>,
  symbol: string
): string {
  // Sum all fees (they are already in human-readable format)
  let totalFee = 0;
  
  for (const fee of fees) {
    totalFee += parseFloat(fee.amount || '0');
  }

  // Format with appropriate precision
  const formatted = totalFee.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  return `~${formatted} ${symbol}`;
}

