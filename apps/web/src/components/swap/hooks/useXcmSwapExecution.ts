import { useCallback, useRef } from 'react';
import { RouterBuilder } from '@paraspell/xcm-router';
import type { TAssetInfo, TChain } from '@paraspell/sdk';
import type { 
  TExchangeChain,
  TRouterEvent,
  TRouterEventType
} from '@paraspell/xcm-router';
import type { PolkadotSigner } from 'polkadot-api';

// Our types
import type { TokenInfo } from '@/components/swap/types';

// Import chopsticks endpoints for local development
import { 
  TEST_RPC_POLKADOT, 
  TEST_RPC_ASSET_HUB, 
  TEST_RPC_HYDRATION, 
  TEST_RPC_BIFROST
} from '@/services/constants';

/**
 * Convert user input (decimal string) to smallest unit (bigint)
 * Uses string manipulation to preserve precision for large decimals
 */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseFloat(amount);
  
  if (parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount too large');
  }

  if (isNaN(parsed) || parsed <= 0) return BigInt(0);

  // Handle decimal places with string manipulation to avoid precision loss
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}

/**
 * Execution details passed to callbacks
 */
export interface ExecutionDetails {
  currentStep: number;
  totalSteps: number;
  transactionType: TRouterEventType | null;
  statusMessage: string;
}

/**
 * Success details passed to onSuccess callback
 */
export interface SuccessDetails {
  duration: number;
  inputAmount: string;
  inputToken: string;
  outputAmount: string;
  outputToken: string;
}

/**
 * Error details passed to onError callback
 */
export interface ErrorDetails {
  message: string;
  code?: string;
  userCancelled?: boolean;
}

/**
 * Props for useXcmSwapExecution hook
 */
interface UseXcmSwapExecutionProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  outputAmount?: string; // For success callback
  slippageTolerance: number;
  walletAddress: string;
  polkadotSigner: PolkadotSigner | undefined;
  
  // Helpers from useXcmTokens
  getOptimalExchanges: (
    fromKey: string,
    toKey: string,
    fromChain: string,
    toChain: string
  ) => TExchangeChain[];
  
  determineCurrency: (asset: TAssetInfo) => any;
  
  getTAssetFromKey: (
    key: string,
    direction: 'from' | 'to'
  ) => TAssetInfo | undefined;
  
  // State management callbacks (replaces internal state)
  onExecutionStart?: (execution: ExecutionDetails) => void;
  onExecutionUpdate?: (execution: Partial<ExecutionDetails>) => void;
  onSuccess?: (success: SuccessDetails) => void;
  onError?: (error: ErrorDetails) => void;
}

/**
 * Return type for useXcmSwapExecution hook
 */
interface UseXcmSwapExecutionReturn {
  executeSwap: () => Promise<void>;
}

/**
 * Format transaction type for user-friendly status messages
 */
const formatStatusMessage = (type: TRouterEventType | null): string => {
  if (!type) return 'Processing...';
  
  switch (type) {
    case 'SELECTING_EXCHANGE':
      return 'Selecting best exchange...';
    case 'TRANSFER':
      return 'Transferring assets to exchange...';
    case 'SWAP':
      return 'Swapping on DEX...';
    case 'SWAP_AND_TRANSFER':
      return 'Swapping and transferring back...';
    case 'COMPLETED':
      return 'Completed!';
    default:
      return type;
  }
};

/**
 * XCM Swap Execution Hook - Uses ParaSpell RouterBuilder for transaction execution
 * 
 * Refactored to be stateless - all state management is handled by parent via callbacks.
 * This hook is purely responsible for executing the swap transaction.
 * 
 * Features:
 * - Real cross-chain swap execution via RouterBuilder.buildAndSend()
 * - Kheopskit wallet signer integration
 * - Multi-step transaction progress tracking via callbacks
 * - Comprehensive error handling
 * 
 * @param props - Hook configuration including callbacks for state updates
 * @returns executeSwap function to trigger the swap
 */
