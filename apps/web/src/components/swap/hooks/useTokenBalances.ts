import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { BALANCE_REFRESH_TIMEOUT } from '@/lib/const';

interface UseTokenBalancesProps {
  isConnected: boolean;
  walletAddress: string;
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
}

export function useTokenBalances({
  isConnected,
  walletAddress,
  inputToken,
  outputToken
}: UseTokenBalancesProps) {
  const [inputBalance, setInputBalance] = useState('0');
  const [outputBalance, setOutputBalance] = useState('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // Function to fetch balances directly from the API
  const fetchBalances = useCallback(async () => {
    // Early return and reset if not connected or no wallet address
    if (!isConnected || !walletAddress) {
      setInputBalance('0');
      setOutputBalance('0');
      setIsBalanceLoading(false);
      return;
    }

    const tokens = [inputToken, outputToken].filter(Boolean) as TokenInfo[];
    if (tokens.length === 0) return;

    setIsBalanceLoading(true);
    try {
      // Prepare batch request for all tokens
      const requests = tokens.map(token => ({
        address: walletAddress,
        assetId: token.id
      }));

      // Fetch balances in batch
      const response = await api.balances.batch({ requests });

      // Only update balances if still connected
      if (isConnected && walletAddress) {
        // Process results and update states
        response.forEach(result => {
          if (result.status === 'success' && result.data) {
            const { assetId } = result.request;
            const balance = result.data.balance.toString();
            
            // Update the appropriate token balance
            if (inputToken && assetId === inputToken.id) {
              setInputBalance(balance);
            }
            if (outputToken && assetId === outputToken.id) {
              setOutputBalance(balance);
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, walletAddress, inputToken, outputToken]);

  // Refresh balances with optional delay after swap
  const refreshBalances = useCallback(async (afterSwap = false, txHash?: string) => {
    // Don't refresh if not connected
    if (!isConnected || !walletAddress) {
      return;
    }

    // For post-swap, add a delay to allow blockchain to update
    if (afterSwap) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Always fetch fresh balances
    await fetchBalances();
  }, [fetchBalances, isConnected, walletAddress]);

  // Reset the balance states
  const resetBalances = useCallback((afterSwap = false, txHash?: string) => {
    if (afterSwap && isConnected) {
      // Only refresh after swap if still connected
      refreshBalances(true, txHash);
    } else {
      // Just reset the balances to 0 without refreshing
      setInputBalance('0');
      setOutputBalance('0');
    }
  }, [refreshBalances, isConnected]);

  // Effect to fetch balances when wallet or tokens change
  useEffect(() => {
    let isMounted = true;
    
    // Only fetch if the component is mounted and connected
    const fetchIfMounted = async () => {
      if (isMounted && isConnected && walletAddress) {
        await fetchBalances();
      }
    };
    
    // Only fetch if connected
    if (isConnected && walletAddress) {
      fetchIfMounted();
    } else {
      // Reset balances to 0 when disconnected
      setInputBalance('0');
      setOutputBalance('0');
    }
    
    // Set up regular refresh interval if connected
    let intervalId: NodeJS.Timeout | null = null;
    if (isConnected && walletAddress) {
      intervalId = setInterval(fetchIfMounted, BALANCE_REFRESH_TIMEOUT);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, walletAddress, inputToken, outputToken, fetchBalances]);

  return {
    inputBalance,
    outputBalance,
    isBalanceLoading,
    resetBalances,
    refreshBalances
  };
} 