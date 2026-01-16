import { useCallback } from 'react';
import { useXcmSwapExecution } from './useXcmSwapExecution';
import { useChainflipExecution } from './useChainflipExecution';
import type { SwapProvider } from '@/services/xcm-router/assetRegistry';
import type { PolkadotSigner } from 'polkadot-api';

interface UnifiedSwapExecutionProps {
  // Provider info
  provider: SwapProvider | null;
  
  // Token info
  inputToken: any;
  outputToken: any;
  
  // Amounts
  inputAmount: string;
  outputAmount: string;
  
  // Addresses
  walletAddress: string;
  recipientAddress: string;
  
  // Signers
  senderPolkadotSigner: PolkadotSigner | undefined;
  recipientPolkadotSigner: PolkadotSigner | undefined;
  evmSigner: any;
  
  // Settings
  slippageTolerance: number;
  
  // XCM-specific
  xcmRouteExchange: any;
  getOptimalExchanges: any;
  determineCurrency: any;
  getTAssetFromKey: any;
  
  // Chainflip-specific
  chainflipQuote: any;
  
  // Flow callbacks
  onExecutionStart: (execution: any) => void;
  onExecutionUpdate: (execution: any) => void;
  onSuccess: (success: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  }) => void;
  onError: (error: { message: string; code?: string; userCancelled?: boolean }) => void;
  
  // Config
  enableXcmTracking?: boolean;
  ocelloidsApiKey?: string;
}

/**
 * Unified swap execution hook that handles both XCM and Chainflip swaps
 * Encapsulates all execution logic and callbacks in one place
 */
export function useUnifiedSwapExecution({
  provider,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  walletAddress,
  recipientAddress,
  senderPolkadotSigner,
  recipientPolkadotSigner,
  evmSigner,
  slippageTolerance,
  xcmRouteExchange,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
  chainflipQuote,
  onExecutionStart,
  onExecutionUpdate,
  onSuccess,
  onError,
  enableXcmTracking,
  ocelloidsApiKey,
}: UnifiedSwapExecutionProps) {
  
  // XCM Swap execution
  const { executeSwap: executeXcmSwap } = useXcmSwapExecution({
    inputToken: provider === 'xcm' ? inputToken : null,
    outputToken: provider === 'xcm' ? outputToken : null,
    inputAmount,
    outputAmount,
    slippageTolerance,
    walletAddress,
    recipientAddress,
    senderPolkadotSigner,
    recipientPolkadotSigner,
    selectedExchange: xcmRouteExchange,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    onExecutionStart,
    onExecutionUpdate,
    onSuccess,
    onError,
    enableXcmTracking,
    ocelloidsApiKey,
  });

  // Chainflip Swap execution
  const { 
    executeSwap: executeChainflipSwap,
    depositAddress: chainflipDepositAddress,
    stage: chainflipStage,
  } = useChainflipExecution({
    inputToken: provider === 'chainflip' ? inputToken : null,
    outputToken: provider === 'chainflip' ? outputToken : null,
    inputAmount,
    outputAmount,
    quote: chainflipQuote || null,
    walletAddress,
    recipientAddress,
    slippageTolerance,
    evmSigner,
    polkadotSigner: senderPolkadotSigner,
    onExecutionStart: (execution) => {
      onExecutionStart({
        currentStep: 0,
        totalSteps: 1, // Chainflip: user signs deposit once, then Chainflip handles everything
        transactionType: null,
        statusMessage: execution.statusMessage,
      });
    },
    onExecutionUpdate: (execution) => {
      onExecutionUpdate({
        statusMessage: execution.statusMessage,
      });
    },
    onSuccess: (success) => onSuccess({
      duration: success.duration,
      inputAmount: success.inputAmount,
      inputToken: success.inputToken,
      outputAmount: success.outputAmount,
      outputToken: success.outputToken,
    }),
    onError,
  });

  // Unified execute function that routes to the correct provider
  const executeSwap = useCallback(() => {
    if (provider === 'chainflip') {
      return executeChainflipSwap();
    }
    return executeXcmSwap();
  }, [provider, executeChainflipSwap, executeXcmSwap]);

  return {
    executeSwap,
    // Expose Chainflip-specific state for UI (if needed)
    chainflipDepositAddress,
    chainflipStage,
  };
}