export function useXcmSwapExecution({
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  slippageTolerance,
  walletAddress,
  polkadotSigner,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
  onExecutionStart,
  onExecutionUpdate,
  onSuccess,
  onError,
}: UseXcmSwapExecutionProps): UseXcmSwapExecutionReturn {

  // Use ref to track if execution has started (avoids stale closure issue)
  // This prevents showing "execution started" dialog before user signs the first transaction
  const hasExecutionStartedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  /**
   * Execute the swap using ParaSpell RouterBuilder
   */
  const executeSwap = useCallback(async () => {
    // Validation
    if (!inputToken || !outputToken || !walletAddress || !polkadotSigner) {
      const errorDetails: ErrorDetails = {
        message: 'Missing required parameters: token, wallet, or signer',
        code: 'MISSING_PARAMS'
      };
      onError?.(errorDetails);
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      const errorDetails: ErrorDetails = {
        message: 'Invalid swap amount',
        code: 'INVALID_AMOUNT'
      };
      onError?.(errorDetails);
      return;
    }

    // Ensure tokens have required XCM fields
    if (!inputToken.assetKey || !inputToken.networkChain) {
      console.error('❌ Input token configuration error:', inputToken);
      const errorDetails: ErrorDetails = {
        message: 'Input token missing assetKey or networkChain',
        code: 'INVALID_TOKEN_CONFIG'
      };
      onError?.(errorDetails);
      return;
    }

    if (!outputToken.assetKey || !outputToken.networkChain) {
      console.error('❌ Output token configuration error:', outputToken);
      const errorDetails: ErrorDetails = {
        message: 'Output token missing assetKey or networkChain',
        code: 'INVALID_TOKEN_CONFIG'
      };
      onError?.(errorDetails);
      return;
    }

    try {
      // Reset execution flag and start timer
      hasExecutionStartedRef.current = false;
      startTimeRef.current = Date.now();

      console.log('🚀 Starting XCM swap execution:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amount: inputAmount,
        walletAddress,
      });

      // Step 1: Get optimal DEX selection
      const exchangesToUse = getOptimalExchanges(
        inputToken.assetKey,
        outputToken.assetKey,
        inputToken.networkChain,
        outputToken.networkChain
      );

      // Use optimal exchanges or fallback to HydrationDex
      // const exchanges: TExchangeChain[] = exchangesToUse.length > 0
      //   ? exchangesToUse
      //   : ['HydrationDex'];

      //TODO: hardcode HydrationDex for now
      const exchanges: TExchangeChain = 'HydrationDex';
      console.log('📊 Selected exchanges:', exchanges);

      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found in registry: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }

      // Configure RouterBuilder with local chopsticks endpoints for development
      const USE_LOCAL_ENDPOINTS = process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS; 
      
      // IMPORTANT: Always provide config to explicitly control decimal handling
      const routerConfig = USE_LOCAL_ENDPOINTS ? {
        development: true, // Enforce overrides for all chains used
        abstractDecimals: true, // Let ParaSpell handle decimal conversion (accepts string amounts like "4.344")
        apiOverrides: {
          AssetHubPolkadot: TEST_RPC_ASSET_HUB,  // ws://localhost:3421
          Hydration: TEST_RPC_HYDRATION,         // ws://localhost:3422
          BifrostPolkadot: TEST_RPC_BIFROST     // ws://localhost:3423
        }
      } : {
        abstractDecimals: true, // Let ParaSpell handle decimal conversion (accepts string amounts like "4.344")
      };

      console.log('🔧 RouterBuilder config:', {
        useLocalEndpoints: USE_LOCAL_ENDPOINTS,
        config: routerConfig
      });

      //print RouterBuilder input data
      console.log('🔧 RouterBuilder input data:', {
        from: inputToken.networkChain,
        to: outputToken.networkChain,
        exchange: exchanges,
        currencyFrom: determineCurrency(fromAsset),
        currencyTo: determineCurrency(toAsset),
        amount: inputAmount, // Pass as string, not BigInt
        slippagePct: slippageTolerance.toString(),
        senderAddress: walletAddress,
        recipientAddress: walletAddress,
      });
      
      await RouterBuilder(routerConfig)
        .from(inputToken.networkChain as any) // Type assertion for chain compatibility
        .to(outputToken.networkChain as any) // Type assertion for chain compatibility
        .exchange(exchanges as any) // Type assertion needed due to ParaSpell's strict tuple type
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(inputAmount) // Pass string amount, let ParaSpell handle conversion
        .slippagePct(slippageTolerance.toString())
        .senderAddress(walletAddress)
        .recipientAddress(walletAddress) // Same as sender for now
        .signer(polkadotSigner)
        .onStatusChange((status: TRouterEvent) => {
          // Log transaction status update
          console.log(`📡 Transaction status update:`, {
            type: status.type,
            step: status.currentStep !== undefined ? status.currentStep + 1 : '?',
            totalSteps: status.routerPlan?.length || '?',
            chain: status.chain,
            destinationChain: status.destinationChain,
          });

          // Handle COMPLETED status - trigger success callback
          if (status.type === 'COMPLETED') {
            const duration = Date.now() - startTimeRef.current;
            console.log(`✅ Swap completed successfully in ${duration}ms!`);
            
            // Notify parent of success
            onSuccess?.({
              duration,
              inputAmount,
              inputToken: inputToken.symbol,
              outputAmount: outputAmount || '?',
              outputToken: outputToken.symbol
            });
            return; // Exit early, no need to process further
          }

          // CRITICAL: Only notify execution start after user has signed
          // SELECTING_EXCHANGE happens BEFORE wallet prompt
          // Actual transaction types (TRANSFER, SWAP, etc.) happen AFTER signing
          // So we use the first non-SELECTING_EXCHANGE event as our signal
          if (!hasExecutionStartedRef.current && status.type !== 'SELECTING_EXCHANGE') {
            console.log('✅ Transaction signed by user! Execution started...');
            hasExecutionStartedRef.current = true;
            
            // Notify parent that execution has started
            onExecutionStart?.({
              currentStep: status.currentStep || 0,
              totalSteps: status.routerPlan?.length || 0,
              transactionType: status.type,
              statusMessage: formatStatusMessage(status.type)
            });
          } else if (hasExecutionStartedRef.current) {
            // Update execution progress
            onExecutionUpdate?.({
              currentStep: status.currentStep,
              totalSteps: status.routerPlan?.length,
              transactionType: status.type,
              statusMessage: formatStatusMessage(status.type)
            });
          }
        })
        .build();

      // Note: Success is now handled in onStatusChange COMPLETED event
      // This ensures proper sequencing and avoids race conditions

    } catch (error: unknown) {
      console.error('❌ XCM swap execution error:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to execute swap';

      // Determine if user cancelled
      const userCancelled = errorMessage.includes('User rejected') || 
                            errorMessage.includes('Cancelled') ||
                            errorMessage.includes('User cancelled');

      // Determine error code
      let errorCode: string | undefined;
      if (userCancelled) {
        // Provide better context based on whether execution had started
        if (!hasExecutionStartedRef.current) {
          errorCode = 'USER_CANCELLED_BEFORE_START';
          console.log('User cancelled before transaction execution started');
        } else {
          errorCode = 'USER_CANCELLED';
          console.log('User cancelled during transaction execution');
        }
      } else if (errorMessage.includes('Insufficient')) {
        errorCode = 'INSUFFICIENT_BALANCE';
      } else if (errorMessage.includes('Network')) {
        errorCode = 'NETWORK_ERROR';
      }

      // Notify parent of error
      onError?.({
        message: errorMessage,
        code: errorCode,
        userCancelled
      });
    }
  }, [
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    slippageTolerance,
    walletAddress,
    polkadotSigner,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    onExecutionStart,
    onExecutionUpdate,
    onSuccess,
    onError,
  ]);

  return {
    executeSwap,
  };
}

