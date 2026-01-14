import { ASSET_REGISTRY } from '@/services/xcm-router/assetRegistry';

interface PriceCache {
  prices: Record<string, number>;  // symbol -> USD price
  lastUpdated: number;
  ttl: number;
}

interface CoinGeckoPriceResponse {
  [coingeckoId: string]: {
    usd: number;
  };
}

/**
 * CoinGecko Price Service
 * 
 * Fetches and caches USD prices for assets using CoinGecko API.
 * Implements caching to respect rate limits (10-50 calls/min free tier).
 */
class CoinGeckoPriceService {
  private cache: PriceCache;
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor() {
    this.cache = {
      prices: {},
      lastUpdated: 0,
      ttl: this.CACHE_TTL,
    };
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cache.lastUpdated < this.cache.ttl;
  }

  /**
   * Map CoinGecko IDs back to asset symbols
   */
  private mapCoingeckoIdsToSymbols(
    coingeckoIds: string[],
    priceData: CoinGeckoPriceResponse
  ): Record<string, number> {
    const symbolPrices: Record<string, number> = {};

    // Iterate through asset registry to find matching symbols
    Object.entries(ASSET_REGISTRY).forEach(([symbol, entry]) => {
      if (entry.coingeckoId && coingeckoIds.includes(entry.coingeckoId)) {
        const price = priceData[entry.coingeckoId]?.usd;
        if (price !== undefined && price !== null) {
          symbolPrices[symbol] = price;
        }
      }
    });

    return symbolPrices;
  }

  /**
   * Fetch prices from CoinGecko API
   * 
   * @param coingeckoIds - Array of CoinGecko IDs to fetch
   * @returns Map of symbol -> USD price
   */
  async fetchPrices(coingeckoIds: string[]): Promise<Record<string, number>> {
    if (coingeckoIds.length === 0) {
      return {};
    }

    // Check cache first
    if (this.isCacheValid()) {
      // Return cached prices for requested symbols
      const cachedPrices: Record<string, number> = {};
      coingeckoIds.forEach(id => {
        const symbol = this.getSymbolFromCoingeckoId(id);
        if (symbol && this.cache.prices[symbol]) {
          cachedPrices[symbol] = this.cache.prices[symbol];
        }
      });
      
      // If we have all requested prices in cache, return them
      const requestedSymbols = coingeckoIds
        .map(id => this.getSymbolFromCoingeckoId(id))
        .filter(Boolean) as string[];
      
      if (requestedSymbols.every(symbol => cachedPrices[symbol] !== undefined)) {
        return cachedPrices;
      }
    }

    try {
      // Build API URL with query params
      const idsParam = coingeckoIds.join(',');
      const apiKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
      const url = `${this.API_BASE}/simple/price?ids=${idsParam}&vs_currencies=usd${apiKey ? `&x_cg_pro_api_key=${apiKey}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('CoinGecko API rate limit exceeded, using cached prices if available');
          return this.cache.prices;
        }
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const priceData: CoinGeckoPriceResponse = await response.json();

      // Map CoinGecko IDs back to symbols
      const symbolPrices = this.mapCoingeckoIdsToSymbols(coingeckoIds, priceData);

      // Update cache
      this.cache = {
        prices: { ...this.cache.prices, ...symbolPrices },
        lastUpdated: Date.now(),
        ttl: this.CACHE_TTL,
      };

      return symbolPrices;
    } catch (error) {
      console.error('Error fetching prices from CoinGecko:', error);
      // Return cached prices if available, otherwise empty object
      return this.cache.prices;
    }
  }

  /**
   * Get symbol from CoinGecko ID by looking up in asset registry
   */
  private getSymbolFromCoingeckoId(coingeckoId: string): string | null {
    for (const [symbol, entry] of Object.entries(ASSET_REGISTRY)) {
      if (entry.coingeckoId === coingeckoId) {
        return symbol;
      }
    }
    return null;
  }

  /**
   * Get cached price for a symbol
   * 
   * @param symbol - Asset symbol (e.g., "DOT", "USDC")
   * @returns USD price or null if not available
   */
  getPrice(symbol: string): number | null {
    return this.cache.prices[symbol] || null;
  }

  /**
   * Format amount in USD
   * 
   * @param amount - Token amount as string
   * @param symbol - Asset symbol
   * @param decimals - Token decimals
   * @returns Formatted USD string (e.g., "$1,234.56")
   */
  formatUSD(amount: string, symbol: string, decimals: number): string {
    const price = this.getPrice(symbol);
    if (!price || !amount || parseFloat(amount) <= 0) {
      return '—';
    }

    try {
      const amountNum = parseFloat(amount);
      const usdValue = amountNum * price;

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(usdValue);
    } catch (error) {
      console.error('Error formatting USD value:', error);
      return '—';
    }
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.cache = {
      prices: {},
      lastUpdated: 0,
      ttl: this.CACHE_TTL,
    };
  }
}

export const priceService = new CoinGeckoPriceService();
