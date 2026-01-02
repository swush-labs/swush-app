import { useCallback, useRef, useState, useEffect } from 'react';
import type { TokenInfo } from '@/components/swap/types';
import {
  chainflipClient,
  formatDuration,
  calculateMinimumPrice,
  minutesToBlocks,
  type ChainflipQuote,
  type ChainflipSwapResponse,
  type ChainflipSwapState,
  type ChainflipExecutionStage,
} from '@/services/chainflip';
import {
  sendEvmNativeDeposit,
  sendEvmTokenDeposit,
  sendPolkadotDeposit,
  getDepositType,
  type DepositResult,
} from '@/services/chainflip/signerUtils';

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
  slippageTolerance: number;
  evmSigner?: any;
  polkadotSigner?: any;

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
// Polling Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Polling interval for swap status checks (in milliseconds)
 * Default: 7.5 seconds (7500ms) - reduced from 10 seconds to lower API load
 */
const SWAP_STATUS_POLL_INTERVAL_MS = 7500;

/**
 * Maximum time to poll for swap status (in milliseconds)
 * Default: 30 minutes
 */
const MAX_POLL_TIME_MS = 30 * 60 * 1000;

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
  slippageTolerance,
  evmSigner,
  polkadotSigner,
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

    const startPollTime = Date.now();

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Check if we've exceeded max poll time
        if (Date.now() - startPollTime > MAX_POLL_TIME_MS) {
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

        // Log detailed status for debugging
        const swapState = status.status.state;
        console.log('📊 Swap status:', {
          swapId: status.id,
          state: swapState,
          depositAmount: status.status.depositAmount,
          egressAmount: status.status.egressAmount,
          depositTx: status.status.depositTransaction?.hash,
          egressTx: status.status.egressTransaction?.hash,
          error: status.status.error,
          explorerUrl: `https://scan.perseverance.chainflip.io/swaps/${status.id}`,
        });

        // Update stage based on status (API uses lowercase states)
        switch (swapState) {
          case 'waiting':
            // Waiting for deposit
            updateStage('awaiting_signature', { swapState: swapState });
            break;

          case 'receiving':
          case 'swapping':
          case 'sending':
          case 'sent':
            // Swap in progress
            updateStage('swap_executing', {
              swapState: swapState,
              txHash: status.status.depositTransaction?.hash || status.status.egressTransaction?.hash,
            });
            break;

          case 'completed':
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;

            updateStage('completed', {
              swapState: swapState,
              txHash: status.status.egressTransaction?.hash,
            });

            const duration = Date.now() - startTimeRef.current;
            console.log(`✅ Chainflip swap completed in ${duration}ms!`);

            onSuccess?.({
              duration,
              inputAmount,
              inputToken: inputToken?.symbol || '?',
              outputAmount: status.status.egressAmount || outputAmount || '?',
              outputToken: outputToken?.symbol || '?',
              swapId: swapIdToPoll,
              txHash: status.status.egressTransaction?.hash,
            });
            break;

          case 'failed':
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;

            updateStage('failed', { swapState: swapState });

            onError?.({
              message: status.status.error || status.status.failureReason || 'Swap failed',
              code: swapState,
            });
            break;
        }
      } catch (error) {
        // 404 errors are expected while deposit is being confirmed on-chain
        const is404 = error instanceof Error && error.message.includes('404');
        if (!is404) {
          console.error('❌ Error polling swap status:', error);
        }
        // Don't stop polling on transient errors (including 404s during confirmation)
      }
    }, SWAP_STATUS_POLL_INTERVAL_MS);
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

      // Calculate slippage protection parameters
      const retryMinutes = 15;
      let minimumPrice = '0';
      
      if (quote?.egressAmount && quote?.ingressAmount) {
        const estimatedPrice = parseFloat(quote.egressAmount) / parseFloat(quote.ingressAmount);
        minimumPrice = calculateMinimumPrice(estimatedPrice, slippageTolerance);
        console.log('💰 Slippage protection:', {
          estimatedPrice,
          slippagePercent: `${slippageTolerance}%`,
          minimumPrice,
        });
      }

      // Request deposit address from Chainflip with slippage protection
      const swapResponse: ChainflipSwapResponse = await chainflipClient.requestSwapDepositAddress({
        sourceAsset: inputToken.chainflipId,
        destinationAsset: outputToken.chainflipId,
        destinationAddress: recipientAddress,
        minimumPrice,
        refundAddress: walletAddress,
        retryDurationBlocks: minutesToBlocks(retryMinutes),
      });

      console.log('✅ Deposit address received:', swapResponse);

      // Store swap details
      setDepositAddress(swapResponse.address);
      setSwapId(swapResponse.id.toString());

      // Stage 2: Awaiting signature - Prompt user to sign the deposit transaction
      updateStage('awaiting_signature', {
        depositAddress: swapResponse.address,
        depositChannelId: swapResponse.channelId.toString(),
        expiresAt: new Date(swapResponse.sourceExpiryBlock * 6000).toISOString(), // Estimate expiry time
        swapId: swapResponse.id.toString(),
      });

      // Automatically send deposit transaction
      const depositType = getDepositType(
        inputToken.network || '', 
        inputToken.symbol
      );

      console.log('💸 Initiating deposit:', {
        type: depositType,
        network: inputToken.network,
        asset: inputToken.symbol,
        amount: inputAmount,
      });

      // Stage 3: Submitting transaction
      updateStage('submitting', {
        statusMessage: 'Submitting deposit transaction...',
      });

      let depositResult: DepositResult;
      switch (depositType) {
        case 'evm-native':
          // ETH on Ethereum or Arbitrum
          if (!evmSigner) {
            throw new Error('EVM wallet not connected');
          }
          if (!inputToken.chainId) {
            throw new Error('Token chainId not configured');
          }
          depositResult = await sendEvmNativeDeposit(
            evmSigner,
            swapResponse.address,
            inputAmount,
            inputToken.decimals || 18,
            inputToken.chainId
          );
          break;

        case 'evm-token':
          // USDC, USDT, FLIP, etc. on Ethereum, Sepolia, or Arbitrum
          if (!evmSigner) {
            throw new Error('EVM wallet not connected');
          }
          if (!inputToken.contractAddress) {
            throw new Error('Token contract address not configured');
          }
          if (!inputToken.chainId) {
            throw new Error('Token chainId not configured');
          }
          depositResult = await sendEvmTokenDeposit(
            evmSigner,
            swapResponse.address,
            inputToken.contractAddress,
            inputAmount,
            inputToken.decimals || 6,
            inputToken.chainId
          );
          break;

        case 'polkadot-native':
        case 'polkadot-token':
          // DOT or tokens on AssetHub
          if (!polkadotSigner) {
            throw new Error('Polkadot wallet not connected');
          }
          const assetId = depositType === 'polkadot-token' 
            ? inputToken.assetId  // e.g., "1337" for USDC
            : undefined;
          depositResult = await sendPolkadotDeposit(
            polkadotSigner,
            swapResponse.address,
            inputAmount,
            inputToken.decimals || 10,
            assetId
          );
          break;

        default:
          throw new Error(
            `Unsupported deposit type for ${inputToken.symbol} on ${inputToken.network}. ` +
            'Please send funds manually to the deposit address.'
          );
      }

      // Check if deposit was successful
      if (!depositResult.success) {
        throw new Error(depositResult.error || 'Deposit transaction failed');
      }

      console.log('✅ Deposit transaction submitted:', depositResult.txHash);

      // Stage 4: Confirming - Wait for source chain confirmation
      updateStage('confirming', {
        statusMessage: 'Waiting for deposit confirmation...',
        txHash: depositResult.txHash,
      });

      // Start polling for swap status
      // Chainflip will detect the deposit and begin the swap
      pollSwapStatus(swapResponse.id.toString());

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
    quote,
    slippageTolerance,
    evmSigner,
    polkadotSigner,
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

