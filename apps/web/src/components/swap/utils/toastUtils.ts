import { toast } from 'react-hot-toast';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../../tailwind.config';

// Resolve Tailwind config to access theme colors
const fullConfig = resolveConfig(tailwindConfig);
const colors = fullConfig.theme?.colors as any;

/**
 * Toast Color Palette
 * 
 * Centralized color definitions for toast notifications.
 * Colors are defined in tailwind.config.ts under `theme.extend.colors.toast`
 * 
 * Design Philosophy:
 * - Success: Emerald green gradient - conveys confidence and positive completion
 * - Error: Warm orange gradient - draws attention without being alarming or harsh
 * - Loading: Neutral dark gray - unobtrusive, doesn't compete with content
 * 
 * Why orange for errors instead of red?
 * - Red is too aggressive and creates anxiety
 * - Orange is warm, friendly, and still indicates "pay attention"
 * - Matches the overall warm, approachable tone of the app
 * - Pairs perfectly with the ⚠️ warning emoji
 */
const TOAST_COLORS = {
  success: {
    from: colors.toast.success.from,      // #10b981 (emerald-500)
    to: colors.toast.success.to,          // #059669 (emerald-600)
    border: colors.toast.success.border,  // #047857 (emerald-700)
  },
  error: {
    from: colors.toast.error.from,        // #fb923c (orange-400)
    to: colors.toast.error.to,            // #f97316 (orange-500)
    border: colors.toast.error.border,    // #ea580c (orange-600)
  },
  loading: {
    bg: colors.toast.loading.bg,          // #1f2937 (gray-800)
    text: colors.toast.loading.text,      // #f9fafb (gray-50)
    border: colors.toast.loading.border,  // #374151 (gray-700)
  },
};

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
  background: TOAST_COLORS.loading.bg,
  color: TOAST_COLORS.loading.text,
  border: `1px solid ${TOAST_COLORS.loading.border}`
});

const getSuccessToastStyle = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  return {
    ...getResponsiveToastStyle(),
    background: `linear-gradient(135deg, ${TOAST_COLORS.success.from} 0%, ${TOAST_COLORS.success.to} 100%)`,
    color: '#ffffff',
    border: `1px solid ${TOAST_COLORS.success.border}`,
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
    background: `linear-gradient(135deg, ${TOAST_COLORS.error.from} 0%, ${TOAST_COLORS.error.to} 100%)`,
    color: '#ffffff',
    border: `1px solid ${TOAST_COLORS.error.border}`,
    fontWeight: '600',
    boxShadow: isMobile 
      ? '0 4px 12px -2px rgba(251, 146, 60, 0.15), 0 2px 4px -1px rgba(251, 146, 60, 0.05)'
      : '0 10px 25px -5px rgba(251, 146, 60, 0.25), 0 4px 6px -2px rgba(251, 146, 60, 0.05)'
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
    return toast.loading('Validating swap...', {
      id: TOAST_IDS.SWAP_STATUS,
      style: getLoadingToastStyle(),
      icon: '🧪'
    });
  },

  processing: () => {
    return toast.loading('Processing your swap...', {
      id: TOAST_IDS.SWAP_STATUS,
      style: getLoadingToastStyle(),
      icon: '⚡'
    });
  },

  xcmTransfer: () => {
    return toast.loading('Completing cross-chain transfer...', {
      id: TOAST_IDS.SWAP_STATUS,
      style: getLoadingToastStyle(),
      icon: '🌉'
    });
  },

  // Success states
  swapSuccess: (swapDetails?: { inputAmount: string; inputToken: string; outputToken: string }) => {
    const message = swapDetails 
      ? `Swap completed! ${swapDetails.inputAmount} ${swapDetails.inputToken} → ${swapDetails.outputToken}`
      : 'Swap completed successfully!';
    
    return toast.success(message, {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 7500,
      icon: '🎉',
      style: getSuccessToastStyle()
    });
  },

  xcmSuccess: (swapDetails?: { inputAmount: string; inputToken: string; outputToken: string }) => {
    const message = swapDetails 
      ? `Swap completed! ${swapDetails.inputAmount} ${swapDetails.inputToken} → ${swapDetails.outputToken}`
      : 'Cross-chain swap completed successfully!';
    
    return toast.success(message, {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 6000,
      icon: '🎉',
      style: getSuccessToastStyle()
    });
  },

  // Error states
  transactionFailed: () => {
    return toast.error('Transaction failed. Please try again.', {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 5000,
      icon: '⚠️',
      style: getErrorToastStyle()
    });
  },

  xcmFailed: () => {
    return toast.error('Cross-chain transfer failed. Please try again.', {
      id: TOAST_IDS.SWAP_STATUS,
      duration: 5000,
      icon: '⚠️',
      style: getErrorToastStyle()
    });
  },

  // Generic error toast
  error: (message: string, toastId: string = TOAST_IDS.SWAP_ERROR, duration: number = 5000) => {
    return toast.error(message, {
      id: toastId,
      duration,
      icon: '⚠️',
      style: getErrorToastStyle()
    });
  },

  // Chopsticks-specific toasts - simplified to just 2 states
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
