import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface UseWalletConnectionProps {
  resetBalances: () => void;
  onDisconnect?: () => void;
}

export function useWalletConnection({ resetBalances, onDisconnect }: UseWalletConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress('');
    resetBalances();
    
    // Call optional callback if provided
    if (onDisconnect) {
      onDisconnect();
    }
    
    toast.success('Wallet disconnected', {
      icon: '👋',
      style: {
        borderLeft: '4px solid #64748b',
      },
    });
  }, [resetBalances, onDisconnect]);

  return {
    isConnected,
    setIsConnected,
    walletAddress,
    setWalletAddress,
    handleDisconnect
  };
} 