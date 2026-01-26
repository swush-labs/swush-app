'use client';

import { useState, useEffect, useMemo } from 'react';
import { ASSET_REGISTRY } from '@/services/xcm-router/assetRegistry';
import { priceService } from './coingeckoService';

interface UsePriceAggregatorReturn {
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  getPrice: (symbol: string) => number | null;
  formatUSD: (amount: string, symbol: string, decimals: number) => string;
}

/**
 * React hook for fetching and managing asset prices from CoinGecko
 * 
 * Automatically fetches prices for all provided symbols and refreshes every 60 seconds.
 * Uses caching to minimize API calls and respect rate limits.
 * 
 * @param symbols - Optional array of asset symbols to fetch prices for
 * @returns Price data, loading state, and helper functions
 */
export function usePriceAggregator(symbols?: string[]): UsePriceAggregatorReturn {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract CoinGecko IDs from symbols
  const coingeckoIds = useMemo(() => {
    if (!symbols || symbols.length === 0) {
      return [];
    }

    return symbols
      .map(symbol => {
        const entry = ASSET_REGISTRY[symbol];
        return entry?.coingeckoId;
      })
      .filter((id): id is string => Boolean(id));
  }, [symbols]);

  // Fetch prices on mount and refresh every 60s
  useEffect(() => {
    if (coingeckoIds.length === 0) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAndCache = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const priceData = await priceService.fetchPrices(coingeckoIds);

        if (isMounted) {
          setPrices(prevPrices => ({ ...prevPrices, ...priceData }));
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
          setError(errorMessage);
          setIsLoading(false);
          console.error('Error in usePriceAggregator:', err);
        }
      }
    };

    // Initial fetch
    fetchAndCache();

    // Set up interval for auto-refresh (60 seconds)
    const interval = setInterval(fetchAndCache, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [coingeckoIds]);

  // Helper function to get price for a symbol
  const getPrice = useMemo(() => {
    return (symbol: string): number | null => {
      return prices[symbol] || priceService.getPrice(symbol) || null;
    };
  }, [prices]);

  // Helper function to format USD value
  const formatUSD = useMemo(() => {
    return (amount: string, symbol: string, decimals: number): string => {
      return priceService.formatUSD(amount, symbol, decimals);
    };
  }, []);

  return {
    prices,
    isLoading,
    error,
    getPrice,
    formatUSD,
  };
}
