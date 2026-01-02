'use client';

import { useMemo } from 'react';
import { useBalance, useReadContract } from 'wagmi';
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
 * Check if we're in testnet mode
 */
const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === 'true';

/**
 * Hook to fetch EVM token balance using wagmi
 *
 * Supports:
 * - Native ETH balances (on Ethereum, Arbitrum)
 * - ERC20 token balances (USDC, USDT, FLIP, etc.)
 * - Automatic testnet detection via NEXT_PUBLIC_USE_TESTNET
 *
 * @param token - TokenInfo with chainId, contractAddress, decimals
 * @param userAddress - User's EVM wallet address (0x...)
 * @returns Balance data with formatted values, loading and error states
 */
export function useEvmBalance(
  token: TokenInfo | null,
  userAddress: string | undefined
) {
  // Determine the correct chain ID based on testnet mode
  const chainId = useMemo(() => {
    if (!token) return undefined;
    return isTestnet ? token.testnetChainId : token.chainId;
  }, [token]);

  // Determine the correct contract address based on testnet mode
  const contractAddress = useMemo(() => {
    if (!token) return undefined;
    return isTestnet ? token.testnetContractAddress : token.contractAddress;
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

  // Native ETH balance (useBalance for native tokens)
  const nativeBalance = useBalance({
    address: userAddress as `0x${string}`,
    chainId: chainId,
    query: {
      enabled: isEnabled && isNativeToken,
    },
  });

  // ERC20 token balance (useReadContract for ERC20 tokens)
  const tokenBalance = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: erc20BalanceOfAbi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    chainId: chainId,
    query: {
      enabled: isEnabled && !isNativeToken && !!contractAddress,
    },
  });

  // Format the balance
  const formattedBalance = useMemo(() => {
    if (!token) {
      return { raw: '0', decimal: '0' };
    }

    let rawBalance: bigint | undefined;

    if (isNativeToken) {
      rawBalance = nativeBalance.data?.value;
    } else {
      rawBalance = tokenBalance.data as bigint | undefined;
    }

    if (rawBalance === undefined) {
      return { raw: '0', decimal: '0' };
    }

    return formatAmount(rawBalance.toString(), token.decimals, NUMBER_FORMAT_OPTIONS);
  }, [token, isNativeToken, nativeBalance.data?.value, tokenBalance.data]);

  // Determine loading and error states
  const isLoading = isNativeToken ? nativeBalance.isLoading : tokenBalance.isLoading;
  const isFetching = isNativeToken ? nativeBalance.isFetching : tokenBalance.isFetching;
  const error = isNativeToken ? nativeBalance.error : tokenBalance.error;

  // Refetch function
  const refetch = () => {
    if (isNativeToken) {
      return nativeBalance.refetch();
    } else {
      return tokenBalance.refetch();
    }
  };

  return {
    // Formatted balance for display
    balance: formattedBalance.decimal,
    // Raw balance as string (for calculations)
    balanceRaw: formattedBalance.raw,
    // Loading states
    isLoading,
    isFetching,
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
  const chainId = isTestnet ? token.testnetChainId : token.chainId;
  return !!chainId;
}

export default useEvmBalance;
