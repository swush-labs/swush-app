import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import type { RouteQuote } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import debounce from 'lodash.debounce';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';
import { getNetworkDisplayName } from '@/lib/utils';
import { calculateEstimatedFees } from './utils/feeUtils';
import { FeeBreakdown } from './types';

interface UseSwapRouteProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
}

export interface RouteState {
  isLoading: boolean;
  error: string | null;
  data: RouteQuote | null;
}

export function useSwapRoute({ inputToken, outputToken }: UseSwapRouteProps) {
  const [outputAmount, setOutputAmount] = useState('0');
  const [routeDex, setRouteDex] = useState<string | null>(null);
  const [routeState, setRouteState] = useState<RouteState>({
    isLoading: false,
    error: null,
    data: null
  });
  
  // Add fee estimation state
  const [estimatedFees, setEstimatedFees] = useState<string>('0');
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | undefined>(undefined);

  // Use ref to track latest input amount for stale closure detection
  const latestInputAmountRef = useRef<string>('');

  // Reset states when tokens change
  useEffect(() => {
    setOutputAmount('0');
    setRouteDex(null);
    setRouteState({
      isLoading: false,
      error: null,
      data: null
    });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
  }, [inputToken?.id, outputToken?.id]);

  const fetchRouteAndUpdateOutput = useCallback(async (currentInputAmount: string) => {
    if (!inputToken || !outputToken || !currentInputAmount || parseFloat(currentInputAmount) <= 0) {
      setOutputAmount('0');
      setRouteDex(null);
      setRouteState(prev => ({ ...prev, isLoading: false, error: null }));
      setEstimatedFees('0');
      setFeeBreakdown(undefined);
      return;
    }

    // Update latest input amount ref
    latestInputAmountRef.current = currentInputAmount;

    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('0');
    setRouteDex('');

    try {
      const route = await api.assets.findRoute({
        fromAsset: inputToken.id,
        toAsset: outputToken.id,
        amountIn: currentInputAmount
      });
      
      // Only update if this is still the latest input amount
      if (latestInputAmountRef.current === currentInputAmount) {
        setRouteDex(getNetworkDisplayName(route.dex));
        setRouteState({
          isLoading: false,
          error: null,
          data: route
        });
        setOutputAmount(route.expectedOutput.decimal);

        // After determining the route and DEX, calculate fees
        if (route && route.dex) {
          const { estimatedFee, feeBreakdown: fees } = calculateEstimatedFees(route.dex);
          setEstimatedFees(estimatedFee);
          setFeeBreakdown(fees);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to fetch route:', error);
      let errorMessage = 'Failed to find route';
      
      if (error instanceof Error && error.message.includes('no route found')) {
        errorMessage = `No route available from ${inputToken.symbol} to ${outputToken.symbol}`;
      }

      // Only update if this is still the latest input amount
      if (latestInputAmountRef.current === currentInputAmount) {
        setRouteState({
          isLoading: false,
          error: errorMessage,
          data: null
        });
        setRouteDex('');
        setOutputAmount('0');
        setEstimatedFees('0');
        setFeeBreakdown(undefined);
      }
    }
  }, [inputToken, outputToken]);

  const debouncedFetchRoute = useMemo(
    () =>
      debounce((amount: string) => {
        if (parseFloat(amount) > 0) {
          fetchRouteAndUpdateOutput(amount);
        } else {
          setOutputAmount('0');
          setRouteDex('');
          setRouteState(prev => ({ ...prev, isLoading: false, error: null }));
          setEstimatedFees('0');
          setFeeBreakdown(undefined);
        }
      }, ROUTE_FETCH_TIMEOUT),
    [fetchRouteAndUpdateOutput]
  );

  // Add resetRoute function
  const resetRoute = useCallback(() => {
    setOutputAmount('0');
    setRouteDex('');
    setRouteState({
      isLoading: false,
      error: null,
      data: null
    });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
  }, []);

  // Cleanup debounced function and reset ref on unmount or when debounced function changes
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
    resetRoute
  };
}