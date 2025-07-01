import { toast } from 'react-hot-toast';

// Responsive toast styling that adapts to screen size
const getResponsiveToastStyle = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  
  if (isMobile) {
    return {
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '13px',
      maxWidth: '90vw',
      minWidth: 'auto',
      boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.05)'
    };
  } else {
    return {
      borderRadius: '12px',
      padding: '12px 16px',
      fontSize: '14px',
      maxWidth: '400px',
      minWidth: '300px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    };
  }
};

const getLoadingToastStyle = () => ({
  ...getResponsiveToastStyle(),
  background: '#1f2937',
  color: '#f9fafb',
  border: '1px solid #374151'
});

const getSuccessToastStyle = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  return {
    ...getResponsiveToastStyle(),
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: '1px solid #047857',
    fontWeight: '600',
    boxShadow: isMobile 
      ? '0 4px 12px -2px rgba(16, 185, 129, 0.15), 0 2px 4px -1px rgba(16, 185, 129, 0.05)'
      : '0 10px 25px -5px rgba(16, 185, 129, 0.25), 0 4px 6px -2px rgba(16, 185, 129, 0.05)'
  };
};

const getErrorToastStyle = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  return {
    ...getResponsiveToastStyle(),
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#ffffff',
    border: '1px solid #b91c1c',
    fontWeight: '600',
    boxShadow: isMobile 
      ? '0 4px 12px -2px rgba(239, 68, 68, 0.15), 0 2px 4px -1px rgba(239, 68, 68, 0.05)'
      : '0 10px 25px -5px rgba(239, 68, 68, 0.25), 0 4px 6px -2px rgba(239, 68, 68, 0.05)'
  };
};

// Toast IDs for consistent management
export const TOAST_IDS = {
  SWAP_PREPARE: 'swap-prepare',
  SWAP_STATUS: 'swap-status',
  SWAP_SUCCESS: 'swap-success',
  SWAP_ERROR: 'swap-error',
  XCM_ERROR: 'xcm-error',
  CHOPSTICKS_STATUS: 'chopsticks-status',
  WALLET_CONNECTION: 'wallet-connection'
} as const;

// Swap transaction toast functions
export const SwapToasts = {
  // Dismiss functions
  dismiss: (toastId: string) => toast.dismiss(toastId),
  dismissAll: () => Object.values(TOAST_IDS).forEach(id => toast.dismiss(id)),

  // Processing states
  confirmAndSign: () => {
    return toast.loading('🔄 Please confirm and sign the transaction...', {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 60000,
      style: getLoadingToastStyle()
    });
  },

  processing: () => {
    toast.dismiss(TOAST_IDS.SWAP_PREPARE);
    return toast.loading('⚡ Processing your swap...', {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 60000,
      style: getLoadingToastStyle()
    });
  },

  xcmTransfer: () => {
    return toast.loading('🌉 Completing cross-chain transfer...', {
      id: TOAST_IDS.SWAP_STATUS,
      style: getLoadingToastStyle()
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
      style: getSuccessToastStyle()
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
      style: getSuccessToastStyle()
    });
  },

  // Error states
  transactionFailed: () => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    return toast.error('Transaction failed. Please try again.', {
      id: TOAST_IDS.SWAP_ERROR,
      duration: 5000,
      icon: '❌',
      style: getErrorToastStyle()
    });
  },

  xcmFailed: () => {
    toast.dismiss(TOAST_IDS.SWAP_STATUS);
    return toast.error('Cross-chain transfer failed. Please try again.', {
      id: TOAST_IDS.XCM_ERROR,
      duration: 5000,
      icon: '❌',
      style: getErrorToastStyle()
    });
  },

  // Generic error toast
  error: (message: string, toastId: string = TOAST_IDS.SWAP_ERROR, duration: number = 5000) => {
    return toast.error(message, {
      id: toastId,
      duration,
      icon: '❌',
      style: getErrorToastStyle()
    });
  },

  // Chopsticks-specific toasts
  chopsticksChecking: () => {
    return toast.loading('Checking demo environment...', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      style: getLoadingToastStyle()
    });
  },

  chopsticksReady: () => {
    return toast.success('Demo environment ready!', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      icon: '✅',
      duration: 2000,
      style: getSuccessToastStyle()
    });
  },

  chopsticksStarting: () => {
    return toast.loading('Starting demo environment...', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      style: getLoadingToastStyle()
    });
  },

  chopsticksStarted: () => {
    return toast.success('Demo environment started!', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      icon: '✅',
      duration: 3000,
      style: getSuccessToastStyle()
    });
  },

  chopsticksFailed: () => {
    return toast.error('Demo environment failed to start', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      icon: '🔴',
      style: getErrorToastStyle()
    });
  },

  chopsticksReconnected: () => {
    return toast.success('Demo environment reconnected!', {
      id: TOAST_IDS.CHOPSTICKS_STATUS,
      icon: '✅',
      duration: 3000,
      style: getSuccessToastStyle()
    });
  },

  // Wallet connection toasts
  walletConnecting: (message: string = 'Connecting wallet...', icon: string = '🔑') => {
    return toast.loading(message, {
      id: TOAST_IDS.WALLET_CONNECTION,
      icon,
      style: getLoadingToastStyle()
    });
  },

  walletConnected: (message: string = 'Wallet connected successfully!', icon: string = '✅') => {
    return toast.success(message, {
      id: TOAST_IDS.WALLET_CONNECTION,
      icon,
      duration: 3000,
      style: getSuccessToastStyle()
    });
  },

  walletConnectionFailed: (message: string = 'Failed to connect wallet') => {
    return toast.error(message, {
      id: TOAST_IDS.WALLET_CONNECTION,
      style: getErrorToastStyle()
    });
  },

  walletDisconnected: () => {
    return toast.success('Wallet disconnected', {
      duration: 2000,
      style: getSuccessToastStyle()
    });
  }
};