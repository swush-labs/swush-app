import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { SwapHistory, SwapHistoryService } from '@/services/swapHistoryService';

interface UseSwapHistoryProps {
  walletAddress: string;
  showHistory: boolean;
}

export function useSwapHistory({ walletAddress, showHistory }: UseSwapHistoryProps) {
  const [swapHistory, setSwapHistory] = useState<SwapHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchSwapHistory = async () => {
      if (!walletAddress) return;
      
      setIsLoadingHistory(true);
      try {
        const history = await SwapHistoryService.getSwapHistoryByWalletAddress(walletAddress);
        setSwapHistory(history);
      } catch (error) {
        console.error('Failed to fetch swap history:', error);
        toast.error('Failed to load swap history');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    if (showHistory && walletAddress) {
      fetchSwapHistory();
    }
  }, [showHistory, walletAddress]);

  return {
    swapHistory,
    isLoadingHistory
  };
} 