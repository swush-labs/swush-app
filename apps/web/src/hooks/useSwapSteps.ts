import { useState } from 'react';
import { toast } from 'react-hot-toast';
import type { SigningStep } from '@/components/swap';
import { mockBlockchainTransaction } from '@/components/swap';

interface UseSwapStepsProps {
  inputToken: string;
  outputToken: string;
}

export function useSwapSteps({ inputToken, outputToken }: UseSwapStepsProps) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [showSwapProgress, setShowSwapProgress] = useState(false);
  
  const [swapSteps, setSwapSteps] = useState<SigningStep[]>([
    { 
      id: 1, 
      title: `Approve ${inputToken}`,
      description: `Allow the smart contract to spend your ${inputToken}`,
      status: 'pending',
      needsSignature: true
    },
    { 
      id: 2, 
      title: `Swap ${inputToken} → USDC`,
      description: `Swap ${inputToken} to USDC via Moonbeam DEX`,
      status: 'waiting',
      needsSignature: true
    },
    { 
      id: 3, 
      title: `Swap USDC → ${outputToken}`,
      description: `Swap USDC to ${outputToken} via Bridge`,
      status: 'waiting',
      needsSignature: true
    },
  ]);

  const handleSwap = async (isConnected: boolean) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first', { icon: '🔒' });
      return;
    }
    
    setShowSwapProgress(true);
    setIsSwapping(true);
  };

  const handleSignStep = async (stepId: number) => {
    try {
      setSwapSteps(steps => steps.map(step => ({
        ...step,
        status: step.id === stepId ? 'loading' : step.status
      })));

      await new Promise(r => setTimeout(r, 2000));
      const success = await mockBlockchainTransaction();
      
      if (!success) {
        setSwapSteps(steps => steps.map(step => ({
          ...step,
          status: step.id === stepId ? 'failed' : step.status
        })));
        throw new Error(`Step ${stepId} failed`);
      }

      setSwapSteps(steps => steps.map(step => ({
        ...step,
        status: 
          step.id === stepId ? 'completed' :
          step.id === stepId + 1 ? 'pending' :
          step.status
      })));

    } catch (error) {
      console.error('Step failed:', error);
      toast.error(`Failed to complete step ${stepId}`, { icon: '❌' });
    }
  };

  const closeSwapProgress = () => {
    setShowSwapProgress(false);
    setIsSwapping(false);
    // Reset steps to initial state
    setSwapSteps(steps => steps.map(step => ({
      ...step,
      status: step.id === 1 ? 'pending' : 'waiting'
    })));
  };

  return {
    swapSteps,
    isSwapping,
    setIsSwapping,
    showSwapProgress,
    handleSwap,
    handleSignStep,
    closeSwapProgress,
  };
} 