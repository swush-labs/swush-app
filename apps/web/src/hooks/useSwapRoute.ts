import { useState, useCallback, useEffect } from 'react';
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

    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('0');
    setRouteDex('');

    try {
      const route = await api.assets.findRoute({
        fromAsset: inputToken.id,
        toAsset: outputToken.id,
        amountIn: currentInputAmount
      });
      setRouteDex(getNetworkDisplayName(route.dex));
      
      if (currentInputAmount === currentInputAmount) { // Compare with latest input
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

      if (currentInputAmount === currentInputAmount) { // Compare with latest input
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

  const debouncedFetchRoute = useCallback(
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

  return {
    outputAmount,
    routeDex,
    routeState,
    debouncedFetchRoute,
  };
}