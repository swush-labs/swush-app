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
  TEST_RPC_BIFROST,
  TEST_RPC_ACALA,
  TEST_RPC_MOONBEAM
} from '@/services/constants';

// XCM Tracking
import { useXcmTracking } from './useXcmTracking';
import type { XcmDeliveryStatus, TrackedXcmMessage } from '@/services/xcm-tracker';

// EVM Chain Utilities
import { isEvmChain } from '@/services/xcm-router/evmChains';

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
  xcmDeliveryStatus?: XcmDeliveryStatus;
  xcmStatusMessage?: string;
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
  recipientAddress: string; // Recipient address (can be same as sender or different)
  polkadotSigner: PolkadotSigner | undefined;
  evmSigner?: any; // EVM signer (from account.client) for EVM-based chains

  // Exchange selection from quote (optional - will recalculate if not provided)
  selectedExchange?: string | string[];

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
  
  // XCM Tracking (optional)
  enableXcmTracking?: boolean;
  ocelloidsApiKey?: string;
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
  recipientAddress,
  polkadotSigner,
  evmSigner,
  selectedExchange,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
  onExecutionStart,
  onExecutionUpdate,
  onSuccess,
  onError,
  enableXcmTracking = false,
  ocelloidsApiKey,
}: UseXcmSwapExecutionProps): UseXcmSwapExecutionReturn {

  // Use ref to track if execution has started (avoids stale closure issue)
  // This prevents showing "execution started" dialog before user signs the first transaction
  const hasExecutionStartedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  // XCM Tracking
  const {
    deliveryStatus: xcmDeliveryStatus,
    statusMessage: xcmStatusMessage,
    trackRoute,
    stopTracking,
    reset: resetXcmTracking,
    isAllDelivered: xcmAllDelivered,
  } = useXcmTracking({
    apiKey: ocelloidsApiKey,
    enabled: enableXcmTracking,
    useWildcards: process.env.NEXT_PUBLIC_XCM_TRACKING_USE_WILDCARDS === 'true', // Dev flag
    onStatusChange: (status, messages) => {
      console.log('🌐 XCM Delivery Status:', status);
      console.log('📊 Tracked Messages:', messages);
      
      // Update execution details with XCM status
      onExecutionUpdate?.({
        xcmDeliveryStatus: status,
        xcmStatusMessage: xcmStatusMessage,
      });

      // If all XCM messages delivered, trigger success and cleanup
      if (status === 'delivered' && hasExecutionStartedRef.current) {
        const duration = Date.now() - startTimeRef.current;
        console.log(`✅ All XCM messages delivered! Total time: ${duration}ms`);
        
        // Stop tracking and cleanup (prevents old messages from interfering)
        stopTracking();
        resetXcmTracking();
        console.log('🛑 XCM tracking stopped and reset');
        
        onSuccess?.({
          duration,
          inputAmount,
          inputToken: inputToken?.symbol || '?',
          outputAmount: outputAmount || '?',
          outputToken: outputToken?.symbol || '?'
        });
      }
      
      // If XCM delivery failed, cleanup
      if (status === 'failed' && hasExecutionStartedRef.current) {
        console.log('❌ XCM delivery failed, stopping tracking');
        
        // Stop tracking and cleanup
        stopTracking();
        resetXcmTracking();
        console.log('🛑 XCM tracking stopped and reset');
      }
    },
  });

  /**
   * Execute the swap using ParaSpell RouterBuilder
   */
  const executeSwap = useCallback(async () => {
    // Validation
    if (!inputToken || !outputToken || !walletAddress) {
      const errorDetails: ErrorDetails = {
        message: 'Missing required parameters: token or wallet',
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

    // Check if origin chain is EVM-based and validate appropriate signer
    const isOriginEvm = isEvmChain(inputToken.networkChain);
    
    if (isOriginEvm && !evmSigner) {
      console.error('❌ EVM chain requires EVM signer:', {
        chain: inputToken.networkChain,
        hasEvmSigner: !!evmSigner,
      });
      
      const errorDetails: ErrorDetails = {
        message: `${inputToken.networkChain} is an EVM chain. Please connect an Ethereum wallet (e.g., MetaMask)`,
        code: 'MISSING_EVM_SIGNER'
      };
      onError?.(errorDetails);
      return;
    }

    if (!isOriginEvm && !polkadotSigner) {
      console.error('❌ Polkadot chain requires Polkadot signer:', {
        chain: inputToken.networkChain,
        hasPolkadotSigner: !!polkadotSigner,
      });
      
      const errorDetails: ErrorDetails = {
        message: `${inputToken.networkChain} requires a Polkadot wallet (e.g., Talisman, SubWallet)`,
        code: 'MISSING_POLKADOT_SIGNER'
      };
      onError?.(errorDetails);
      return;
    }

    try {
      // Reset execution flag and start timer
      hasExecutionStartedRef.current = false;
      startTimeRef.current = Date.now();
      
      // Reset XCM tracking
      resetXcmTracking();

      console.log('🚀 Starting XCM swap execution:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amount: inputAmount,
        walletAddress,
      });

      // Log which signer will be used
      console.log('🔐 Signer info:', {
        originChain: inputToken.networkChain,
        isEvmChain: isOriginEvm,
        willUseEvmSigner: isOriginEvm && !!evmSigner,
        willUsePolkadotSigner: !isOriginEvm && !!polkadotSigner,
      });

      // Step 1: Use exchange from quote if available, otherwise recalculate
      let exchanges: TExchangeChain | TExchangeChain[];
      //TODO: hardcode HydrationDex for now
      //  let  exchanges: TExchangeChain = 'HydrationDex';
      if (selectedExchange) {
        // Use the exchange that was selected during quote fetching
        // This ensures we use the same exchange that gave us the quote
        exchanges = selectedExchange as TExchangeChain;
        console.log('📊 Using exchange from quote:', exchanges);
      } else {
        // Fallback: recalculate optimal exchanges (shouldn't happen in normal flow)
        console.warn('⚠️ No exchange provided from quote, recalculating...');
        const optimalExchanges = getOptimalExchanges(
          inputToken.assetKey,
          outputToken.assetKey,
          inputToken.networkChain,
          outputToken.networkChain
        );
        exchanges = optimalExchanges.length > 0 ? optimalExchanges[0] : 'HydrationDex';
        console.log('📊 Recalculated exchange:', exchanges);
      }

      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found in registry: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }

      // Configure RouterBuilder with local chopsticks endpoints for development
      const USE_LOCAL_ENDPOINTS = process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS === 'true';

      const routerConfig = USE_LOCAL_ENDPOINTS ? {
        development: true, // Enforce overrides for all chains used
        abstractDecimals: true, // Let ParaSpell handle decimal conversion (accepts string amounts like "4.344")
        apiOverrides: {
          AssetHubPolkadot: TEST_RPC_ASSET_HUB,  // ws://localhost:3421
          Hydration: TEST_RPC_HYDRATION,         // ws://localhost:3422
          BifrostPolkadot: TEST_RPC_BIFROST,     // ws://localhost:3423
          Acala: TEST_RPC_ACALA,
          Moonbeam: TEST_RPC_MOONBEAM,
        }
      } : {
        abstractDecimals: true,
      };

      console.log('🔧 RouterBuilder config:', {
        useLocalEndpoints: USE_LOCAL_ENDPOINTS,
        config: routerConfig
      });

      // Round to 2 decimal places to avoid floating-point precision issues
      const safeSlippage = Math.round(slippageTolerance * 100) / 100;

      //print RouterBuilder input data
      console.log('🔧 RouterBuilder input data:', {
        from: inputToken.networkChain,
        to: outputToken.networkChain,
        exchange: exchanges,
        currencyFrom: determineCurrency(fromAsset),
        currencyTo: determineCurrency(toAsset),
        amount: inputAmount, // Pass as string, not BigInt
        slippagePct: safeSlippage.toString(),
        senderAddress: walletAddress,
        recipientAddress: recipientAddress,
        isOriginEvm: isOriginEvm,
        signerType: isOriginEvm ? 'EVM' : 'Polkadot',
      });

      // Build RouterBuilder with conditional signer configuration
      // Status change handler - shared between both EVM and Polkadot paths
      const onStatusChange = (status: TRouterEvent) => {
        // Log transaction status update
        console.log(`📡 Transaction status update:`, {
          type: status.type,
          step: status.currentStep !== undefined ? status.currentStep + 1 : '?',
          totalSteps: status.routerPlan?.length || '?',
          chain: status.chain,
          destinationChain: status.destinationChain,
        });

        // Handle COMPLETED status
        if (status.type === 'COMPLETED') {
          console.log(`✅ Router execution completed!`);

          // If XCM tracking is enabled, start tracking the route
          if (enableXcmTracking && inputToken.networkChain && outputToken.networkChain) {
            console.log('🔭 Starting XCM delivery tracking...');
            trackRoute(
              inputToken.networkChain,
              outputToken.networkChain,
              walletAddress
            );
            
            // Update status to show XCM delivery pending
            onExecutionUpdate?.({
              xcmDeliveryStatus: 'in-flight',
              xcmStatusMessage: 'Delivering assets cross-chain...',
            });
          } else {
            // No XCM tracking, trigger success immediately
            const duration = Date.now() - startTimeRef.current;
            console.log(`✅ Swap completed successfully in ${duration}ms!`);

            onSuccess?.({
              duration,
              inputAmount,
              inputToken: inputToken.symbol,
              outputAmount: outputAmount || '?',
              outputToken: outputToken.symbol
            });
          }
          return; // Exit early, no need to process further
        }

        // Notify execution start on first transaction event
        if (!hasExecutionStartedRef.current) {
          console.log('✅ Transaction execution started:', status.type);
          hasExecutionStartedRef.current = true;

          // Notify parent that execution has started
          onExecutionStart?.({
            currentStep: status.currentStep || 0,
            totalSteps: status.routerPlan?.length || 0,
            transactionType: status.type,
            statusMessage: formatStatusMessage(status.type)
          });
        } else {
          // Update execution progress
          onExecutionUpdate?.({
            currentStep: status.currentStep,
            totalSteps: status.routerPlan?.length,
            transactionType: status.type,
            statusMessage: formatStatusMessage(status.type)
          });
        }
      };
      
      if (isOriginEvm) {
        console.log('🔐 Using EVM signer for chain:', inputToken.networkChain);
        // For EVM chains, use evmSigner instead of polkadotSigner
        // Type assertion needed due to ParaSpell's type system requiring signer in the type
        await (RouterBuilder(routerConfig)
          .from(inputToken.networkChain as any)
          .to(outputToken.networkChain as any)
          .exchange(exchanges as any)
          .currencyFrom(determineCurrency(fromAsset))
          .currencyTo(determineCurrency(toAsset))
          .amount(inputAmount)
          .slippagePct(safeSlippage.toString())
          .recipientAddress(recipientAddress)
          .signer(polkadotSigner!)
          .evmSenderAddress(walletAddress) // Required for EVM chains
          .evmSigner(evmSigner!) as any) // Required for EVM chains
          .onStatusChange(onStatusChange)
          .build();
      } else {
        console.log('🔐 Using Polkadot signer for chain:', inputToken.networkChain);
        await RouterBuilder(routerConfig)
          .from(inputToken.networkChain as any)
          .to(outputToken.networkChain as any)
          .exchange(exchanges as any)
          .currencyFrom(determineCurrency(fromAsset))
          .currencyTo(determineCurrency(toAsset))
          .amount(inputAmount)
          .slippagePct(safeSlippage.toString())
          .senderAddress(walletAddress)
          .recipientAddress(recipientAddress)
          .signer(polkadotSigner!) // Required for Polkadot chains
          .onStatusChange(onStatusChange)
          .build();
      }


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
    recipientAddress,
    polkadotSigner,
    evmSigner,
    selectedExchange,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    onExecutionStart,
    onExecutionUpdate,
    onSuccess,
    onError,
    enableXcmTracking,
    resetXcmTracking,
    trackRoute,
  ]);

  return {
    executeSwap,
  };
}

