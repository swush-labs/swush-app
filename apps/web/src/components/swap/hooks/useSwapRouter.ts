import { useMemo } from 'react';
import type { TAssetInfo } from '@paraspell/sdk';
import type { TExchangeChain } from '@paraspell/xcm-router';

import type { TokenInfo } from '@/components/swap/types';
import type { FeeSummary } from '@/services/xcm-router/feeCalculator';
import { getSwapProvider, type SwapProvider } from '@/services/xcm-router/assetRegistry';
import { useXcmRoute, type RouteState } from './useXcmRoute';
import { useChainflipRoute, type ChainflipRouteState } from './useChainflipRoute';
import type { ChainflipQuote } from '@/services/chainflip';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Props for useSwapRouter hook
 */
interface UseSwapRouterProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress?: string;
  recipientAddress?: string;
  slippageTolerance?: number;

  // Helper functions from useXcmTokens (required for XCM routes)
  getOptimalExchanges: (
    fromKey: string,
    toKey: string,
    fromChain: string,
    toChain: string
  ) => TExchangeChain[];

  determineCurrency: (asset: TAssetInfo) => unknown;

  getTAssetFromKey: (
    key: string,
    direction: 'from' | 'to'
  ) => TAssetInfo | undefined;
}

/**
 * Unified route state that works for both XCM and Chainflip
 */
export interface UnifiedRouteState {
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
}

/**
 * Return type for useSwapRouter hook
 */
interface UseSwapRouterReturn {
  // Provider information
  provider: SwapProvider;
  providerLabel: string;

  // Unified route data
  outputAmount: string;
  estimatedFees: string;
  estimatedDuration?: string;  // Only available for Chainflip
  routeState: UnifiedRouteState;
  isLoadingQuote: boolean;
  isProcessing: boolean;

  // Provider-specific data (for execution)
  xcmRouteState?: RouteState;
  xcmRouteDex?: string;
  xcmFeeBreakdown?: FeeSummary;
  chainflipQuote?: ChainflipQuote | null;
  chainflipRouteState?: ChainflipRouteState;

  // Actions
  debouncedFetchRoute: ((amount: string) => void) & { cancel: () => void };
  resetRoute: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unified Swap Router Hook
 * 
 * Automatically routes swaps to the appropriate provider:
 * - XCM Router: For Polkadot ecosystem swaps (AssetHub, Hydration, etc.)
 * - Chainflip: For cross-chain swaps involving Ethereum, Arbitrum, Solana, Bitcoin
 * 
 * Provides a unified interface for:
 * - Quote fetching
 * - Fee estimation
 * - Route state management
 * 
 * @param props - Hook configuration
 * @returns Unified route state and provider-specific data for execution
 */
export function useSwapRouter({
  inputToken,
  outputToken,
  walletAddress,
  recipientAddress,
  slippageTolerance = 1,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
}: UseSwapRouterProps): UseSwapRouterReturn {

  // Determine which provider to use based on token configuration
  // Priority: If either token explicitly has provider='chainflip', use Chainflip
  // Otherwise, fall back to network-based detection
  const provider = useMemo((): SwapProvider => {
    // Check if tokens have explicit provider set
    if (inputToken?.provider === 'chainflip' || outputToken?.provider === 'chainflip') {
      return 'chainflip';
    }
    // Fall back to network-based detection
    return getSwapProvider(inputToken?.network, outputToken?.network);
  }, [inputToken?.provider, inputToken?.network, outputToken?.provider, outputToken?.network]);

  // XCM Route Hook (only active when provider is 'xcm')
  const xcmRoute = useXcmRoute({
    inputToken: provider === 'xcm' ? inputToken : null,
    outputToken: provider === 'xcm' ? outputToken : null,
    walletAddress,
    recipientAddress,
    slippageTolerance,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
  });

  // Chainflip Route Hook (only active when provider is 'chainflip')
  const chainflipRoute = useChainflipRoute({
    inputToken: provider === 'chainflip' ? inputToken : null,
    outputToken: provider === 'chainflip' ? outputToken : null,
    walletAddress,
  });

  // Unified route state
  const routeState: UnifiedRouteState = useMemo(() => {
    if (provider === 'chainflip') {
      return {
        isLoading: chainflipRoute.routeState.isLoading,
        error: chainflipRoute.routeState.error,
        hasData: chainflipRoute.routeState.data !== null,
      };
    }
    return {
      isLoading: xcmRoute.routeState.isLoading,
      error: xcmRoute.routeState.error,
      hasData: xcmRoute.routeState.data !== null,
    };
  }, [provider, xcmRoute.routeState, chainflipRoute.routeState]);

  // Provider label for UI display
  const providerLabel = useMemo(() => {
    if (provider === 'chainflip') {
      return 'via Chainflip';
    }
    // For XCM, show the DEX being used
    if (xcmRoute.routeDex) {
      return `via ${xcmRoute.routeDex}`;
    }
    return 'via XCM Router';
  }, [provider, xcmRoute.routeDex]);

  // Unified output amount
  const outputAmount = provider === 'chainflip' 
    ? chainflipRoute.outputAmount 
    : xcmRoute.outputAmount;

  // Unified estimated fees
  const estimatedFees = provider === 'chainflip'
    ? chainflipRoute.estimatedFees
    : xcmRoute.estimatedFees;

  // Estimated duration (Chainflip only)
  const estimatedDuration = provider === 'chainflip'
    ? chainflipRoute.estimatedDuration
    : undefined;

  // Loading states
  const isLoadingQuote = provider === 'chainflip'
    ? chainflipRoute.isLoadingQuote
    : xcmRoute.isLoadingQuote;

  const isProcessing = provider === 'chainflip'
    ? chainflipRoute.isProcessing
    : xcmRoute.isProcessing;

  // Unified fetch route function
  const debouncedFetchRoute = useMemo(() => {
    if (provider === 'chainflip') {
      return chainflipRoute.debouncedFetchRoute;
    }
    return xcmRoute.debouncedFetchRoute;
  }, [provider, chainflipRoute.debouncedFetchRoute, xcmRoute.debouncedFetchRoute]);

  // Unified reset function
  const resetRoute = useMemo(() => {
    if (provider === 'chainflip') {
      return chainflipRoute.resetRoute;
    }
    return xcmRoute.resetRoute;
  }, [provider, chainflipRoute.resetRoute, xcmRoute.resetRoute]);

  return {
    // Provider information
    provider,
    providerLabel,

    // Unified route data
    outputAmount,
    estimatedFees,
    estimatedDuration,
    routeState,
    isLoadingQuote,
    isProcessing,

    // Provider-specific data (for execution)
    xcmRouteState: provider === 'xcm' ? xcmRoute.routeState : undefined,
    xcmRouteDex: provider === 'xcm' ? xcmRoute.routeDex : undefined,
    xcmFeeBreakdown: provider === 'xcm' ? xcmRoute.feeBreakdown : undefined,
    chainflipQuote: provider === 'chainflip' ? chainflipRoute.quote : undefined,
    chainflipRouteState: provider === 'chainflip' ? chainflipRoute.routeState : undefined,

    // Actions
    debouncedFetchRoute,
    resetRoute,
  };
}

