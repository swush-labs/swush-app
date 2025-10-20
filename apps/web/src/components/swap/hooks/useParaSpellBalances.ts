import { useState, useEffect, useCallback, useRef } from 'react';
import { getAssetBalance } from '@paraspell/sdk';
import type { TokenInfo } from '@/components/swap/types';
import { formatAmount } from '@/services/balances/utils';
import { BALANCE_REFRESH_TIMEOUT } from '@/lib/const';

interface UseParaSpellBalancesProps {
  isConnected: boolean;
  walletAddress: string;
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  determineCurrency: (asset: any) => any;
  getTAssetFromKey: (assetKey: string, context: 'from' | 'to') => any;
}

interface UseParaSpellBalancesReturn {
  inputBalance: string;
  outputBalance: string;
  inputBalanceRaw: string;
  outputBalanceRaw: string;
  isBalanceLoading: boolean;
  balancesLoaded: boolean;
  resetBalances: (afterSwap?: boolean) => void;
  refreshBalances: (afterSwap?: boolean) => Promise<void>;
}

/**
 * Hook to fetch token balances using ParaSpell SDK's getAssetBalance
 * 
 * Features:
 * - Fetches balances directly from chain using ParaSpell SDK
 * - Formats balances using formatAmount utility
 * - Supports automatic refresh on interval
 * - Handles post-swap balance updates
 * - Type-safe with proper error handling
 */
export function useParaSpellBalances({
  isConnected,
  walletAddress,
  inputToken,
  outputToken,
  determineCurrency,
  getTAssetFromKey,
}: UseParaSpellBalancesProps): UseParaSpellBalancesReturn {
  const [inputBalance, setInputBalance] = useState<string>('0');
  const [outputBalance, setOutputBalance] = useState<string>('0');
  const [inputBalanceRaw, setInputBalanceRaw] = useState<string>('0');
  const [outputBalanceRaw, setOutputBalanceRaw] = useState<string>('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [balancesLoaded, setBalancesLoaded] = useState<boolean>(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);

  /**
   * Fetch balance for a single token using ParaSpell SDK
   */
  const fetchTokenBalance = useCallback(async (
    token: TokenInfo,
    context: 'from' | 'to'
  ): Promise<{ raw: string; formatted: string } | null> => {
    try {
      // Get TAsset info for proper currency construction
      const tAsset = getTAssetFromKey(token.assetKey || token.id, context);
      
      if (!tAsset) {
        console.warn(`TAsset not found for ${token.symbol} on ${token.networkChain}`);
        return null;
      }

      // Construct currency using determineCurrency helper
      const currency = determineCurrency(tAsset);

      console.log(`🔍 Fetching balance for ${token.symbol} on ${token.networkChain}`, {
        address: walletAddress,
        chain: token.networkChain,
        currency,
      });

      // Fetch balance from ParaSpell SDK
      const balance = await getAssetBalance({
        address: walletAddress,
        chain: token.networkChain as any, // Type assertion for chain compatibility
        currency: currency,
      });

      console.log(`✅ Balance fetched for ${token.symbol}:`, balance?.toString());

      // Handle null/undefined balance
      if (balance === null || balance === undefined) {
        return { raw: '0', formatted: '0' };
      }

      // Format the balance using our utility
      const formatted = formatAmount(balance.toString(), token.decimals, {
        round: 6,
        trim: true,
      });

      return {
        raw: formatted.raw,
        formatted: formatted.decimal,
      };
    } catch (error) {
      console.error(`Error fetching balance for ${token.symbol}:`, error);
      return { raw: '0', formatted: '0' };
    }
  }, [walletAddress, getTAssetFromKey, determineCurrency]);

  /**
   * Fetch balances for both input and output tokens
   */
  const fetchBalances = useCallback(async () => {
    // Early return and reset if not connected or no wallet address
    if (!isConnected || !walletAddress) {
      setInputBalance('0');
      setOutputBalance('0');
      setInputBalanceRaw('0');
      setOutputBalanceRaw('0');
      setIsBalanceLoading(false);
      setBalancesLoaded(false);
      return;
    }

    // Need at least one token to fetch
    if (!inputToken && !outputToken) {
      return;
    }

    setIsBalanceLoading(true);

    try {
      // Fetch balances in parallel
      const [inputResult, outputResult] = await Promise.all([
        inputToken ? fetchTokenBalance(inputToken, 'from') : Promise.resolve(null),
        outputToken ? fetchTokenBalance(outputToken, 'to') : Promise.resolve(null),
      ]);

      // Only update state if component is still mounted and still connected
      if (isMountedRef.current && isConnected && walletAddress) {
        // Update input balance
        if (inputResult) {
          setInputBalance(inputResult.formatted);
          setInputBalanceRaw(inputResult.raw);
        } else if (inputToken) {
          // Token exists but balance fetch failed
          setInputBalance('0');
          setInputBalanceRaw('0');
        }

        // Update output balance
        if (outputResult) {
          setOutputBalance(outputResult.formatted);
          setOutputBalanceRaw(outputResult.raw);
        } else if (outputToken) {
          // Token exists but balance fetch failed
          setOutputBalance('0');
          setOutputBalanceRaw('0');
        }

        setBalancesLoaded(true);
      }
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
      if (isMountedRef.current) {
        setBalancesLoaded(true); // Mark as loaded even on error to prevent infinite loading
      }
    } finally {
      if (isMountedRef.current) {
        setIsBalanceLoading(false);
      }
    }
  }, [isConnected, walletAddress, inputToken, outputToken, fetchTokenBalance]);

  /**
   * Refresh balances with optional delay after swap
   */
  const refreshBalances = useCallback(async (afterSwap = false) => {
    // Don't refresh if not connected
    if (!isConnected || !walletAddress) {
      return;
    }

    // For post-swap, add a delay to allow blockchain to update
    if (afterSwap) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay for blockchain confirmation
    }

    // Always fetch fresh balances
    await fetchBalances();
  }, [fetchBalances, isConnected, walletAddress]);

  /**
   * Reset the balance states
   */
  const resetBalances = useCallback((afterSwap = false) => {
    if (afterSwap && isConnected) {
      // Only refresh after swap if still connected
      refreshBalances(true);
    } else {
      // Just reset the balances to empty without refreshing
      setInputBalance('0');
      setOutputBalance('0');
      setInputBalanceRaw('0');
      setOutputBalanceRaw('0');
      setBalancesLoaded(false);
    }
  }, [refreshBalances, isConnected]);

  // Effect to fetch balances when wallet or tokens change
  useEffect(() => {
    isMountedRef.current = true;

    const fetchIfMounted = async () => {
      if (isMountedRef.current && isConnected && walletAddress) {
        await fetchBalances();
      }
    };

    // Only fetch if connected
    if (isConnected && walletAddress) {
      fetchIfMounted();
    } else {
      // Reset balances to empty when disconnected
      setInputBalance('0');
      setOutputBalance('0');
      setInputBalanceRaw('0');
      setOutputBalanceRaw('0');
      setBalancesLoaded(false);
    }

    // Set up regular refresh interval if connected
    let intervalId: NodeJS.Timeout | null = null;
    if (isConnected && walletAddress && (inputToken || outputToken)) {
      intervalId = setInterval(fetchIfMounted, BALANCE_REFRESH_TIMEOUT);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, walletAddress, inputToken, outputToken, fetchBalances]);

  return {
    inputBalance,
    outputBalance,
    inputBalanceRaw,
    outputBalanceRaw,
    isBalanceLoading,
    balancesLoaded,
    resetBalances,
    refreshBalances,
  };
}



