import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import type { TokenInfo } from '@/components/swap/types';
import { BALANCE_FETCH_TIMEOUT } from '@/lib/const';

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

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !walletAddress || !inputToken?.id || !outputToken?.id) return;

    setIsBalanceLoading(true);
    try {
      const response = await api.balances.batch({
        requests: [
          { address: walletAddress, assetId: inputToken.id },
          { address: walletAddress, assetId: outputToken.id }
        ]
      });

      response.forEach(result => {
        if (result.status === 'success' && result.data) {
          if (result.request.assetId === inputToken.id) {
            setInputBalance(result.data.balance.toString());
          } else if (result.request.assetId === outputToken.id) {
            setOutputBalance(result.data.balance.toString());
          }
        }
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      toast.error('Failed to fetch balances');
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, walletAddress, inputToken?.id, outputToken?.id]);

  useEffect(() => {
    // Only fetch balances if wallet is connected and we have both tokens
    if (isConnected && walletAddress && inputToken?.id && outputToken?.id) {
      setIsBalanceLoading(true); // Only set loading when we're actually fetching
      fetchBalances();
      // Set up periodic refresh
      const interval = setInterval(fetchBalances, BALANCE_FETCH_TIMEOUT);
      return () => clearInterval(interval);
    } else {
      // Reset balance loading state when not connected
      setIsBalanceLoading(false);
    }
  }, [isConnected, walletAddress, inputToken?.id, outputToken?.id, fetchBalances]);

  const resetBalances = useCallback(() => {
    setInputBalance('0');
    setOutputBalance('0');
    setIsBalanceLoading(false);
  }, []);

  return {
    inputBalance,
    outputBalance,
    isBalanceLoading,
    resetBalances,
  };
} 