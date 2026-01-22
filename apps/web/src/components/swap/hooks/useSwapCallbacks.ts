import { useCallback } from 'react';
import type { SwapProvider } from '@/services/xcm-router/assetRegistry';
import { buildRouteSummary } from '@/services/utils/routeSummary';
import type { TokenInfo } from '@/components/swap/types';

// Points per successful swap (must match server-side value)
const POINTS_PER_SWAP = 60;

interface SwapCallbacksProps {
  provider: SwapProvider | null;
  
  // Token and swap details
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  walletAddress: string;
  exchange?: string;
  
  // UI state setters
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
    pointsEarned?: number;
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
  inputToken,
  outputToken,
  inputAmount,
  walletAddress,
  exchange,
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
  const handleSwapSuccess = useCallback(async (success: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  }) => {
    let pointsEarned = 0;

    // Record swap and award points
    if (provider && inputToken && outputToken && walletAddress) {
      try {
        // Build route summary
        const routeSummary = buildRouteSummary(
          provider,
          inputToken.networkChain || inputToken.network || 'Unknown',
          outputToken.networkChain || outputToken.network || 'Unknown',
          exchange
        );

        // Record successful swap
        const recordResponse = await fetch('/api/swap-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            fromAsset: inputToken.symbol,
            toAsset: outputToken.symbol,
            inputAmount: success.inputAmount,
            outputAmount: success.outputAmount,
            chainFrom: inputToken.networkChain || inputToken.network || 'Unknown',
            chainTo: outputToken.networkChain || outputToken.network || 'Unknown',
            provider,
            routeSummary,
            status: 'success',
            durationMs: success.duration,
            pointsEarned: POINTS_PER_SWAP,
          }),
        });

        if (!recordResponse.ok) {
          throw new Error('Failed to record swap');
        }

        // Award points to user
        const pointsResponse = await fetch('/api/user/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        if (pointsResponse.ok) {
          const data = await pointsResponse.json();
          pointsEarned = data.pointsPerSwap;
        } else {
          pointsEarned = POINTS_PER_SWAP;
        }

        console.log(`✅ Swap recorded and ${pointsEarned} points awarded to ${walletAddress}`);
      } catch (error) {
        console.error('Failed to record swap or award points:', error);
        // Don't fail the whole swap if recording fails
      }
    }
    // For Chainflip swaps, complete immediately since Chainflip handles the full swap
    // For XCM swaps, wait for balance polling to confirm delivery
    if (provider === 'chainflip') {
      // Chainflip swap is already complete - mark it as successful immediately
      completeSwap({ ...success, pointsEarned });

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
        completeSwap({ ...success, pointsEarned });

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
    inputToken,
    outputToken,
    walletAddress,
    exchange,
    refreshBalances,
    resetRoute,
    resetToSender,
    setInputAmount,
    startBalancePolling,
    updateExecution,
  ]);

  // Error handler shared between XCM and Chainflip
  const handleSwapError = useCallback(async (error: { 
    message: string; 
    code?: string; 
    userCancelled?: boolean;
  }) => {
    // Record failed swap (only if not cancelled by user)
    if (!error.userCancelled && provider && inputToken && outputToken && walletAddress && inputAmount) {
      try {
        const routeSummary = buildRouteSummary(
          provider,
          inputToken.networkChain || inputToken.network || 'Unknown',
          outputToken.networkChain || outputToken.network || 'Unknown',
          exchange
        );

        await fetch('/api/swap-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            fromAsset: inputToken.symbol,
            toAsset: outputToken.symbol,
            inputAmount,
            chainFrom: inputToken.networkChain || inputToken.network || 'Unknown',
            chainTo: outputToken.networkChain || outputToken.network || 'Unknown',
            provider,
            routeSummary,
            status: 'failed',
            pointsEarned: 0,
          }),
        });

        console.log('❌ Failed swap recorded');
      } catch (recordError) {
        console.error('Failed to record failed swap:', recordError);
        // Don't fail if recording fails
      }
    }

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
    provider,
    inputToken,
    outputToken,
    walletAddress,
    inputAmount,
    exchange,
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

