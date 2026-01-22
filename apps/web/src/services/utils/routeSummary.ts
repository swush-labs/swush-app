import type { SwapProvider } from '@/services/xcm-router/assetRegistry';

/**
 * Build a human-readable route summary for display in UI
 * 
 * Examples:
 * - "HydrationDex" (same chain swap)
 * - "AssetHub → HydrationDex → Moonbeam" (XCM cross-chain)
 * - "Chainflip: Ethereum → AssetHub" (Chainflip)
 */
export function buildRouteSummary(
  provider: SwapProvider,
  chainFrom: string,
  chainTo: string,
  exchange?: string
): string {
  // Chainflip routes
  if (provider === 'chainflip') {
    return `Chainflip: ${chainFrom} → ${chainTo}`;
  }
  
  // XCM same-chain swap (just DEX name)
  if (chainFrom === chainTo && exchange) {
    return exchange;
  }
  
  // XCM cross-chain with exchange
  if (exchange) {
    return `${chainFrom} → ${exchange} → ${chainTo}`;
  }
  
  // XCM cross-chain direct transfer
  return `${chainFrom} → ${chainTo}`;
}
