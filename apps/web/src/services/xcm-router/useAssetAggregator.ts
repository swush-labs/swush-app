'use client';

import { useMemo, useCallback } from "react";
import useCurrencyOptions from "./useCurrencyOptions";
import { type AssetRegistryEntry, ASSET_REGISTRY, DEX_CHAIN_COMPATIBILITY } from "./assetRegistry";
import { getCompatibleDEXs, getOptimalDEXArray } from "./assetRegistryUtils";
import {
  type TChain,
  type TAssetInfo,
  type TCurrencyInput,
  CHAINS
} from "@paraspell/sdk";
import type { TExchangeChain } from "@paraspell/xcm-router";

// Unified asset-network data structure
export type UnifiedAsset = {
  symbol: string;
  name: string;
  category: string;
  description?: string;
  // Pre-computed networks that support this asset
  supportedNetworks: Array<{
    network: string;
    assetKey: string;
    displayName: string;
    assetType: string;
    verified: boolean;
    actualAsset: TAssetInfo;
  }>;
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

// Create unified network data for an asset
const createUnifiedNetworkData = (
  key: string,
  registryEntry: AssetRegistryEntry,
  actualAsset: TAssetInfo
) => {
  const registryInstance = registryEntry.networkInstances[key];
    //TODO: validation is already done in the useCurrencyOptions hook

  return {
    network: registryInstance?.network || "Unknown",
    assetKey: key,
    displayName: registryInstance?.displayName || `${actualAsset.symbol} (${registryInstance?.network || "Unknown"})`,
    assetType: registryInstance?.assetType || "Unknown",
    verified: registryInstance?.verified || false,
    actualAsset,
  };
};

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
  // Create unified asset-network structure for FROM assets (registry-first)
  const unifiedFromAssets = useMemo(() => {
    const assetMap = new Map<string, UnifiedAsset>();

    // Process registry assets first, then validate with ParaSpell data
    Object.values(ASSET_REGISTRY).forEach(registryEntry => {
      const symbol = registryEntry.symbol;
      
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
      
      // Only include networks that exist in ParaSpell data
      Object.entries(registryEntry.networkInstances).forEach(([key, networkInstance]) => {
        const actualAsset = currencyFromMap[key];
        
        if (actualAsset && registryMetadata.expectedAssetKeys.has(key)) {
          const networkData = createUnifiedNetworkData(key, registryEntry, actualAsset);
          asset.supportedNetworks.push(networkData);
          
          if (networkInstance.verified) {
            asset.validNetworks++;
          }
        }
      });
      
      // Mark asset as valid if it has at least one verified network
      asset.isValid = asset.validNetworks > 0;
    });

    return Array.from(assetMap.values())
      .filter(asset => asset.supportedNetworks.length > 0) // Only include assets with validated networks
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [currencyFromMap, registryMetadata.expectedAssetKeys]);

  // Create unified asset-network structure for TO assets (registry-first)
  const unifiedToAssets = useMemo(() => {
    const assetMap = new Map<string, UnifiedAsset>();

    // Process registry assets first, then validate with ParaSpell data
    Object.values(ASSET_REGISTRY).forEach(registryEntry => {
      const symbol = registryEntry.symbol;
      
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
      
      // Only include networks that exist in ParaSpell data
      Object.entries(registryEntry.networkInstances).forEach(([key, networkInstance]) => {
        const actualAsset = currencyToMap[key];
        
        if (actualAsset && registryMetadata.expectedAssetKeys.has(key)) {
          const networkData = createUnifiedNetworkData(key, registryEntry, actualAsset);
          asset.supportedNetworks.push(networkData);
          
          if (networkInstance.verified) {
            asset.validNetworks++;
          }
        }
      });
      
      // Mark asset as valid if it has at least one verified network
      asset.isValid = asset.validNetworks > 0;
    });

    return Array.from(assetMap.values())
      .filter(asset => asset.supportedNetworks.length > 0) // Only include assets with validated networks
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [currencyToMap, registryMetadata.expectedAssetKeys]);

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
    
    // Backward compatibility
    aggregatedFromAssets: unifiedFromAssets,
    aggregatedToAssets: unifiedToAssets,
    registeredFromAssets: unifiedFromAssets,
    unregisteredFromAssets: [],
    registeredToAssets: unifiedToAssets,
    unregisteredToAssets: [],
  };
};


export default useAssetAggregator;

