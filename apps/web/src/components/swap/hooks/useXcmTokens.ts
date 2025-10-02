'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import useAssetAggregator, { determineCurrency, type UnifiedAsset } from '@/services/xcm-router/useAssetAggregator';
import { EXCHANGE_CHAINS } from '@paraspell/xcm-router';
import type { TokenInfo } from '@/components/swap/types';

/**
 * Convert UnifiedAssets to TokenInfo array for UI compatibility
 * Each network instance becomes a separate TokenInfo entry
 */
function convertUnifiedAssetsToTokens(assets: UnifiedAsset[]): TokenInfo[] {
  const tokens: TokenInfo[] = [];
  
  assets.forEach(asset => {
    asset.supportedNetworks.forEach(network => {
      tokens.push({
        id: network.assetKey,
        name: asset.name,
        symbol: asset.symbol,
        icon: asset.symbol.charAt(0),
        decimals: network.actualAsset.decimals || 10,
        network: network.network,
        assetKey: network.assetKey,
        networkChain: network.network,
      });
    });
  });
  
  return tokens;
}

/**
 * XCM-powered token selection hook using ParaSpell SDK
 * 
 * Provides SEPARATE from/to token lists for correct routing
 * - fromTokens: Networks where you can START a swap (source chains)
 * - toTokens: Networks where you can END a swap (destination chains)
 * 
 * @returns Token selection state and helpers for XCM routing
 */
export function useXcmTokens() {
  // Selected tokens state
  const [inputToken, setInputToken] = useState<TokenInfo | null>(null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ✅ Memoize the exchange chains array to prevent infinite re-renders
  const exchangeChains = useMemo(() => [...EXCHANGE_CHAINS], []);

  // Initialize asset aggregator with all exchange chains
  const {
    unifiedFromAssets,
    unifiedToAssets,
    getTAssetFromKey,
    getAssetKeyForNetwork,
    getOptimalExchanges,
    currencyFromMap,
    currencyToMap,
  } = useAssetAggregator(undefined, exchangeChains, undefined);

  // ✅ SEPARATE LISTS: Convert from/to assets independently
  const fromTokens = useMemo<TokenInfo[]>(() => {
    return convertUnifiedAssetsToTokens(unifiedFromAssets);
  }, [unifiedFromAssets]);

  const toTokens = useMemo<TokenInfo[]>(() => {
    return convertUnifiedAssetsToTokens(unifiedToAssets);
  }, [unifiedToAssets]);

  // Track when assets have loaded for the first time
  useEffect(() => {
    if (isInitialLoad && fromTokens.length > 0 && toTokens.length > 0) {
      setIsInitialLoad(false);
    }
  }, [fromTokens.length, toTokens.length, isInitialLoad]);

  // Auto-select default tokens from correct lists when assets load
  useEffect(() => {
    if (fromTokens.length > 0 && !inputToken) {
      // Find DOT as input token (common default)
      const dotToken = fromTokens.find(t => t.symbol === 'DOT');
      if (dotToken) {
        setInputToken(dotToken);
      }
    }

    if (toTokens.length > 0 && !outputToken) {
      // Find USDC as output token (common default)
      const usdcToken = toTokens.find(t => t.symbol === 'USDC');
      if (usdcToken) {
        setOutputToken(usdcToken);
      }
    }
  }, [fromTokens, toTokens, inputToken, outputToken]);
  
  const handleSetInputToken = useCallback((token: TokenInfo) => {
    setInputToken(token);
  }, []);

  const handleSetOutputToken = useCallback((token: TokenInfo) => {
    setOutputToken(token);
  }, []);

  return {
    inputToken,
    outputToken,
    // ✅ NEW: Separate token lists for input/output fields
    fromTokens,
    toTokens,
    setInputToken: handleSetInputToken,
    setOutputToken: handleSetOutputToken,
    // ✅ Loading state
    isInitialLoad,
    // Expose helpers for Phase 2 routing
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    // For debugging/inspection
    unifiedFromAssets,
    unifiedToAssets,
  };
}
