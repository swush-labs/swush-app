/**
 * Chainflip Broker API Client
 * 
 * REST client for interacting with the Chainflip Broker API
 * Uses the hosted broker service at chainflip-broker.io
 * 
 * Reference: https://docs.chainflip-broker.io/features/ask-quote/
 */

import type {
  ChainflipAssetId,
  ChainflipQuoteRequest,
  ChainflipQuoteResponse,
  ChainflipSwapRequest,
  ChainflipSwapResponse,
  ChainflipSwapStatus,
  ChainflipQuote,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// BaaS API from https://chainflip-broker.io
const CHAINFLIP_BROKER_BASE_URL = process.env.NEXT_PUBLIC_CHAINFLIP_BROKER_URL || 'https://chainflip-broker.io';
const CHAINFLIP_API_KEY = process.env.NEXT_PUBLIC_CHAINFLIP_API_KEY || '';

// ═══════════════════════════════════════════════════════════════════════════════
// Chainflip Client Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ChainflipClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = CHAINFLIP_BROKER_BASE_URL, apiKey: string = CHAINFLIP_API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Build URL with API key query parameter
   */
  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const url = new URL(endpoint, this.baseUrl);
    
    // Add API key as query parameter
    if (this.apiKey) {
      url.searchParams.set('apikey', this.apiKey);
    }
    
    // Add additional query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }

  /**
   * Make a GET request to the Chainflip broker
   */
  private async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Make a POST request to the Chainflip broker
   */
  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const url = this.buildUrl(endpoint);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get a quote for a cross-chain swap
   * 
   * @param request - Quote request parameters
   * @returns Quote response with output amount, fees, and estimated duration
   */
  async getQuote(request: ChainflipQuoteRequest): Promise<ChainflipQuote> {
    console.log('🔄 Chainflip: Getting quote', request);

    const params = {
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
    };

    const result = await this.get<ChainflipQuoteResponse>('/quotes', params);

    console.log('✅ Chainflip: Quote response received', result);

    // The API returns an array of quotes (regular and/or DCA)
    // We select the 'regular' quote type
    const regularQuote = result.find(q => q.type === 'regular');
    
    if (!regularQuote) {
      throw new Error('No regular quote available in response');
    }

    console.log('✅ Chainflip: Regular quote selected', regularQuote);
    return regularQuote;
  }

  /**
   * Request a deposit address for initiating a swap
   * User sends funds to this address to trigger the swap
   *
   * @param request - Swap request parameters
   * @returns Deposit address and channel information
   */
  async requestSwapDepositAddress(request: ChainflipSwapRequest): Promise<ChainflipSwapResponse> {
    console.log('🔄 Chainflip: Requesting deposit address', request);

    const params: Record<string, string> = {
      sourceAsset: request.sourceAsset,
      destinationAsset: request.destinationAsset,
      destinationAddress: request.destinationAddress,
      minimumPrice: request.minimumPrice,
      refundAddress: request.refundAddress,
      retryDurationBlocks: request.retryDurationBlocks.toString(),
    };

    // Add optional fields
    if (request.boostFee !== undefined) {
      params.boostFee = request.boostFee.toString();
    }

    if (request.commissionBps !== undefined) {
      params.commissionBps = request.commissionBps.toString();
    }

    const result = await this.get<ChainflipSwapResponse>('/swap', params);

    console.log('✅ Chainflip: Deposit address received', result);
    return result;
  }

  /**
   * Get the status of an ongoing swap
   *
   * @param swapId - The swap ID returned from requestSwapDepositAddress
   * @returns Current swap status
   */
  async getSwapStatus(swapId: string | number): Promise<ChainflipSwapStatus> {
    console.log('🔄 Chainflip: Getting swap status', swapId);

    const params = { swapId: swapId.toString() };
    const result = await this.get<ChainflipSwapStatus>('/status-by-id', params);

    console.log('✅ Chainflip: Swap status', result);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

export const chainflipClient = new ChainflipClient();

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert human-readable amount to smallest unit
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param decimals - Token decimals
 * @returns Amount in smallest unit as string
 */
export const toSmallestUnit = (amount: string, decimals: number): string => {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  // Remove leading zeros but keep at least one digit
  return combined.replace(/^0+/, '') || '0';
};

/**
 * Convert smallest unit to human-readable amount
 * @param amount - Amount in smallest unit
 * @param decimals - Token decimals
 * @returns Human-readable amount
 */
export const fromSmallestUnit = (amount: string, decimals: number): string => {
  const padded = amount.padStart(decimals + 1, '0');
  const insertPoint = padded.length - decimals;
  const whole = padded.slice(0, insertPoint) || '0';
  const fraction = padded.slice(insertPoint);
  // Trim trailing zeros from fraction
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

/**
 * Format estimated duration in human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2-5 min")
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 2) {
    return `~${minutes} min`;
  }
  // Add some buffer for cross-chain swaps
  return `${minutes}-${minutes + 3} min`;
};

/**
 * Calculate minimum price with slippage tolerance
 * Formula: minimumPrice = estimatedPrice * (1 - slippagePercent / 100)
 * @param estimatedPrice - The estimated price from quote
 * @param slippagePercent - Slippage tolerance percentage (e.g., 0.5, 1, 2.5)
 * @returns Minimum acceptable price
 */
export const calculateMinimumPrice = (
  estimatedPrice: string | number, 
  slippagePercent: number
): string => {
  const price = typeof estimatedPrice === 'string' 
    ? parseFloat(estimatedPrice) 
    : estimatedPrice;
  const multiplier = (100 - slippagePercent) / 100;
  const minimumPrice = price * multiplier;
  // High precision for price ratios
  return minimumPrice.toFixed(10);
};

/**
 * Convert minutes to blocks (1 block = 6 seconds on Chainflip)
 * @param minutes - Duration in minutes
 * @returns Number of blocks
 */
export const minutesToBlocks = (minutes: number): number => {
  return Math.floor((minutes * 60) / 6);
};
