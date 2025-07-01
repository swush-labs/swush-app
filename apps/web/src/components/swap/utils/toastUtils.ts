import { toast } from 'react-hot-toast';

// Base toast styling configurations
const baseToastStyle = {
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
};

const loadingToastStyle = {
  ...baseToastStyle,
  background: '#1f2937',
  color: '#f9fafb',
  border: '1px solid #374151'
};

const successToastStyle = {
  ...baseToastStyle,
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: '#ffffff',
  border: '1px solid #047857',
  fontSize: '14px',
  fontWeight: '600',
  boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.25), 0 4px 6px -2px rgba(16, 185, 129, 0.05)'
};

const errorToastStyle = {
  ...baseToastStyle,
  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  color: '#ffffff',
  border: '1px solid #b91c1c',
  fontSize: '14px',
  fontWeight: '600',
  boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.25), 0 4px 6px -2px rgba(239, 68, 68, 0.05)'
};

// Toast IDs for consistent management
export const TOAST_IDS = {
  SWAP_PREPARE: 'swap-prepare',
  SWAP_STATUS: 'swap-status',
  SWAP_SUCCESS: 'swap-success',
  SWAP_ERROR: 'swap-error',
  XCM_ERROR: 'xcm-error'
} as const;

// Swap transaction toast functions
export const SwapToasts = {
  // Dismiss functions
  dismiss: (toastId: string) => toast.dismiss(toastId),
  dismissAll: () => Object.values(TOAST_IDS).forEach(id => toast.dismiss(id)),

  // Processing states
  confirmAndSign: () => {
    return toast.loading('Please confirm and sign the transaction...', {
      id: TOAST_IDS.SWAP_STATUS,
      icon: '🥤',
      duration: 60000,
      style: loadingToastStyle
    });
  },

  processing: () => {
    toast.dismiss(TOAST_IDS.SWAP_PREPARE);
    return toast.loading('Processing your swap...', {
      icon: '⚡',
      id: TOAST_IDS.SWAP_STATUS,
      duration: 60000,
      style: loadingToastStyle
    });
  },

  xcmTransfer: () => {
    return toast.loading('Completing cross-chain transfer...', {
      icon: '🌉',
      id: TOAST_IDS.SWAP_STATUS,
      style: loadingToastStyle
    });
  },

  // Success states
  swapSuccess: (swapDetails?: { inputAmount: string; inputToken: string; outputToken: string }) => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    const message = swapDetails 
      ? `Swap completed! ${swapDetails.inputAmount} ${swapDetails.inputToken} → ${swapDetails.outputToken}`
      : 'Swap completed successfully!';
    
    return toast.success(message, {
      id: TOAST_IDS.SWAP_SUCCESS,
      duration: 7500,
      icon: '🎉',
      style: successToastStyle
    });
  },

  xcmSuccess: (swapDetails?: { inputAmount: string; inputToken: string; outputToken: string }) => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    const message = swapDetails 
      ? `Swap completed! ${swapDetails.inputAmount} ${swapDetails.inputToken} → ${swapDetails.outputToken}`
      : 'Cross-chain swap completed successfully!';
    
    return toast.success(message, {
      id: TOAST_IDS.SWAP_SUCCESS,
      duration: 7500,
      icon: '🎉',
      style: successToastStyle
    });
  },

  // Error states
  transactionFailed: () => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    return toast.error('Transaction failed. Please try again.', {
      id: TOAST_IDS.SWAP_ERROR,
      duration: 5000,
      icon: '❌',
      style: errorToastStyle
    });
  },

  xcmFailed: () => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    return toast.error('Cross-chain transfer failed. Please try again.', {
      id: TOAST_IDS.XCM_ERROR,
      duration: 5000,
      icon: '❌',
      style: errorToastStyle
    });
  },

  // Generic error toast
  error: (message: string, toastId: string = TOAST_IDS.SWAP_ERROR, duration: number = 5000) => {
    return toast.error(message, {
      id: toastId,
      duration,
      icon: '❌',
      style: errorToastStyle
    });
  }
};