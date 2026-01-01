'use client';

import { useMemo, useCallback } from "react";
import useCurrencyOptions from "./useCurrencyOptions";
import { 
  type AssetRegistryEntry, 
  ASSET_REGISTRY, 
  type SwapProvider,
} from "./assetRegistry";
import { getCompatibleDEXs, getOptimalDEXArray } from "./assetRegistryUtils";
import {
  type TChain,
  type TAssetInfo,
  type TCurrencyInput,
  CHAINS
} from "@paraspell/sdk";
import type { TExchangeChain } from "@paraspell/xcm-router";

// ═══════════════════════════════════════════════════════════════════════════════
// Network Support Data Structure
// ═══════════════════════════════════════════════════════════════════════════════

export interface NetworkSupport {
  network: string;
  assetKey: string;
  displayName: string;
  assetType: string;
  verified: boolean;
  // Provider-specific fields
  provider: SwapProvider;
  actualAsset: TAssetInfo | null;  // null for Chainflip-only networks
  // Chainflip-specific fields (also used by hybrid XCM tokens)
  chainflipId?: string;  // Chainflip compound asset ID (e.g., "dot.hub", "usdc.arb")
  decimals?: number;
  contractAddress?: string;
  assetId?: string;  // Polkadot asset ID for Assets pallet (e.g., "1337" for USDC)
}

// Unified asset-network data structure
export type UnifiedAsset = {
  symbol: string;
  name: string;
  category: string;
  description?: string;
  // Pre-computed networks that support this asset (now includes both XCM and Chainflip)
  supportedNetworks: NetworkSupport[];
  // Validation status
  isValid: boolean;
  totalNetworks: number;
  validNetworks: number;
};

// Backward compatibility
export type AggregatedAsset = UnifiedAsset;

// Helper functions - exported for use in other modules
export const determineCurrency = (asset: TAssetInfo): TCurrencyInput => {
  if (asset.location) {
    return { location: asset.location };
  } else if ("assetId" in asset && asset.assetId !== undefined) {
    return { id: asset.assetId };
  }
  return { symbol: asset.symbol ?? "" };
};

// ═══════════════════════════════════════════════════════════════════════════════
// Unified Network Data Creator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create unified network data for any asset (XCM, Chainflip, or hybrid)
 * 
 * This function handles all network types:
 * - XCM-only networks (e.g., Hydration, Bifrost) - have actualAsset from ParaSpell
 * - Chainflip-only networks (e.g., Ethereum, Arbitrum, Solana) - no actualAsset
 * - Hybrid networks (e.g., AssetHub with chainflipId) - have both actualAsset and chainflipId
 * 
 * @param key - Asset registry key (e.g., "USDC-1337-AssetHubPolkadot")
 * @param registryEntry - Full registry entry for the asset
 * @param actualAsset - ParaSpell TAssetInfo (null for Chainflip-only networks)
 */
