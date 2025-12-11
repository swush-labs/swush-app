import { useCallback, useRef, useState, useEffect } from 'react';
import type { TokenInfo } from '@/components/swap/types';
import {
  chainflipClient,
  formatDuration,
  type ChainflipQuote,
  type ChainflipSwapResponse,
  type ChainflipSwapState,
  type ChainflipExecutionStage,
} from '@/services/chainflip';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execution details passed to callbacks
 */
export interface ChainflipExecutionDetails {
  stage: ChainflipExecutionStage;
  statusMessage: string;
  depositAddress?: string;
  depositChannelId?: string;
  expiresAt?: string;
  swapId?: string;
  swapState?: ChainflipSwapState;
  txHash?: string;
}

/**
 * Success details passed to onSuccess callback
 */
export interface ChainflipSuccessDetails {
  duration: number;
  inputAmount: string;
  inputToken: string;
  outputAmount: string;
  outputToken: string;
  swapId: string;
  txHash?: string;
}

/**
 * Error details passed to onError callback
 */
export interface ChainflipErrorDetails {
  message: string;
  code?: string;
  userCancelled?: boolean;
}

/**
 * Props for useChainflipExecution hook
 */
interface UseChainflipExecutionProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  outputAmount?: string;
  quote: ChainflipQuote | null;
  walletAddress: string;
  recipientAddress: string;

  // State management callbacks
  onExecutionStart?: (execution: ChainflipExecutionDetails) => void;
  onExecutionUpdate?: (execution: Partial<ChainflipExecutionDetails>) => void;
  onSuccess?: (success: ChainflipSuccessDetails) => void;
  onError?: (error: ChainflipErrorDetails) => void;
}

/**
 * Return type for useChainflipExecution hook
 */
