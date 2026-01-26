'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getBalance, readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/config/wagmi';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';
import type { TokenInfo } from '@/components/swap/types';

// Minimal ERC20 ABI for balanceOf function
const erc20BalanceOfAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;


/**
 * Hook to fetch EVM token balance using wagmi actions (no React Query required)
 *
 * Supports:
 * - Native ETH balances (on Ethereum, Sepolia, Arbitrum)
 * - ERC20 token balances (USDC, USDT, FLIP, etc.)
 * - Network selection handled by asset registry (separate Ethereum/Sepolia instances)
 *
 * @param token - TokenInfo with chainId, contractAddress, decimals
 * @param userAddress - User's EVM wallet address (0x...)
 * @returns Balance data with formatted values, loading and error states
 */
export function useEvmBalance(
  token: TokenInfo | null,
  userAddress: string | undefined
) {
  const [balance, setBalance] = useState<string>('0');
  const [balanceRaw, setBalanceRaw] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Use the chain ID from token (asset registry provides correct instance)
  const chainId = useMemo(() => {
    return token?.chainId;
  }, [token]);

  // Use the contract address from token (asset registry provides correct instance)
  const contractAddress = useMemo(() => {
    return token?.contractAddress;
  }, [token]);

  // Check if this is a native token (ETH) or ERC20
  const isNativeToken = useMemo(() => {
    // Native tokens don't have a contract address
    // ETH on Ethereum (eth.eth), ETH on Arbitrum (eth.arb)
    return !contractAddress && token?.chainflipId?.startsWith('eth.');
  }, [contractAddress, token?.chainflipId]);

  // Validate inputs
  const isValidAddress = useMemo(() => {
    return userAddress && /^0x[a-fA-F0-9]{40}$/.test(userAddress);
  }, [userAddress]);

  const isEnabled = useMemo(() => {
    return !!token && !!chainId && !!isValidAddress;
  }, [token, chainId, isValidAddress]);

  // Fetch balance function
  const fetchBalance = useCallback(async () => {
    if (!isEnabled || !token || !chainId || !userAddress) {
      setBalance('0');
      setBalanceRaw('0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let rawBalance: bigint;

      if (isNativeToken) {
        // Fetch native ETH balance
        const result = await getBalance(wagmiConfig, {
          address: userAddress as `0x${string}`,
          chainId: chainId as any,
        });
        rawBalance = result.value;
      } else if (contractAddress) {
        // Fetch ERC20 token balance
        rawBalance = await readContract(wagmiConfig, {
          address: contractAddress as `0x${string}`,
          abi: erc20BalanceOfAbi,
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
          chainId: chainId as any,
        });
      } else {
        // No contract address and not native token
        setBalance('0');
        setBalanceRaw('0');
        setIsLoading(false);
        return;
      }

      // Format the balance
      const formatted = formatAmount(rawBalance.toString(), token.decimals, NUMBER_FORMAT_OPTIONS);
      setBalance(formatted.decimal);
      setBalanceRaw(formatted.raw);
    } catch (err) {
      console.error('Error fetching EVM balance:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'));
      setBalance('0');
      setBalanceRaw('0');
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, token, chainId, userAddress, isNativeToken, contractAddress]);

  // Fetch balance when dependencies change
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    return fetchBalance();
  }, [fetchBalance]);

  return {
    // Formatted balance for display
    balance,
    // Raw balance as string (for calculations)
    balanceRaw,
    // Loading state
    isLoading,
    // Error state
    error,
    // Whether this is an EVM token with valid chainId
    isEvmToken: !!chainId,
    // Refetch function for manual refresh
    refetch,
  };
}

/**
 * Check if a token is an EVM token that can use useEvmBalance
 * @param token - TokenInfo to check
 * @returns true if the token has a chainId (EVM compatible)
 */
export function isEvmToken(token: TokenInfo | null): boolean {
  if (!token) return false;
  return !!token.chainId;
}

export default useEvmBalance;
