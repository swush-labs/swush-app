import { toast } from 'react-hot-toast';
import { TransactionStatus, TransactionCallbacks } from '@/services/types';
import { UserService } from '@/services/userService';
import { SwapHistoryService } from '@/services/swapHistoryService';
import { monitorXcmFlow } from '@/services/xcm/xcmMonitor';
import { AssetHubApi } from '../types';

interface MonitoringCallbacksConfig {
  setSwapHash: (hash: string | null) => void;
  setSwapStatus: (status: string | null) => void;
  setIsFinalized: (isFinalized: boolean) => void;
  setIsSwapping: (isSwapping: boolean) => void;
  onSuccess?: () => void;
  onBalanceUpdateNeeded?: (txHash?: string) => void;
}

export const createTransactionCallbacks = (
  walletAddress: string,
  swapRecord: { id: string },
  config: MonitoringCallbacksConfig,
  isHydraDx: boolean,
  assetHubApi?: AssetHubApi
): TransactionCallbacks => {
  const {
    setSwapHash,
    setSwapStatus,
    setIsFinalized,
    setIsSwapping,
    onSuccess
 } = config;

  return {
    onStatusChange: async (status: TransactionStatus) => {
      switch (status.type) {
        case 'signed':
          if (status.txHash) {
            setSwapHash(status.txHash);
            setSwapStatus('Transaction signed, waiting for broadcast...');
            toast.loading('Transaction signed, waiting for broadcast...', { id: 'swap-status' });
          }
          break;

        case 'broadcasted':
          setSwapStatus('Transaction broadcasted! Waiting for confirmation...');
          toast.loading('Transaction broadcasted, waiting for confirmation...', { id: 'swap-status' });
          break;

        case 'txBestBlocksState':
          if (status.blockNumber) {
            setSwapStatus(`Transaction included in block ${status.blockNumber}`);
            toast.loading(`Transaction included in block ${status.blockNumber}, waiting for finalization...`, { id: 'swap-status' });
          }
          break;

        case 'finalized':
          setIsFinalized(true);

          if (status.success) {
            const blockNum = status.blockNumber ? ` in block ${status.blockNumber}` : '';

            // Update swap history status
            await SwapHistoryService.updateSwapStatus(swapRecord.id, 'success');

            // Award XP for successful swap
            await UserService.updateUserXP(walletAddress, 10);

            if (!isHydraDx) {
              toast.dismiss('swap-status');
              setSwapStatus(`Swap complete${blockNum}!`);
              toast.success('Swap completed successfully! 🎉', {
                id: 'swap-success',
                duration: 5000,
                icon: '✅'
              });
            } else {
              setSwapStatus('Transaction initialized, monitoring XCM transfer...');
              toast.loading('Transaction initialized, monitoring XCM transfer...', { id: 'swap-status' });
            }
          } else {
            await SwapHistoryService.updateSwapStatus(swapRecord.id, 'failed');
          }
          break;
      }
    },
    onSuccess: async () => {
      if (!isHydraDx) {
        setIsSwapping(false);
        if (onSuccess) onSuccess();
      }
    },
    onError: async (error: Error) => {
      await SwapHistoryService.updateSwapStatus(swapRecord.id, 'failed');
      throw error; // Let the main hook handle the error
    }
  };
};

export const handleXcmMonitoring = async (
  assetHubApi: AssetHubApi,
  walletAddress: string,
  config: MonitoringCallbacksConfig
) => {
  const {
    setSwapStatus,
    setIsSwapping,
    onSuccess,
    setSwapHash
  } = config;

  try {
    setSwapStatus('Monitoring XCM transaction...');
    const xcmSuccess = await monitorXcmFlow(
      assetHubApi,
      walletAddress
    );

    if (!xcmSuccess) {
      throw new Error('XCM transaction monitoring failed or timed out');
    }

    toast.dismiss('swap-status');
    setSwapStatus('XCM transfer complete!');
    toast.success('Swap and XCM transfer completed successfully! 🎉', {
      id: 'swap-success',
      duration: 5000,
      icon: '✅'
    });

    setIsSwapping(false);
    if (onSuccess) onSuccess();

  } catch (error) {
    console.error('XCM monitoring error:', error);
    throw new Error(`XCM monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 