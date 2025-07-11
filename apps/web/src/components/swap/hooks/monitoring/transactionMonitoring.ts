import { TransactionStatus, TransactionCallbacks } from '@/services/types';
import { UserService } from '@/services/userService';
import { SwapHistoryService } from '@/services/swapHistoryService';
import { monitorXcmFlow } from '@/services/xcm/xcmMonitor';
import { AssetHubApi } from '../types';
import { SwapToasts, TOAST_IDS } from '../../utils/toastUtils';

interface MonitoringCallbacksConfig {
  setSwapHash: (hash: string | null) => void;
  setSwapStatus: (status: string | null) => void;
  setIsFinalized: (isFinalized: boolean) => void;
  setIsSwapping: (isSwapping: boolean) => void;
  onSuccess?: () => void;
  onBalanceUpdateNeeded?: (txHash?: string) => void;
}

interface SwapDetails {
  inputAmount: string;
  inputToken: string;
  outputToken: string;
}

export const createTransactionCallbacks = (
  walletAddress: string,
  swapRecord: { id: string },
  config: MonitoringCallbacksConfig,
  isHydraDx: boolean,
  assetHubApi?: AssetHubApi,
  swapDetails?: SwapDetails
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
            setSwapStatus('Processing your swap...');
            
            // Replace preparation toast with a single processing toast that persists
            SwapToasts.processing();
          }
          break;

        case 'broadcasted':
          // Update status silently without new toast
          setSwapStatus('Processing your swap...');
          break;

        case 'txBestBlocksState':
          // Update status silently without new toast
          setSwapStatus('Processing your swap...');
          break;

        case 'finalized':
          setIsFinalized(true);

          if (status.success) {
            // Update swap history status
            await SwapHistoryService.updateSwapStatus(swapRecord.id, 'success');

            // Award XP for successful swap
            await UserService.updateUserXP(walletAddress, 10);

            if (!isHydraDx) {
              setSwapStatus('Swap completed!');
              SwapToasts.swapSuccess(swapDetails);
            } else {
              // For HydraDX, maintain loading state for XCM monitoring
              setSwapStatus('Processing your swap...');
            }
          } else {
            await SwapHistoryService.updateSwapStatus(swapRecord.id, 'failed');
            SwapToasts.transactionFailed();
          }
          break;
      }
    },
    onSuccess: async () => {
      if (!isHydraDx) {
        setIsSwapping(false);
        if (onSuccess) onSuccess();
      }
      // For HydraDX, do absolutely nothing here to avoid interfering with XCM monitoring
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
  config: MonitoringCallbacksConfig,
  swapDetails?: SwapDetails
) => {
  const {
    setSwapStatus,
    setIsSwapping,
    onSuccess,
    setSwapHash
  } = config;

  try {
    // Update to more specific XCM messaging with enhanced styling
    setSwapStatus('Completing cross-chain transfer...');
    SwapToasts.xcmTransfer();
    
    const xcmSuccess = await monitorXcmFlow(
      assetHubApi,
      walletAddress
    );

    if (!xcmSuccess) {
      throw new Error('XCM transaction monitoring failed or timed out');
    }

    // Only dismiss and show success after XCM flow completes successfully
    setSwapStatus('Swap completed!');
    SwapToasts.xcmSuccess(swapDetails);

    setIsSwapping(false);
    if (onSuccess) onSuccess();

  } catch (error) {
    console.error('XCM monitoring error:', error);
    
    // Enhanced error handling with styled toast
    SwapToasts.xcmFailed();
    
    throw new Error(`XCM monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 