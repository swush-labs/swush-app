'use client';

import { useMemo } from 'react';
import { useParaSpellBalances } from './useParaSpellBalances';
import { useEvmBalance, isEvmToken } from './useEvmBalance';
import { useSolanaBalance, isSolanaToken } from './useSolanaBalance';
import { usePolkadotTestnetBalance, isPolkadotTestnetToken } from './usePolkadotTestnetBalance';
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
 * - EVM tokens (Ethereum, Arbitrum, Sepolia): Uses wagmi useBalance/useReadContract
 * - Solana tokens (Solana, SolanaDevnet): Uses @solana/web3.js
 * - Polkadot testnet (AssetHubPerseverance): Uses PAPI unsafe API
 * - Polkadot XCM tokens: Uses ParaSpell SDK getAssetBalance
 *
 * The hook detects the token type and routes to the appropriate balance fetcher.
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
  
  const isInputSolanaToken = useMemo(() => isSolanaToken(inputToken), [inputToken]);
  const isOutputSolanaToken = useMemo(() => isSolanaToken(outputToken), [outputToken]);
  
  const isInputPolkadotTestnet = useMemo(() => isPolkadotTestnetToken(inputToken), [inputToken]);
  const isOutputPolkadotTestnet = useMemo(() => isPolkadotTestnetToken(outputToken), [outputToken]);

  // ParaSpell balances for XCM tokens
  const paraSpellBalances = useParaSpellBalances({
    isConnected,
    walletAddress,
    recipientAddress,
    // Only pass XCM tokens to ParaSpell (exclude EVM, Solana, and testnet)
    inputToken: (isInputEvmToken || isInputSolanaToken || isInputPolkadotTestnet) ? null : inputToken,
    outputToken: (isOutputEvmToken || isOutputSolanaToken || isOutputPolkadotTestnet) ? null : outputToken,
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

  // Solana balance for input token
  const solanaInputBalance = useSolanaBalance(
    isInputSolanaToken ? inputToken : null,
    walletAddress
  );

  // Solana balance for output token (uses recipient address)
  const solanaOutputBalance = useSolanaBalance(
    isOutputSolanaToken ? outputToken : null,
    recipientAddress || walletAddress
  );

  // Polkadot testnet balance for input token
  const testnetInputBalance = usePolkadotTestnetBalance(
    isInputPolkadotTestnet ? inputToken : null,
    walletAddress
  );

  // Polkadot testnet balance for output token (uses recipient address)
  const testnetOutputBalance = usePolkadotTestnetBalance(
    isOutputPolkadotTestnet ? outputToken : null,
    recipientAddress || walletAddress
  );

  // Combine balances based on token types (priority: EVM > Solana > Testnet > ParaSpell)
  const inputBalance = useMemo(() => {
    if (!isConnected || !inputToken) return '0';
    if (isInputEvmToken) return evmInputBalance.balance;
    if (isInputSolanaToken) return solanaInputBalance.balance;
    if (isInputPolkadotTestnet) return testnetInputBalance.balance;
    return paraSpellBalances.inputBalance;
  }, [
    isConnected, 
    inputToken, 
    isInputEvmToken, 
    isInputSolanaToken, 
    isInputPolkadotTestnet,
    evmInputBalance.balance, 
    solanaInputBalance.balance,
    testnetInputBalance.balance,
    paraSpellBalances.inputBalance
  ]);

  const outputBalance = useMemo(() => {
    if (!isConnected || !outputToken) return '0';
    if (isOutputEvmToken) return evmOutputBalance.balance;
    if (isOutputSolanaToken) return solanaOutputBalance.balance;
    if (isOutputPolkadotTestnet) return testnetOutputBalance.balance;
    return paraSpellBalances.outputBalance;
  }, [
    isConnected, 
    outputToken, 
    isOutputEvmToken, 
    isOutputSolanaToken, 
    isOutputPolkadotTestnet,
    evmOutputBalance.balance, 
    solanaOutputBalance.balance,
    testnetOutputBalance.balance,
    paraSpellBalances.outputBalance
  ]);

  const inputBalanceRaw = useMemo(() => {
    if (!isConnected || !inputToken) return '0';
    if (isInputEvmToken) return evmInputBalance.balanceRaw;
    if (isInputSolanaToken) return solanaInputBalance.balanceRaw;
    if (isInputPolkadotTestnet) return testnetInputBalance.balanceRaw;
    return paraSpellBalances.inputBalanceRaw;
  }, [
    isConnected, 
    inputToken, 
    isInputEvmToken, 
    isInputSolanaToken, 
    isInputPolkadotTestnet,
    evmInputBalance.balanceRaw, 
    solanaInputBalance.balanceRaw,
    testnetInputBalance.balanceRaw,
    paraSpellBalances.inputBalanceRaw
  ]);

  const outputBalanceRaw = useMemo(() => {
    if (!isConnected || !outputToken) return '0';
    if (isOutputEvmToken) return evmOutputBalance.balanceRaw;
    if (isOutputSolanaToken) return solanaOutputBalance.balanceRaw;
    if (isOutputPolkadotTestnet) return testnetOutputBalance.balanceRaw;
    return paraSpellBalances.outputBalanceRaw;
  }, [
    isConnected, 
    outputToken, 
    isOutputEvmToken, 
    isOutputSolanaToken, 
    isOutputPolkadotTestnet,
    evmOutputBalance.balanceRaw, 
    solanaOutputBalance.balanceRaw,
    testnetOutputBalance.balanceRaw,
    paraSpellBalances.outputBalanceRaw
  ]);

  // Combined loading state
  const isBalanceLoading = useMemo(() => {
    const inputLoading = isInputEvmToken ? evmInputBalance.isLoading : false;
    const outputLoading = isOutputEvmToken ? evmOutputBalance.isLoading : false;
    const inputSolanaLoading = isInputSolanaToken ? solanaInputBalance.isLoading : false;
    const outputSolanaLoading = isOutputSolanaToken ? solanaOutputBalance.isLoading : false;
    const inputTestnetLoading = isInputPolkadotTestnet ? testnetInputBalance.isLoading : false;
    const outputTestnetLoading = isOutputPolkadotTestnet ? testnetOutputBalance.isLoading : false;
    
    return (
      paraSpellBalances.isBalanceLoading || 
      inputLoading || 
      outputLoading || 
      inputSolanaLoading || 
      outputSolanaLoading ||
      inputTestnetLoading ||
      outputTestnetLoading
    );
  }, [
    isInputEvmToken, 
    isOutputEvmToken, 
    isInputSolanaToken, 
    isOutputSolanaToken,
    isInputPolkadotTestnet,
    isOutputPolkadotTestnet,
    evmInputBalance.isLoading, 
    evmOutputBalance.isLoading, 
    solanaInputBalance.isLoading,
    solanaOutputBalance.isLoading,
    testnetInputBalance.isLoading,
    testnetOutputBalance.isLoading,
    paraSpellBalances.isBalanceLoading
  ]);

  // Balances loaded state
  const balancesLoaded = useMemo(() => {
    // For EVM tokens, consider loaded when not loading
    const inputLoaded = isInputEvmToken
      ? !evmInputBalance.isLoading
      : isInputSolanaToken
      ? !solanaInputBalance.isLoading
      : isInputPolkadotTestnet
      ? !testnetInputBalance.isLoading
      : true;
      
    const outputLoaded = isOutputEvmToken
      ? !evmOutputBalance.isLoading
      : isOutputSolanaToken
      ? !solanaOutputBalance.isLoading
      : isOutputPolkadotTestnet
      ? !testnetOutputBalance.isLoading
      : true;

    return paraSpellBalances.balancesLoaded && inputLoaded && outputLoaded;
  }, [
    isInputEvmToken, 
    isOutputEvmToken, 
    isInputSolanaToken, 
    isOutputSolanaToken,
    isInputPolkadotTestnet,
    isOutputPolkadotTestnet,
    evmInputBalance.isLoading, 
    evmOutputBalance.isLoading, 
    solanaInputBalance.isLoading,
    solanaOutputBalance.isLoading,
    testnetInputBalance.isLoading,
    testnetOutputBalance.isLoading,
    paraSpellBalances.balancesLoaded
  ]);

  // Reset balances - handles all balance types
  const resetBalances = (afterSwap = false) => {
    // ParaSpell handles its own reset
    paraSpellBalances.resetBalances(afterSwap);

    // For all other token types, trigger refetch
    if (afterSwap) {
      if (isInputEvmToken) {
        evmInputBalance.refetch();
      }
      if (isOutputEvmToken) {
        evmOutputBalance.refetch();
      }
      if (isInputSolanaToken) {
        solanaInputBalance.refetch();
      }
      if (isOutputSolanaToken) {
        solanaOutputBalance.refetch();
      }
      if (isInputPolkadotTestnet) {
        testnetInputBalance.refetch();
      }
      if (isOutputPolkadotTestnet) {
        testnetOutputBalance.refetch();
      }
    }
  };

  // Refresh balances
  const refreshBalances = async (afterSwap = false) => {
    // Refresh ParaSpell balances
    await paraSpellBalances.refreshBalances(afterSwap);

    // Refresh all other balance types
    if (isInputEvmToken) {
      await evmInputBalance.refetch();
    }
    if (isOutputEvmToken) {
      await evmOutputBalance.refetch();
    }
    if (isInputSolanaToken) {
      await solanaInputBalance.refetch();
    }
    if (isOutputSolanaToken) {
      await solanaOutputBalance.refetch();
    }
    if (isInputPolkadotTestnet) {
      await testnetInputBalance.refetch();
    }
    if (isOutputPolkadotTestnet) {
      await testnetOutputBalance.refetch();
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
