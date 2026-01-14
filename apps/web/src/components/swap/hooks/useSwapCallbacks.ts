import { useCallback } from 'react';
import type { SwapProvider } from '@/services/xcm-router/assetRegistry';

interface SwapCallbacksProps {
  provider: SwapProvider | null;
  setInputAmount: (value: string) => void;
  resetRoute: () => void;
  resetToSender: () => void;
  refreshBalances: (force?: boolean) => void;
  startBalancePolling: (onBalanceUpdate: () => void) => void;
  stopBalancePolling: () => void;
  resetBalances: (force?: boolean) => void;
  resetSwapFlow: () => void;
  completeSwap: (success: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  }) => void;
  failSwap: (error: { message: string; code?: string; userCancelled?: boolean }) => void;
  updateExecution: (execution: { statusMessage: string }) => void;
}

/**
 * Custom hook to handle swap success and error callbacks
 * Encapsulates the complex logic for handling swap completion and errors
 */
export function useSwapCallbacks({
  provider,
  setInputAmount,
  resetRoute,
  resetToSender,
  refreshBalances,
  startBalancePolling,
  stopBalancePolling,
  resetBalances,
  resetSwapFlow,
  completeSwap,
  failSwap,
  updateExecution,
}: SwapCallbacksProps) {
  
  // Success handler shared between XCM and Chainflip
  const handleSwapSuccess = useCallback((success: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  }) => {
    // For Chainflip swaps, complete immediately since Chainflip handles the full swap
    // For XCM swaps, wait for balance polling to confirm delivery
    if (provider === 'chainflip') {
      // Chainflip swap is already complete - mark it as successful immediately
      completeSwap(success);

      // Clear input and route immediately (but don't close dialog)
      setInputAmount('');
      resetRoute();

      // Reset recipient to sender after successful swap (for safety)
      resetToSender();

      // Refresh input balance to show deduction
      refreshBalances(true);
    } else {
      // XCM: Wait for destination balance to update before marking as successful
      // Start polling destination balance to confirm delivery
      startBalancePolling(() => {
        // Mark swap as successful when balance increases
        completeSwap(success);

        // Clear input and route immediately (but don't close dialog)
        setInputAmount('');
        resetRoute();

        // Reset recipient to sender after successful swap (for safety)
        resetToSender();

        // Refresh input balance to show deduction
        refreshBalances(true);
      });
    }

    // Update UI to show "waiting for delivery" state (only for XCM)
    updateExecution({
      statusMessage: provider === 'chainflip' 
        ? 'Chainflip is processing your swap...' 
        : 'Waiting for cross-chain delivery...',
    });
  }, [
    completeSwap,
    provider,
    refreshBalances,
    resetRoute,
    resetToSender,
    setInputAmount,
    startBalancePolling,
    updateExecution,
  ]);

  // Error handler shared between XCM and Chainflip
  const handleSwapError = useCallback((error: { 
    message: string; 
    code?: string; 
    userCancelled?: boolean;
  }) => {
    failSwap(error);
    // Stop any ongoing balance polling
    stopBalancePolling();
    // Refresh balances after failed transaction
    resetBalances(true);
    // Auto-reset after showing error state
    setTimeout(() => {
      setInputAmount('');
      resetRoute();
      resetSwapFlow();
    }, 5000);
  }, [
    failSwap,
    resetBalances,
    resetRoute,
    resetSwapFlow,
    setInputAmount,
    stopBalancePolling,
  ]);

  return {
    handleSwapSuccess,
    handleSwapError,
  };
}

