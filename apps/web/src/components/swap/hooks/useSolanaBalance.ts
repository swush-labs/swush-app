'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';
import type { TokenInfo } from '@/components/swap/types';

/**
 * Hook to fetch Solana token balances (native SOL and SPL tokens)
 *
 * Supports:
 * - Native SOL balances (Solana Mainnet and Devnet)
 * - SPL token balances (USDC, etc.)
 * - Network selection from asset registry (Solana vs SolanaDevnet)
 *
 * @param token - TokenInfo with network, contractAddress (mint for SPL), decimals
 * @param userAddress - User's Solana wallet address (base58)
 * @returns Balance data with formatted values, loading and error states
 */
export function useSolanaBalance(
  token: TokenInfo | null,
  userAddress: string | undefined
) {
  const [balance, setBalance] = useState<string>('0');
  const [balanceRaw, setBalanceRaw] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Determine RPC URL based on network
  const rpcUrl = useMemo(() => {
    if (!token?.network) return 'https://api.mainnet-beta.solana.com';
    
    // Solana Devnet
    if (token.network.includes('Devnet')) {
      return 'https://api.devnet.solana.com';
    }
    
    // Solana Mainnet (default)
    return 'https://api.mainnet-beta.solana.com';
  }, [token?.network]);

  // Check if this is a native token (SOL) or SPL token
  const isNativeToken = useMemo(() => {
    // Native SOL doesn't have a contract address (mint address)
    return !token?.contractAddress && token?.symbol === 'SOL';
  }, [token?.contractAddress, token?.symbol]);

  // Validate inputs
  const isValidAddress = useMemo(() => {
    // Basic Solana address validation (base58, typically 32-44 chars)
    return userAddress && userAddress.length >= 32 && userAddress.length <= 44;
  }, [userAddress]);

  const isEnabled = useMemo(() => {
    return !!token && !!isValidAddress;
  }, [token, isValidAddress]);

  // Fetch balance function
  const fetchBalance = useCallback(async () => {
    if (!isEnabled || !token || !userAddress) {
      setBalance('0');
      setBalanceRaw('0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid bundling issues
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = new Connection(rpcUrl, 'confirmed');

      let rawBalance: bigint;

      if (isNativeToken) {
        // Fetch native SOL balance
        const pubkey = new PublicKey(userAddress);
        const lamports = await connection.getBalance(pubkey);
        rawBalance = BigInt(lamports);

        console.log('📊 Solana balance fetched:', {
          network: token.network,
          address: userAddress,
          lamports: lamports.toString(),
          sol: (lamports / LAMPORTS_PER_SOL).toString(),
        });
      } else if (token.contractAddress) {
        // Fetch SPL token balance
        const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
        
        const ownerPubkey = new PublicKey(userAddress);
        const mintPubkey = new PublicKey(token.contractAddress);
        
        try {
          // Get associated token account address
          const tokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            ownerPubkey
          );
          
          // Get token account
          const tokenAccount = await getAccount(connection, tokenAccountAddress);
          rawBalance = tokenAccount.amount;

          console.log('📊 SPL token balance fetched:', {
            network: token.network,
            token: token.symbol,
            mint: token.contractAddress,
            address: userAddress,
            balance: rawBalance.toString(),
          });
        } catch (accountError) {
          // Token account doesn't exist yet (no balance)
          console.log('ℹ️ SPL token account not found, balance is 0');
          rawBalance = BigInt(0);
        }
      } else {
        // No contract address and not native token
        throw new Error('Invalid Solana token configuration');
      }

      // Format balance
      const decimals = token.decimals || 9;
      const formatted = formatAmount(
        rawBalance.toString(),
        decimals,
        NUMBER_FORMAT_OPTIONS
      );

      setBalance(formatted.decimal);
      setBalanceRaw(formatted.raw);
    } catch (err) {
      console.error('❌ Solana balance fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch Solana balance'));
      setBalance('0');
      setBalanceRaw('0');
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, token, userAddress, rpcUrl, isNativeToken]);

  // Fetch balance on mount and when dependencies change
  useEffect(() => {
    if (isEnabled) {
      fetchBalance();
    } else {
      setBalance('0');
      setBalanceRaw('0');
      setIsLoading(false);
    }
  }, [isEnabled, fetchBalance]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (isEnabled) {
      await fetchBalance();
    }
  }, [isEnabled, fetchBalance]);

  return {
    balance,
    balanceRaw,
    isLoading,
    error,
    refetch,
    // Whether this is a Solana token
    isSolanaToken: !!token?.network?.includes('Solana'),
  };
}

/**
 * Helper function to check if a token is a Solana token
 * @returns true if the token is on a Solana network
 */
export function isSolanaToken(token: TokenInfo | null): boolean {
  return !!token?.network?.includes('Solana');
}

