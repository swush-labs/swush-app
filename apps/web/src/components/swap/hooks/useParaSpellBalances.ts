import { useState, useEffect, useCallback, useRef } from 'react';
import { getAssetBalance } from '@paraspell/sdk';
import type { TokenInfo } from '@/components/swap/types';
import { formatAmount } from '@/services/balances/utils';
import { 
  TEST_RPC_ASSET_HUB,
  TEST_RPC_HYDRATION,
  TEST_RPC_BIFROST,
  TEST_RPC_ACALA,
  TEST_RPC_POLKADOT,
  NUMBER_FORMAT_OPTIONS,
  XCM_BALANCE_POLLING
} from '@/services/constants';
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
  startBalancePolling: (onBalanceIncreased: (newBalance: string, oldBalance: string) => void) => void;
  stopBalancePolling: () => void;
}

/**
 * Hook to fetch token balances using ParaSpell SDK's getAssetBalance
 * 
 * Features:
 * - Fetches balances directly from chain using ParaSpell SDK
 * - Supports custom RPC endpoints via NEXT_PUBLIC_USE_LOCAL_ENDPOINTS flag
 * - Formats balances using formatAmount utility
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

  // Balance polling for XCM completion tracking
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialOutputBalanceRef = useRef<string>('0');

  /**
   * Get custom RPC URL for a chain when using local endpoints
   * Maps ParaSpell chain names to chopsticks RPC URLs
   */
  const getChainRpcUrl = useCallback((chainName: string): string | undefined => {
    // Check if using local chopsticks endpoints
    const USE_LOCAL_ENDPOINTS = process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS === 'true';
    
    if (!USE_LOCAL_ENDPOINTS) {
      return undefined; // Use default ParaSpell public endpoints
    }

    // Map ParaSpell chain names to chopsticks RPC URLs
    // These names match exactly what comes from token.networkChain
    const chainUrlMap: Record<string, string> = {
      'AssetHubPolkadot': TEST_RPC_ASSET_HUB,  // ws://localhost:3421
      'Hydration': TEST_RPC_HYDRATION,         // ws://localhost:3422
      'HydrationDx': TEST_RPC_HYDRATION,       // Alternative name support
      'BifrostPolkadot': TEST_RPC_BIFROST,     // ws://localhost:3423
      'Acala': TEST_RPC_ACALA,                 // ws://localhost:3424
      'Polkadot': TEST_RPC_POLKADOT,           // ws://localhost:3420
    };

    const url = chainUrlMap[chainName];
    
    if (!url) {
      console.warn(`⚠️ No chopsticks endpoint configured for chain: ${chainName}`);
    }
    
    return url;
  }, []);

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

      // Get custom RPC URL if using local endpoints
      const customApi: string | undefined = token.networkChain 
        ? getChainRpcUrl(token.networkChain) 
        : undefined;

      // Fetch balance from ParaSpell SDK
      // - chain: Uses token.networkChain which already has correct ParaSpell format
      // - api: Optional custom RPC URL for chopsticks/local testing
      const balance = await getAssetBalance({
        address: walletAddress,
        chain: token.networkChain as any, // Type assertion for chain compatibility
        currency: currency,
        ...(customApi && { api: customApi }), // Only add api field if custom URL exists
      });

      // Handle null/undefined balance
      if (balance === null || balance === undefined) {
        return { raw: '0', formatted: '0' };
      }

      // Format the balance using our utility with standard constants
      const formatted = formatAmount(balance.toString(), token.decimals, NUMBER_FORMAT_OPTIONS);
   
      console.log(`Token id: ${token.id}, TAsset: ${JSON.stringify(currency)}`);
      console.log(`Balance for ${token.symbol}: ${balance.toString()} using api: ${customApi}`);

      return {
        raw: formatted.raw,
        formatted: formatted.decimal,
      };
    } catch (error) {
      console.error(`Error fetching balance for ${token.symbol}:`, error);
      return { raw: '0', formatted: '0' };
    }
  }, [walletAddress, getTAssetFromKey, determineCurrency, getChainRpcUrl]);

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
      await new Promise(resolve => setTimeout(resolve, BALANCE_REFRESH_TIMEOUT)); // 3 second delay for blockchain confirmation
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

  /**
   * Stop balance polling
   */
  const stopBalancePolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start polling output balance to detect XCM delivery
   * This is a dev-friendly solution that works without Ocelloids
   * 
   * Polling Configuration:
   * - Interval: 7 seconds (gentle on RPCs, catches delivery quickly)
   * - Max Duration: 4 minutes (240 seconds)
   * - Max Polls: 35 attempts
   * - Typical XCM delivery: ~20 seconds (3-4 polls)
   */
  const startBalancePolling = useCallback((
    onBalanceIncreased: (newBalance: string, oldBalance: string) => void
  ) => {
    // Stop any existing polling
    stopBalancePolling();

    if (!outputToken || !isConnected || !walletAddress) {
      console.warn('⚠️ Cannot start balance polling: missing token or wallet');
      return;
    }

    // Capture initial output balance
    initialOutputBalanceRef.current = outputBalanceRaw;
    console.log(`🔍 Starting balance polling for ${outputToken.symbol} (initial: ${outputBalanceRaw})`);

    let pollCount = 0;
    
    // Poll at configured interval
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;

      try {
        // Fetch fresh output balance
        const result = await fetchTokenBalance(outputToken, 'to');
        
        if (!result) {
          console.warn('⚠️ Failed to fetch balance during polling');
          return;
        }

        const newBalanceRaw = result.raw;
        const newBalanceFormatted = result.formatted;

        // Check if balance increased
        if (parseFloat(newBalanceRaw) > parseFloat(initialOutputBalanceRef.current)) {
          console.log(`✅ XCM delivered! Balance: ${initialOutputBalanceRef.current} → ${newBalanceRaw} ${outputToken.symbol}`);

          // Update UI with new balance
          setOutputBalance(newBalanceFormatted);
          setOutputBalanceRaw(newBalanceRaw);

          // Stop polling
          stopBalancePolling();

          // Notify callback
          onBalanceIncreased(newBalanceFormatted, outputBalance);
        }

        // Check if max polls reached
        if (pollCount >= XCM_BALANCE_POLLING.MAX_POLLS) {
          console.warn(`⏱️ Balance polling timeout after ${XCM_BALANCE_POLLING.MAX_POLLS} attempts`);
          stopBalancePolling();
        }
      } catch (error) {
        console.error('❌ Error during balance polling:', error);
      }
    }, XCM_BALANCE_POLLING.INTERVAL); // Poll at configured interval

    // Set overall timeout
    pollingTimeoutRef.current = setTimeout(() => {
      console.warn(`⏱️ Balance polling timeout after ${XCM_BALANCE_POLLING.MAX_DURATION / 1000}s`);
      stopBalancePolling();
    }, XCM_BALANCE_POLLING.MAX_DURATION);

  }, [outputToken, isConnected, walletAddress, outputBalanceRaw, fetchTokenBalance, outputBalance, stopBalancePolling]);

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

    // ❌ REMOVED: Periodic refresh interval
    // Only fetch initially when connected or when tokens/wallet change
    // Explicit refreshes will be triggered by resetBalances(true) after transactions

    return () => {
      isMountedRef.current = false;
      // Clean up balance polling on unmount
      stopBalancePolling();
    };
  }, [isConnected, walletAddress, inputToken, outputToken, fetchBalances, stopBalancePolling]);

  return {
    inputBalance,
    outputBalance,
    inputBalanceRaw,
    outputBalanceRaw,
    isBalanceLoading,
    balancesLoaded,
    resetBalances,
    refreshBalances,
    startBalancePolling,
    stopBalancePolling,
  };
}