const createNetworkData = (
  key: string,
  registryEntry: AssetRegistryEntry,
  actualAsset: TAssetInfo | null
): NetworkSupport => {
  const instance = registryEntry.networkInstances[key];
  const provider = instance.provider || 'xcm';

  return {
    network: instance.network,
    assetKey: key,
    displayName: instance.displayName || `${registryEntry.symbol} (${instance.network})`,
    assetType: instance.assetType,
    verified: instance.verified || false,
    provider,
    actualAsset,
    // Pass through Chainflip fields (for both Chainflip-only and hybrid tokens)
    chainflipId: instance.chainflipId,
    decimals: instance.decimals,
    contractAddress: instance.contractAddress,
    assetId: instance.assetId,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// Asset Processing Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process registry assets and create unified asset list
 * 
 * Handles both XCM (ParaSpell-validated) and Chainflip (direct) networks:
 * - XCM networks are validated against ParaSpell's currencyMap
 * - Chainflip networks are added directly from registry (no validation needed)
 * - Hybrid tokens (e.g., AssetHub USDC/DOT) get both XCM validation and Chainflip fields
 * 
 * @param currencyMap - ParaSpell currency map (from/to specific)
 * @param expectedAssetKeys - Set of valid asset keys from registry
 * @returns Array of unified assets with their supported networks
 */
const processRegistryAssets = (
  currencyMap: Record<string, TAssetInfo>,
  expectedAssetKeys: Set<string>
): UnifiedAsset[] => {
  const assetMap = new Map<string, UnifiedAsset>();

  Object.values(ASSET_REGISTRY).forEach(registryEntry => {
    const symbol = registryEntry.symbol;
    
    // Initialize asset entry
    assetMap.set(symbol, {
      symbol,
      name: registryEntry.name,
      category: registryEntry.category,
      description: registryEntry.description,
      supportedNetworks: [],
      isValid: false,
      totalNetworks: Object.keys(registryEntry.networkInstances).length,
      validNetworks: 0,
    });
    
    const asset = assetMap.get(symbol)!;
    
    // Process each network instance
    Object.entries(registryEntry.networkInstances).forEach(([key, instance]) => {
      const provider = instance.provider || 'xcm';
      
      if (provider === 'xcm') {
        // XCM: Validate against ParaSpell currencyMap
        const actualAsset = currencyMap[key];
        if (actualAsset && expectedAssetKeys.has(key)) {
          asset.supportedNetworks.push(createNetworkData(key, registryEntry, actualAsset));
          if (instance.verified) asset.validNetworks++;
        }
      } else {
        // Chainflip: Add directly (no ParaSpell validation needed)
        asset.supportedNetworks.push(createNetworkData(key, registryEntry, null));
        if (instance.verified) asset.validNetworks++;
      }
    });
    
    asset.isValid = asset.validNetworks > 0;
  });

  return Array.from(assetMap.values())
    .filter(asset => asset.supportedNetworks.length > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Hook
// ═══════════════════════════════════════════════════════════════════════════════

const useAssetAggregator = (
  from: TChain | undefined,
  exchangeNode: TExchangeChain[],
  to: TChain | undefined
) => {
  // Extract registry metadata for targeted queries (memoized to prevent infinite loops)
  const registryMetadata = useMemo(() => {
    const networks = new Set<string>();
    const expectedKeys = new Set<string>();
    
    Object.values(ASSET_REGISTRY).forEach(asset => {
      Object.entries(asset.networkInstances).forEach(([key, instance]) => {
        networks.add(instance.network);
        expectedKeys.add(key);
      });
    });
    
    return {
      targetNetworks: Array.from(networks),
      expectedAssetKeys: expectedKeys
    };
  }, []); // Empty dependency array since ASSET_REGISTRY is static

  // Filter out valid networks before passing to useCurrencyOptions (memoized to prevent infinite loops)
  const validTargetNetworks = useMemo(() => 
    registryMetadata.targetNetworks.filter(network => 
      CHAINS.includes(network as TChain)
    ), [registryMetadata.targetNetworks]
  );

  // Get existing currency options with validated registry-driven filtering
  const {
    currencyFromOptions,
    currencyToOptions,
    currencyFromMap,
    currencyToMap,
  } = useCurrencyOptions(from, exchangeNode, to, validTargetNetworks);

  // Create unified asset lists using shared helper (DRY principle)
  const unifiedFromAssets = useMemo(() => 
    processRegistryAssets(currencyFromMap, registryMetadata.expectedAssetKeys),
    [currencyFromMap, registryMetadata.expectedAssetKeys]
  );

  const unifiedToAssets = useMemo(() => 
    processRegistryAssets(currencyToMap, registryMetadata.expectedAssetKeys),
    [currencyToMap, registryMetadata.expectedAssetKeys]
  );

  // Helper functions for RouterBuilder compatibility (memoized to prevent infinite loops)
  const getTAssetFromKey = useCallback((key: string, direction: 'from' | 'to'): TAssetInfo | undefined => {
    const map = direction === 'from' ? currencyFromMap : currencyToMap;
    return map[key];
  }, [currencyFromMap, currencyToMap]);

  // Get networks for a specific asset (pre-computed)
  const getNetworksForAsset = useCallback((symbol: string, direction: 'from' | 'to') => {
    const assets = direction === 'from' ? unifiedFromAssets : unifiedToAssets;
    const asset = assets.find(a => a.symbol === symbol);
    return asset ? asset.supportedNetworks : [];
  }, [unifiedFromAssets, unifiedToAssets]);

  const getAssetKeyForNetwork = useCallback((symbol: string, network: string, direction: 'from' | 'to'): string | null => {
    const networks = getNetworksForAsset(symbol, direction);
    const networkData = networks.find(n => n.network === network);
    return networkData ? networkData.assetKey : null;
  }, [getNetworksForAsset]);

  // Function to get optimal exchanges array for RouterBuilder
  const getOptimalExchanges = useCallback((
    fromAssetKey: string,
    toAssetKey: string,
    fromChain: string,
    toChain: string
  ): TExchangeChain[] => {
    return getOptimalDEXArray(fromAssetKey, toAssetKey, fromChain, toChain);
  }, []); // Pure function, no dependencies

  // Function to validate exchange compatibility
  const validateExchangeCompatibility = useCallback((
    exchange: TExchangeChain,
    fromChain: string,
    toChain: string
  ): boolean => {
    const compatibleDEXs = getCompatibleDEXs(fromChain, toChain);
    return compatibleDEXs.includes(exchange);
  }, []); // Pure function, no dependencies

  return {
    // Original currency options (RouterBuilder compatibility)
    currencyFromOptions,
    currencyToOptions,
    currencyFromMap,
    currencyToMap,
    
    // New unified asset-network data
    unifiedFromAssets,
    unifiedToAssets,
    
    // Helper functions
    getTAssetFromKey,
    determineCurrency,
    getNetworksForAsset,
    getAssetKeyForNetwork,
    
    // DEX selection functions
    getOptimalExchanges,
    validateExchangeCompatibility,
  };
};


export default useAssetAggregator;
