import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { TokenInfo } from '@/components/swap/types';

interface UseSwapExecutionProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  insufficientBalance: boolean;
  executeAssetConversionSwap: () => Promise<void>;
  handleSwap: (isUserConnected: boolean) => void;
  setIsSwapping: (value: boolean) => void;
  setIsConfirmingSwap: (value: boolean) => void;
  closeSwapProgress: () => void;
}

export function useSwapExecution({
  inputToken,
  outputToken,
  inputAmount,
  insufficientBalance,
  executeAssetConversionSwap,
  handleSwap,
  setIsSwapping,
  setIsConfirmingSwap,
  closeSwapProgress
}: UseSwapExecutionProps) {
  
  const handleSwapExecution = useCallback(async (isUserConnected: boolean) => {
    if (!isUserConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!inputToken || !outputToken) {
      toast.error('Please select tokens for swap');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Please enter a valid amount to swap');
      return;
    }

    if (insufficientBalance) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      // Show the swap progress modal
      handleSwap(isUserConnected);

      // Execute the actual swap
      await executeAssetConversionSwap();
    } catch (error) {
      console.error('Error during swap execution:', error);
      // Only show toast if not already shown with same ID
      if (!document.getElementById('swap-error')) {
        toast.error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'swap-error' });
      }
      setIsSwapping(false);
      setIsConfirmingSwap(false); // Reset confirmation UI state on error
      closeSwapProgress();
    }
  }, [
    inputToken, 
    outputToken, 
    inputAmount, 
    insufficientBalance,
    handleSwap, 
    executeAssetConversionSwap, 
    setIsSwapping, 
    setIsConfirmingSwap,
    closeSwapProgress
  ]);

  return {
    handleSwapExecution
  };
} 