interface UseChainflipExecutionReturn {
  executeSwap: () => Promise<void>;
  stage: ChainflipExecutionStage;
  depositAddress: string | null;
  swapId: string | null;
  isExecuting: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Status Messages
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE_MESSAGES: Record<ChainflipExecutionStage, string> = {
  idle: 'Ready to swap',
  preparing: 'Getting deposit address from Chainflip...',
  awaiting_signature: 'Please sign the transaction in your wallet',
  submitting: 'Submitting transaction...',
  confirming: 'Waiting for confirmation on source chain...',
  swap_executing: 'Chainflip is processing your swap...',
  completed: 'Swap completed!',
  failed: 'Swap failed',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chainflip Swap Execution Hook
 * 
 * Handles the Chainflip deposit address flow:
 * 1. Request deposit address from Chainflip broker
 * 2. User sends funds to deposit address
 * 3. Poll for swap status until complete
 * 
 * Note: The actual transaction sending (EVM/Solana) is handled by the parent
 * component using the appropriate wallet SDK. This hook provides the deposit
 * address and tracks the swap status.
 */
export function useChainflipExecution({
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  quote,
  walletAddress,
  recipientAddress,
  onExecutionStart,
  onExecutionUpdate,
  onSuccess,
  onError,
}: UseChainflipExecutionProps): UseChainflipExecutionReturn {

  // State
  const [stage, setStage] = useState<ChainflipExecutionStage>('idle');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Refs
  const startTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Update stage and notify parent
   */
  const updateStage = useCallback((newStage: ChainflipExecutionStage, extraDetails?: Partial<ChainflipExecutionDetails>) => {
    setStage(newStage);
    onExecutionUpdate?.({
      stage: newStage,
      statusMessage: STAGE_MESSAGES[newStage],
      ...extraDetails,
    });
  }, [onExecutionUpdate]);

  /**
   * Poll for swap status until complete
   */
  const pollSwapStatus = useCallback(async (swapIdToPoll: string) => {
    console.log('🔄 Starting swap status polling for:', swapIdToPoll);

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const pollInterval = 5000; // 5 seconds
    const maxPollTime = 30 * 60 * 1000; // 30 minutes max
    const startPollTime = Date.now();

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Check if we've exceeded max poll time
        if (Date.now() - startPollTime > maxPollTime) {
          console.warn('⚠️ Swap status polling timed out');
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          
          onError?.({
            message: 'Swap status polling timed out. Please check your transaction manually.',
            code: 'POLLING_TIMEOUT',
          });
          return;
        }

        const status = await chainflipClient.getSwapStatus(swapIdToPoll);
        console.log('📊 Swap status:', status);

        // Update stage based on status
        switch (status.state) {
          case 'AWAITING_DEPOSIT':
            updateStage('awaiting_signature', { swapState: status.state });
            break;

          case 'DEPOSIT_RECEIVED':
          case 'SWAP_EXECUTING':
          case 'EGRESS_SCHEDULED':
            updateStage('swap_executing', { 
              swapState: status.state,
              txHash: status.txHash,
            });
            break;

          case 'COMPLETED':
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            
            updateStage('completed', { 
              swapState: status.state,
              txHash: status.txHash,
            });
            
            const duration = Date.now() - startTimeRef.current;
            console.log(`✅ Chainflip swap completed in ${duration}ms!`);
            
            onSuccess?.({
              duration,
              inputAmount,
              inputToken: inputToken?.symbol || '?',
              outputAmount: status.egressAmount || outputAmount || '?',
              outputToken: outputToken?.symbol || '?',
              swapId: swapIdToPoll,
              txHash: status.txHash,
            });
            break;

          case 'FAILED':
          case 'REFUNDED':
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            
            updateStage('failed', { swapState: status.state });
            
            onError?.({
              message: status.error || `Swap ${status.state.toLowerCase()}`,
              code: status.state,
            });
            break;
        }
      } catch (error) {
        console.error('❌ Error polling swap status:', error);
        // Don't stop polling on transient errors
      }
    }, pollInterval);
  }, [inputToken, outputToken, inputAmount, outputAmount, updateStage, onSuccess, onError]);

  /**
   * Execute the Chainflip swap
   * 
   * This function:
   * 1. Requests a deposit address from Chainflip
   * 2. Returns the deposit address for the parent to send funds to
   * 3. Starts polling for swap status
   */
  const executeSwap = useCallback(async () => {
    // Validation
    if (!inputToken || !outputToken || !walletAddress) {
      onError?.({
        message: 'Missing required parameters: token or wallet',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      onError?.({
        message: 'Invalid swap amount',
        code: 'INVALID_AMOUNT',
      });
      return;
    }

    // Validate Chainflip fields
    if (!inputToken.chainflipId) {
      onError?.({
        message: 'Input token not configured for Chainflip',
        code: 'INVALID_TOKEN_CONFIG',
      });
      return;
    }

    if (!outputToken.chainflipId) {
      onError?.({
        message: 'Output token not configured for Chainflip',
        code: 'INVALID_TOKEN_CONFIG',
      });
      return;
    }

    try {
      // Reset state
      setIsExecuting(true);
      setDepositAddress(null);
      setSwapId(null);
      startTimeRef.current = Date.now();

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Stage 1: Preparing - Request deposit address
      setStage('preparing');
      onExecutionStart?.({
        stage: 'preparing',
        statusMessage: STAGE_MESSAGES.preparing,
      });

      console.log('🔄 Requesting Chainflip deposit address:', {
        from: `${inputToken.symbol} (${inputToken.chainflipId})`,
        to: `${outputToken.symbol} (${outputToken.chainflipId})`,
        amount: inputAmount,
        recipient: recipientAddress,
      });

      // Request deposit address from Chainflip (amount is passed as-is in human-readable format)
      const swapResponse: ChainflipSwapResponse = await chainflipClient.requestSwapDepositAddress({
        sourceAsset: inputToken.chainflipId,
        destinationAsset: outputToken.chainflipId,
        destinationAddress: recipientAddress,
        amount: inputAmount,  // Pass amount directly, no conversion needed
        refundAddress: walletAddress, // For refunds
      });

      console.log('✅ Deposit address received:', swapResponse);

      // Store swap details
      setDepositAddress(swapResponse.depositAddress);
      setSwapId(swapResponse.id);

      // Stage 2: Awaiting signature - User needs to send funds
      updateStage('awaiting_signature', {
        depositAddress: swapResponse.depositAddress,
        depositChannelId: swapResponse.depositChannel.id,
        expiresAt: swapResponse.depositChannel.expiresAt,
        swapId: swapResponse.id,
      });

      // Start polling for swap status
      // The parent component will send the transaction and we'll detect it via polling
      pollSwapStatus(swapResponse.id);

    } catch (error: unknown) {
      console.error('❌ Chainflip execution error:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to execute Chainflip swap';

      const userCancelled = errorMessage.includes('User rejected') ||
        errorMessage.includes('Cancelled') ||
        errorMessage.includes('User cancelled');

      setStage('failed');
      setIsExecuting(false);

      onError?.({
        message: errorMessage,
        code: userCancelled ? 'USER_CANCELLED' : undefined,
        userCancelled,
      });
    }
  }, [
    inputToken,
    outputToken,
    inputAmount,
    walletAddress,
    recipientAddress,
    onExecutionStart,
    updateStage,
    pollSwapStatus,
    onError,
  ]);

  return {
    executeSwap,
    stage,
    depositAddress,
    swapId,
    isExecuting,
  };
}

