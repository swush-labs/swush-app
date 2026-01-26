import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import type { SwapHistory } from '@/types/swapHistory';

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
        const response = await fetch(`/api/swap-history?walletAddress=${encodeURIComponent(walletAddress)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch swap history');
        }
        
        const history = await response.json();
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

  // Calculate total points from successful swaps
  const totalPoints = swapHistory
    .filter(swap => swap.status === 'success')
    .reduce((sum, swap) => sum + swap.pointsEarned, 0);

  return {
    swapHistory,
    isLoadingHistory,
    totalPoints
  };
} 