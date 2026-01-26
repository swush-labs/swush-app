'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';
import type { TokenInfo } from '@/components/swap/types';

/**
 * Hook to fetch Polkadot testnet balances (AssetHub Perseverance)
 *
 * Uses PAPI unsafe API since no typed descriptor is available for testnet.
 *
 * Supports:
 * - Native DOT balances
 * - Asset balances (USDC, USDT via Assets pallet)
 *
 * @param token - TokenInfo with network, assetId, decimals
 * @param userAddress - User's Polkadot wallet address (SS58)
 * @returns Balance data with formatted values, loading and error states
 */
export function usePolkadotTestnetBalance(
  token: TokenInfo | null,
  userAddress: string | undefined
) {
  const [balance, setBalance] = useState<string>('0');
  const [balanceRaw, setBalanceRaw] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket URL for AssetHub Perseverance testnet
  const wsUrl = 'wss://assethub.perseverance.chainflip.io';

  // Check if this is a native token (DOT) or asset
  const isNativeToken = useMemo(() => {
    // Native DOT doesn't have an assetId
    return !token?.assetId && token?.symbol === 'DOT';
  }, [token?.assetId, token?.symbol]);

  // Validate inputs
  const isValidAddress = useMemo(() => {
    // Basic Substrate address validation (starts with 1, 5, or other prefix)
    return userAddress && userAddress.length >= 47 && userAddress.length <= 48;
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

    let client: ReturnType<typeof createClient> | null = null;

    try {
      // Create WebSocket provider
      const wsProvider = getWsProvider(wsUrl);
      
      // Create client
      client = createClient(wsProvider);
      
      // Use unsafe API for testnet (no typed descriptor)
      const unsafeApi = client.getUnsafeApi();
      
      let rawBalance: bigint;

      if (isNativeToken) {
        // Fetch native DOT balance using System.Account query
        console.log('📊 Fetching DOT balance for:', userAddress);
        
        const accountInfo = await unsafeApi.query.System.Account.getValue(userAddress);
        
        // Account info structure: { data: { free, reserved, ... }, ... }
        rawBalance = accountInfo?.data?.free || BigInt(0);

        console.log('📊 DOT balance fetched:', {
          network: token.network,
          address: userAddress,
          balance: rawBalance.toString(),
        });
      } else if (token.assetId) {
        // Fetch asset balance using Assets.Account query
        console.log('📊 Fetching asset balance for:', {
          assetId: token.assetId,
          address: userAddress,
        });
        
        const assetAccount = await unsafeApi.query.Assets.Account.getValue(
          Number(token.assetId),
          userAddress
        );
        
        // Asset account structure: { balance, ... }
        rawBalance = assetAccount?.balance || BigInt(0);

        console.log('📊 Asset balance fetched:', {
          network: token.network,
          token: token.symbol,
          assetId: token.assetId,
          address: userAddress,
          balance: rawBalance.toString(),
        });
      } else {
        throw new Error('Invalid Polkadot testnet token configuration');
      }

      // Format balance
      const decimals = token.decimals || 10;
      const formatted = formatAmount(
        rawBalance.toString(),
        decimals,
        NUMBER_FORMAT_OPTIONS
      );

      setBalance(formatted.decimal);
      setBalanceRaw(formatted.raw);
    } catch (err) {
      console.error('❌ Polkadot testnet balance fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch testnet balance'));
      setBalance('0');
      setBalanceRaw('0');
    } finally {
      setIsLoading(false);
      
      // Cleanup: destroy client connection
      if (client) {
        try {
          client.destroy();
        } catch (e) {
          console.warn('Failed to destroy PAPI client:', e);
        }
      }
    }
  }, [isEnabled, token, userAddress, isNativeToken]);

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
    // Whether this is a Polkadot testnet token
    isPolkadotTestnetToken: token?.network === 'AssetHubPerseverance',
  };
}

/**
 * Helper function to check if a token is on Polkadot testnet
 * @returns true if the token is on AssetHub Perseverance
 */
export function isPolkadotTestnetToken(token: TokenInfo | null): boolean {
  return token?.network === 'AssetHubPerseverance';
}

