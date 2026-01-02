'use client';

import { useMemo } from 'react';
import { useParaSpellBalances } from './useParaSpellBalances';
import { useEvmBalance, isEvmToken } from './useEvmBalance';
import type { TokenInfo } from '@/components/swap/types';

interface UseUnifiedBalancesProps {
  isConnected: boolean;
  walletAddress: string;
  recipientAddress?: string;
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  determineCurrency: (asset: any) => any;
  getTAssetFromKey: (assetKey: string, context: 'from' | 'to') => any;
}

interface UseUnifiedBalancesReturn {
  inputBalance: string;
  outputBalance: string;
  inputBalanceRaw: string;
  outputBalanceRaw: string;
  isBalanceLoading: boolean;
  balancesLoaded: boolean;
  resetBalances: (afterSwap?: boolean) => void;
  refreshBalances: (afterSwap?: boolean) => Promise<void>;
  startBalancePolling: (onBalanceIncreased: (newBalance: string, oldBalance: string) => void) => void;
  stopBalancePolling: () => void;
}

/**
 * Unified balance hook that automatically routes to the correct balance source:
 * - EVM tokens (Ethereum, Arbitrum): Uses wagmi useBalance/useReadContract
 * - Polkadot tokens (XCM): Uses ParaSpell SDK getAssetBalance
 *
 * The hook detects the token type based on chainId presence and uses the appropriate method.
 */
export function useUnifiedBalances({
  isConnected,
  walletAddress,
  recipientAddress,
  inputToken,
  outputToken,
  determineCurrency,
  getTAssetFromKey,
}: UseUnifiedBalancesProps): UseUnifiedBalancesReturn {
  // Detect token types
  const isInputEvmToken = useMemo(() => isEvmToken(inputToken), [inputToken]);
  const isOutputEvmToken = useMemo(() => isEvmToken(outputToken), [outputToken]);

  // ParaSpell balances for XCM tokens
  const paraSpellBalances = useParaSpellBalances({
    isConnected,
    walletAddress,
    recipientAddress,
    // Only pass non-EVM tokens to ParaSpell
    inputToken: isInputEvmToken ? null : inputToken,
    outputToken: isOutputEvmToken ? null : outputToken,
    determineCurrency,
    getTAssetFromKey,
  });

  // EVM balance for input token
  const evmInputBalance = useEvmBalance(
    isInputEvmToken ? inputToken : null,
    walletAddress
  );

  // EVM balance for output token (uses recipient address)
  const evmOutputBalance = useEvmBalance(
    isOutputEvmToken ? outputToken : null,
    recipientAddress || walletAddress
  );

  // Combine balances based on token types
  const inputBalance = useMemo(() => {
    if (!isConnected || !inputToken) return '0';
    return isInputEvmToken ? evmInputBalance.balance : paraSpellBalances.inputBalance;
  }, [isConnected, inputToken, isInputEvmToken, evmInputBalance.balance, paraSpellBalances.inputBalance]);

  const outputBalance = useMemo(() => {
    if (!isConnected || !outputToken) return '0';
    return isOutputEvmToken ? evmOutputBalance.balance : paraSpellBalances.outputBalance;
  }, [isConnected, outputToken, isOutputEvmToken, evmOutputBalance.balance, paraSpellBalances.outputBalance]);

  const inputBalanceRaw = useMemo(() => {
    if (!isConnected || !inputToken) return '0';
    return isInputEvmToken ? evmInputBalance.balanceRaw : paraSpellBalances.inputBalanceRaw;
  }, [isConnected, inputToken, isInputEvmToken, evmInputBalance.balanceRaw, paraSpellBalances.inputBalanceRaw]);

  const outputBalanceRaw = useMemo(() => {
    if (!isConnected || !outputToken) return '0';
    return isOutputEvmToken ? evmOutputBalance.balanceRaw : paraSpellBalances.outputBalanceRaw;
  }, [isConnected, outputToken, isOutputEvmToken, evmOutputBalance.balanceRaw, paraSpellBalances.outputBalanceRaw]);

  // Combined loading state
  const isBalanceLoading = useMemo(() => {
    const inputLoading = isInputEvmToken ? evmInputBalance.isLoading : false;
    const outputLoading = isOutputEvmToken ? evmOutputBalance.isLoading : false;
    return paraSpellBalances.isBalanceLoading || inputLoading || outputLoading;
  }, [isInputEvmToken, isOutputEvmToken, evmInputBalance.isLoading, evmOutputBalance.isLoading, paraSpellBalances.isBalanceLoading]);

  // Balances loaded state
  const balancesLoaded = useMemo(() => {
    // For EVM tokens, consider loaded when not loading and no error
    const inputLoaded = isInputEvmToken
      ? !evmInputBalance.isLoading
      : true;
    const outputLoaded = isOutputEvmToken
      ? !evmOutputBalance.isLoading
      : true;

    return paraSpellBalances.balancesLoaded && inputLoaded && outputLoaded;
  }, [isInputEvmToken, isOutputEvmToken, evmInputBalance.isLoading, evmOutputBalance.isLoading, paraSpellBalances.balancesLoaded]);

  // Reset balances - handles both EVM and XCM
  const resetBalances = (afterSwap = false) => {
    // ParaSpell handles its own reset
    paraSpellBalances.resetBalances(afterSwap);

    // For EVM tokens, trigger refetch
    if (afterSwap) {
      if (isInputEvmToken) {
        evmInputBalance.refetch();
      }
      if (isOutputEvmToken) {
        evmOutputBalance.refetch();
      }
    }
  };

  // Refresh balances
  const refreshBalances = async (afterSwap = false) => {
    // Refresh ParaSpell balances
    await paraSpellBalances.refreshBalances(afterSwap);

    // Refresh EVM balances
    if (isInputEvmToken) {
      await evmInputBalance.refetch();
    }
    if (isOutputEvmToken) {
      await evmOutputBalance.refetch();
    }
  };

  return {
    inputBalance,
    outputBalance,
    inputBalanceRaw,
    outputBalanceRaw,
    isBalanceLoading,
    balancesLoaded,
    resetBalances,
    refreshBalances,
    // Balance polling is only used for XCM (cross-chain delivery tracking)
    // Chainflip handles its own status updates via polling
    startBalancePolling: paraSpellBalances.startBalancePolling,
    stopBalancePolling: paraSpellBalances.stopBalancePolling,
  };
}

export default useUnifiedBalances;
