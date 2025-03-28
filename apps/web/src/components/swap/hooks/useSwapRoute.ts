import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import type { RouteQuote } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import debounce from 'lodash.debounce';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';
import { getNetworkDisplayName } from '@/lib/utils';

interface UseSwapRouteProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
}

export function useSwapRoute({ inputToken, outputToken }: UseSwapRouteProps) {
  const [outputAmount, setOutputAmount] = useState('0');
  const [routeDex, setRouteDex] = useState('');
  const [routeState, setRouteState] = useState<{
    isLoading: boolean;
    error: string | null;
    data: RouteQuote | null;
  }>({
    isLoading: false,
    error: null,
    data: null
  });

  // Use ref to track latest input amount for stale closure detection
  const latestInputAmountRef = useRef<string>('');

  // Reset states when tokens change
  useEffect(() => {
    setOutputAmount('0');
    setRouteDex('');
    setRouteState({
      isLoading: false,
      error: null,
      data: null
    });
  }, [inputToken?.id, outputToken?.id]);

  const fetchRouteAndUpdateOutput = useCallback(async (currentInputAmount: string) => {
    if (!inputToken || !outputToken || !currentInputAmount || parseFloat(currentInputAmount) <= 0) {
      setOutputAmount('0');
      setRouteDex('');
      setRouteState(prev => ({ ...prev, isLoading: false, error: null }));
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
    debouncedFetchRoute,
    resetRoute
  };
}