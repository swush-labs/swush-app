'use client';

import { useMemo, useCallback, useEffect } from 'react';
import useAssetAggregator, { determineCurrency, type UnifiedAsset } from '@/services/xcm-router/useAssetAggregator';
import { EXCHANGE_CHAINS } from '@paraspell/xcm-router';
import type { TokenInfo } from '@/components/swap/types';
import { getEvmChainId } from '@/lib/config/kheopskit';
import {
  useFromTokenState,
  useToTokenState,
  useFromNetworkState,
  useToNetworkState
} from './utils/queryParams';

/**
 * Convert UnifiedAssets to TokenInfo array for UI compatibility
 * Each network instance becomes a separate TokenInfo entry
 * Supports both XCM (ParaSpell) and Chainflip networks
 */
function convertUnifiedAssetsToTokens(assets: UnifiedAsset[]): TokenInfo[] {
  const tokens: TokenInfo[] = [];

  assets.forEach(asset => {
    asset.supportedNetworks.forEach(network => {
      // Prioritize explicit registry decimals (for Chainflip + hybrid tokens),
      // fall back to ParaSpell decimals (for XCM-only tokens)
      const decimals = network.decimals
        ?? network.actualAsset?.decimals
        ?? (network.provider === 'chainflip' ? 18 : 10);

      // Derive EVM chain ID from network name (single source of truth in kheopskit.ts)
      const chainId = getEvmChainId(network.network);

      tokens.push({
        id: network.assetKey,
        name: asset.name,
        symbol: asset.symbol,
        icon: asset.symbol.charAt(0),
        decimals,
        network: network.network,
        assetKey: network.assetKey,
        networkChain: network.network,
        // Chainflip-specific fields (passed through for routing)
        provider: network.provider,
        chainflipId: network.chainflipId,
        contractAddress: network.contractAddress,
        assetId: network.assetId,
        // EVM chain identification (derived from network name for balance fetching)
        chainId,
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
 * Uses URL query params for state persistence and shareable links:
 * - /?from=DOT&to=USDC&fromNetwork=Polkadot&toNetwork=AssetHubPolkadot
 * 
 * @returns Token selection state and helpers for XCM routing
 */
export function useXcmTokens() {
  // ✅ URL state management with nuqs - single source of truth
  const [fromSymbol, setFromSymbol] = useFromTokenState();
  const [toSymbol, setToSymbol] = useToTokenState();
  const [fromNetwork, setFromNetwork] = useFromNetworkState();
  const [toNetwork, setToNetwork] = useToNetworkState();

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

  // ✅ Track initial loading state
  const isInitialLoad = useMemo(() => {
    return fromTokens.length === 0 || toTokens.length === 0;
  }, [fromTokens.length, toTokens.length]);

  // ✅ Derive inputToken from URL params (symbol + network)
  const inputToken = useMemo<TokenInfo | null>(() => {
    if (!fromSymbol || fromTokens.length === 0) return null;

    // If network specified, find exact match
    if (fromNetwork) {
      const exactMatch = fromTokens.find(t =>
        t.symbol === fromSymbol && t.networkChain === fromNetwork
      );
      if (exactMatch) return exactMatch;
    }

    // Otherwise, find first token with that symbol
    const firstMatch = fromTokens.find(t => t.symbol === fromSymbol);
    return firstMatch || null;
  }, [fromSymbol, fromNetwork, fromTokens]);

  // ✅ Derive outputToken from URL params (symbol + network)
  const outputToken = useMemo<TokenInfo | null>(() => {
    if (!toSymbol || toTokens.length === 0) return null;

    // If network specified, find exact match
    if (toNetwork) {
      const exactMatch = toTokens.find(t =>
        t.symbol === toSymbol && t.networkChain === toNetwork
      );
      if (exactMatch) return exactMatch;
    }

    // Otherwise, find first token with that symbol
    const firstMatch = toTokens.find(t => t.symbol === toSymbol);
    return firstMatch || null;
  }, [toSymbol, toNetwork, toTokens]);

  // ✅ Auto-select network when not specified in URL
  useEffect(() => {
    if (fromSymbol && !fromNetwork && fromTokens.length > 0) {
      const token = fromTokens.find(t => t.symbol === fromSymbol);
      if (token?.networkChain) {
        setFromNetwork(token.networkChain);
      }
    }
  }, [fromSymbol, fromNetwork, fromTokens, setFromNetwork]);

  useEffect(() => {
    if (toSymbol && !toNetwork && toTokens.length > 0) {
      const token = toTokens.find(t => t.symbol === toSymbol);
      if (token?.networkChain) {
        setToNetwork(token.networkChain);
      }
    }
  }, [toSymbol, toNetwork, toTokens, setToNetwork]);

  // ✅ Token setters that update URL params
  const handleSetInputToken = useCallback((token: TokenInfo) => {
    setFromSymbol(token.symbol);
    setFromNetwork(token.networkChain || '');
  }, [setFromSymbol, setFromNetwork]);

  const handleSetOutputToken = useCallback((token: TokenInfo) => {
    setToSymbol(token.symbol);
    setToNetwork(token.networkChain || '');
  }, [setToSymbol, setToNetwork]);

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
