import { useState, useCallback } from 'react';
import { SimulationResult } from '@/components/swap/ui/SwapConfirmSheet';

// Define the global window type with our custom property
declare global {
  interface Window {
    swapConfirmResolve?: (value: boolean) => void;
  }
}

interface UseSwapConfirmationProps {
  setIsSwapping: (value: boolean) => void;
}

export function useSwapConfirmation({ setIsSwapping }: UseSwapConfirmationProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isConfirmingSwap, setIsConfirmingSwap] = useState(false);
  const [isSwapComplete, setIsSwapComplete] = useState(false);
  const [isSwappingInProgress, setIsSwappingInProgress] = useState(false);

  // Handle simulation results and confirmation
  const handleSimulationComplete = useCallback(async (result: SimulationResult) => {
    setSimulationResult(result);
    setShowConfirmation(true);
    setIsConfirmingSwap(false); // Reset confirmation UI state
    
    // If simulation failed, we should prepare for user to potentially cancel
    if (!result.success) {
      console.warn('Simulation failed:', result.error);
    }
    
    // Return a promise that resolves when user confirms or cancels
    return new Promise<boolean>((resolve) => {
      window.swapConfirmResolve = (value) => {
        // If the user cancels, make sure we reset the swapping state
        if (!value) {
          setIsSwapping(false);
        }
        resolve(value);
      };
    });
  }, [setIsSwapping]);
  
  const handleConfirmSwap = useCallback(() => {
    setIsConfirmingSwap(true); // Set confirming state before closing sheet
    setIsSwappingInProgress(true);
    setShowConfirmation(false);
    setTimeout(() => {
      setIsSwapComplete(true);
      setIsSwappingInProgress(false);
    },3000)
    if (window.swapConfirmResolve) {
      window.swapConfirmResolve(true);
      window.swapConfirmResolve = undefined;
    }
  }, []);
  
  const handleCancelSwap = useCallback(() => {
    setShowConfirmation(false);
    setIsConfirmingSwap(false); // Reset confirmation UI state on cancel
    setIsSwapping(false); // Reset the main swap button state when canceling
    if (window.swapConfirmResolve) {
      window.swapConfirmResolve(false);
      window.swapConfirmResolve = undefined;
    }
  }, [setIsSwapping]);

  const resetConfirmationState = useCallback(() => {
    setShowConfirmation(false);
    setIsConfirmingSwap(false);
    if (window.swapConfirmResolve) {
      window.swapConfirmResolve(false);
      window.swapConfirmResolve = undefined;
    }
  }, []);

  return {
    showConfirmation,
    setShowConfirmation,
    simulationResult,
    isConfirmingSwap,
    isSwapComplete,
    isSwappingInProgress,
    handleSimulationComplete,
    handleConfirmSwap,
    handleCancelSwap,
    resetConfirmationState
  };
} 