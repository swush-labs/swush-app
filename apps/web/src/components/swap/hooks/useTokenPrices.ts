'use client';

import { useMemo } from 'react';
import { usePriceAggregator } from '@/services/prices';
import type { TokenInfo } from '@/components/swap/types';

interface UseTokenPricesParams {
  fromTokens: TokenInfo[];
  toTokens: TokenInfo[];
}

/**
 * Hook to fetch and manage prices for visible tokens in the swap interface.
 * 
 * Automatically extracts unique symbols from both fromTokens and toTokens,
 * and provides price formatting utilities.
 * 
 * @param fromTokens - Available tokens for the input field
 * @param toTokens - Available tokens for the output field
 * @returns Price utilities including formatUSD function
 */
export function useTokenPrices({ fromTokens, toTokens }: UseTokenPricesParams) {
  // Extract unique symbols from both token lists
  const symbols = useMemo(() => {
    const symbolSet = new Set<string>();
    fromTokens.forEach(token => symbolSet.add(token.symbol));
    toTokens.forEach(token => symbolSet.add(token.symbol));
    return Array.from(symbolSet);
  }, [fromTokens, toTokens]);

  // Fetch prices for all visible tokens
  const priceData = usePriceAggregator(symbols);

  return priceData;
}

