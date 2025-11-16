import { useState, useCallback, useEffect, useRef } from 'react';
import { SwapToasts, TOAST_IDS } from '../utils/toastUtils';
import type { TRouterEventType } from '@paraspell/xcm-router';
import type { SimulationResult } from '../ui/SwapConfirmSheet';

/**
 * Swap Flow Stages - Represents the complete lifecycle of a swap
 */
export type SwapFlowStage = 
  | 'idle'                    // No swap in progress
  | 'confirming'              // Showing confirmation sheet to user
  | 'awaiting_signature'      // Waiting for wallet to sign transaction
  | 'executing'               // Transaction executing on-chain
  | 'success'                 // Swap completed successfully
  | 'error';                  // Swap failed

/**
 * Unified Swap Flow State
 * Single source of truth for entire swap lifecycle
 */
export interface SwapFlowState {
  // Core flow stage
  stage: SwapFlowStage;
  
  // Execution details (only when stage = 'executing')
  execution?: {
    currentStep: number;
    totalSteps: number;
    transactionType: TRouterEventType | null;
    statusMessage: string;
    xcmDeliveryStatus?: 'idle' | 'pending' | 'in-flight' | 'delivered' | 'failed';
    xcmStatusMessage?: string;
  };
  
  // Success details (only when stage = 'success')
  success?: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  };
  
  // Error details (only when stage = 'error')
  error?: {
    message: string;
    code?: string;
    userCancelled?: boolean;
  };
  
  // Simulation result (from confirmation phase)
  simulationResult?: SimulationResult | null;
}

const INITIAL_STATE: SwapFlowState = {
  stage: 'idle',
  simulationResult: null
};

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
 * Unified Swap Flow Hook
 * 
 * Manages the complete swap lifecycle with a state machine approach.
 * Centralizes all swap-related state and toast management.
 * 
 * Benefits:
 * - Single source of truth for swap state
 * - Predictable state transitions
 * - Centralized toast management
 * - Easier debugging and testing
 * - No race conditions or state duplication
 * 
 * @returns Swap flow state and transition functions
 */
export function useSwapFlow() {
  const [flowState, setFlowState] = useState<SwapFlowState>(INITIAL_STATE);
  const previousStageRef = useRef<SwapFlowStage>('idle');

  /**
   * Centralized toast management based on stage transitions
   * Toasts are automatically shown/dismissed when stage changes
   */
  useEffect(() => {
    const prevStage = previousStageRef.current;
    const currentStage = flowState.stage;

    // Only trigger toasts on stage changes
    if (prevStage === currentStage) return;

    console.log(`🔄 Swap flow transition: ${prevStage} → ${currentStage}`);

    // Helper to dismiss previous toasts
    const dismissPrevious = () => {
      SwapToasts.dismiss(TOAST_IDS.SWAP_STATUS);
    };

    switch (currentStage) {
      case 'idle':
        // Clean slate - dismiss any lingering toasts
        dismissPrevious();
        break;

      case 'confirming':
        // No toast needed - confirmation sheet is visible
        dismissPrevious();
        break;

      case 'awaiting_signature':
        // Show wallet signature prompt
        dismissPrevious();
        // SwapToasts.confirmAndSign();
        break;

      case 'executing':
        // No toast during execution - dialog shows detailed progress
        dismissPrevious();
        break;

      case 'success':
        // Success is shown in SwapCompleteDialog with gift animation
        // Toast commented out to avoid redundancy with dialog
        dismissPrevious();
        // TODO: Uncomment if we want toast notification after dialog closes
        // if (flowState.success) {
        //   SwapToasts.swapSuccess({
        //     inputAmount: flowState.success.inputAmount,
        //     inputToken: flowState.success.inputToken,
        //     outputToken: flowState.success.outputToken
        //   });
        // }
        break;

      case 'error':
        // Show error toast
        dismissPrevious();
        if (flowState.error) {
          const { message, userCancelled } = flowState.error;
          if (userCancelled) {
            SwapToasts.error('Transaction cancelled by user');
          } else {
            SwapToasts.error(message);
          }
        }
        break;
    }

    previousStageRef.current = currentStage;
  }, [flowState.stage, flowState.success, flowState.error]);

  /**
   * Transition: IDLE → CONFIRMING
   * User clicks "Swap" button, show confirmation sheet
   */
  const startConfirmation = useCallback((simulationResult: SimulationResult) => {
    console.log('📋 Starting confirmation with simulation:', simulationResult);
    setFlowState({
      stage: 'confirming',
      simulationResult
    });
  }, []);

  /**
   * Transition: CONFIRMING → AWAITING_SIGNATURE
   * User confirms swap, now waiting for wallet signature
   */
  const confirmSwap = useCallback(() => {
    console.log('✅ User confirmed swap, awaiting signature...');
    setFlowState(prev => ({
      ...prev,
      stage: 'awaiting_signature'
    }));
  }, []);

  /**
   * Transition: CONFIRMING/AWAITING_SIGNATURE → IDLE
   * User cancels the swap
   */
  const cancelSwap = useCallback(() => {
    console.log('❌ User cancelled swap');
    setFlowState(INITIAL_STATE);
  }, []);

  /**
   * Transition: AWAITING_SIGNATURE → EXECUTING
   * User signed transaction, execution started
   */
  const startExecution = useCallback((execution: SwapFlowState['execution']) => {
    console.log('🚀 Execution started:', execution);
    setFlowState(prev => ({
      ...prev,
      stage: 'executing',
      execution
    }));
  }, []);

  /**
   * Update execution progress (stays in EXECUTING stage)
   * Updates step count, transaction type, status message
   */
  const updateExecution = useCallback((execution: Partial<SwapFlowState['execution']>) => {
    setFlowState(prev => {
      if (prev.stage !== 'executing' || !prev.execution) return prev;
      
      return {
        ...prev,
        execution: { ...prev.execution, ...execution }
      };
    });
  }, []);

  /**
   * Transition: EXECUTING → SUCCESS
   * Swap completed successfully
   */
  const completeSwap = useCallback((success: SwapFlowState['success']) => {
    console.log('🎉 Swap completed successfully:', success);
    setFlowState({
      stage: 'success',
      success
    });
  }, []);

  /**
   * Transition: EXECUTING/AWAITING_SIGNATURE → ERROR
   * Swap failed or user rejected
   */
  const failSwap = useCallback((error: SwapFlowState['error']) => {
    console.error('💥 Swap failed:', error);
    setFlowState({
      stage: 'error',
      error
    });
  }, []);

  /**
   * Transition: ANY → IDLE
   * Reset to initial state
   */
  const reset = useCallback(() => {
    console.log('🔄 Resetting swap flow to idle');
    setFlowState(INITIAL_STATE);
  }, []);

  return {
    // Current state
    flowState,
    
    // Transition functions
    startConfirmation,
    confirmSwap,
    cancelSwap,
    startExecution,
    updateExecution,
    completeSwap,
    failSwap,
    reset,
    
    // Computed properties for convenience
    isIdle: flowState.stage === 'idle',
    isConfirming: flowState.stage === 'confirming',
    isAwaitingSignature: flowState.stage === 'awaiting_signature',
    isExecuting: flowState.stage === 'executing',
    isSuccess: flowState.stage === 'success',
    isError: flowState.stage === 'error',
    isActive: flowState.stage !== 'idle',
  };
}

