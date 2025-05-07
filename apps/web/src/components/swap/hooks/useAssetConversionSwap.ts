import { useState, useCallback } from 'react';
import { FrontendTransactionService } from '@/services/FrontendTransactionService';
import { toast } from 'react-hot-toast';
import { getPolkadotSignerFromPjs, SignPayload, SignRaw } from 'polkadot-api/pjs-signer';
import { getWalletBySource } from '@talismn/connect-wallets';
import type { Signer } from '@polkadot/api/types';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import { TransactionErrorService } from '@/services/TransactionErrorService';
import {
  polkadot_asset_hub,
  PolkadotRuntimeOriginCaller
} from '@polkadot-api/descriptors';
import { UserService } from '@/services/userService';
import { SwapHistoryService } from '@/services/swapHistoryService';

// Import our modular components
import {
  UseAssetConversionSwapProps,
  SwapState,
  FeeBreakdown
} from './types';
import {
  getAssetsWithXcmLocations,
  toAssetPlanckFormat,
  calculateMinimumOutput
} from './utils/assetUtils';
import {
  buildAssetHubTransaction,
  buildHydraDxTransaction
} from './builders/transactionBuilders';
import {
  createTransactionCallbacks,
  handleXcmMonitoring
} from './monitoring/transactionMonitoring';
import { TypedApi } from 'polkadot-api';
import { calculateEstimatedFees } from './utils/feeUtils';
import { formatAmount } from '@/services/balances/utils';

export function useAssetConversionSwap({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance,
  inputAmount,
  outputAmount,
  routeState,
  onSuccess,
  onError,
  onSimulationComplete,
  onBalanceUpdateNeeded
}: UseAssetConversionSwapProps) {
  // State management
  const [swapState, setSwapState] = useState<SwapState>({
    isSwapping: false,
    swapHash: null,
    swapStatus: null,
    swapError: null,
    isFinalized: false
  });

  // Helper function to update swap state
  const updateSwapState = (updates: Partial<SwapState>) => {
    setSwapState(prev => ({ ...prev, ...updates }));
  };

  // Error handler
  const handleError = useCallback((error: Error) => {
    const swushError = TransactionErrorService.handleTransactionError(error);
    updateSwapState({
      swapError: swushError,
      swapStatus: `Failed: ${swushError.message}`,
      isSwapping: false
    });
    toast.dismiss('swap-status');
    toast.error(`Swap failed: ${swushError.message}`, {
      id: 'swap-error',
      duration: 5000
    });
    if (onError) onError(swushError);
  }, [onError]);

  // Execute the swap
  const executeSwap = useCallback(async () => {
    if (!inputToken || !outputToken || !walletAddress || !inputAmount || parseFloat(inputAmount) <= 0) {
      const error = TransactionErrorService.parseDispatchError({
        type: 'ValidationError',
        message: 'Invalid swap parameters'
      });
      handleError(error);
      return;
    }

    try {
      updateSwapState({ isSwapping: true, swapStatus: 'Preparing swap...', swapError: null, isFinalized: false });

      // Get wallet source and prepare signer
      const walletSource = localStorage.getItem('walletSource');
      if (!walletSource) {
        throw new Error('Wallet not connected');
      }

      const wallet = getWalletBySource(walletSource);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.extension) {
        await wallet.enable('Swush');
      }

      const signer = wallet.signer as Signer;
      const signPayload = signer.signPayload as SignPayload;
      const signRaw = signer.signRaw as SignRaw;
      const polkadotSigner = getPolkadotSignerFromPjs(walletAddress, signPayload, signRaw);

      if (!polkadotSigner) {
        throw new Error('Signer not available');
      }

      // Get Asset Hub connection
      const connectionManager = FrontendConnectionManager.getInstance();
      const assetHubConnection = await connectionManager.getConnection('asset_hub');

      if (!assetHubConnection || !assetHubConnection.api) {
        throw new Error('Asset Hub RPC connection is not active. Please reconnect your wallet.');
      }

      const assetHubApi = assetHubConnection.api as TypedApi<typeof polkadot_asset_hub>;

      // Fetch assets with XCM locations
      updateSwapState({ swapStatus: 'Fetching asset information...' });
      const assetsMap = await getAssetsWithXcmLocations();

      // Get input and output assets
      const inputAsset = assetsMap.get(inputToken.id);
      const outputAsset = assetsMap.get(outputToken.id);

      if (!inputAsset || !outputAsset) {
        throw new Error('Failed to fetch asset information');
      }

      // Calculate amounts in planck format
      const inputAmountPlanck = toAssetPlanckFormat(inputAmount, inputAsset.metadata.decimals);
      const minOutputAmountPlanck = calculateMinimumOutput(
        outputAmount,
        slippageTolerance,
        outputAsset.metadata.decimals
      );

      let transaction;
      const isHydraDx = routeState.data?.dex === 'hydra_dx';

      // Build transaction based on DEX
      if (!isHydraDx) {
        updateSwapState({ swapStatus: 'Preparing Asset Hub swap...' });
        transaction = await buildAssetHubTransaction(
          assetHubApi,
          assetsMap,
          inputToken.id,
          outputToken.id,
          inputAmountPlanck,
          minOutputAmountPlanck,
          walletAddress,
          routeState.data?.path
        );
      } else {
        updateSwapState({ swapStatus: 'Preparing HydraDX XCM swap...' });
        transaction = await buildHydraDxTransaction(
          assetHubApi,
          assetsMap,
          inputToken.id,
          outputToken.id,
          inputAmountPlanck,
          minOutputAmountPlanck,
          polkadotSigner.publicKey,
          walletAddress
        );
      }

      // Perform dry run
      updateSwapState({ swapStatus: 'Simulating transaction...' });
      try {
        const dryRun = await assetHubApi.apis.DryRunApi.dry_run_call(
          PolkadotRuntimeOriginCaller.system({
            type: "Signed",
            value: walletAddress
          }),
          transaction.decodedCall,
          {}
        );

        // Use our fee utility instead of calculating here
        const { estimatedFee, feeBreakdown } = calculateEstimatedFees(
          routeState.data?.dex || 'asset_hub'
        );

        //format the estimated fee
        const formattedEstimatedFee = formatAmount(estimatedFee, inputToken.decimals, { trim: true, round: 6 }).decimal;

        const simulationResult = {
          success: dryRun.success && dryRun.value.execution_result.success,
          estimatedFee: formattedEstimatedFee,
          feeBreakdown,
          willSucceed: dryRun.success && dryRun.value.execution_result.success
        };

        if (onSimulationComplete) {
          const shouldProceed = await onSimulationComplete(simulationResult);
          if (!shouldProceed) {
            updateSwapState({ isSwapping: false, swapStatus: null });
            return;
          }
          updateSwapState({ isSwapping: true });
        }
      } catch (e) {
        console.error('Dry run failed:', e);
        
        // Use our fee utility for failed simulations too
        const { estimatedFee, feeBreakdown } = calculateEstimatedFees(
          routeState.data?.dex || 'asset_hub'
        );
        
        if (onSimulationComplete) {
          const shouldProceed = await onSimulationComplete({
            success: false,
            estimatedFee,
            feeBreakdown,
            willSucceed: false,
            error: e instanceof Error ? e.message : 'Unknown error during simulation'
          });
          if (!shouldProceed) {
            updateSwapState({ isSwapping: false, swapStatus: null });
            return;
          }
          updateSwapState({ isSwapping: true });
        }
        toast.error('Transaction simulation failed. Proceed with caution.', {
          id: 'swap-simulation-warning',
          duration: 5000
        });
      }

      updateSwapState({ swapStatus: 'Signing transaction...' });

      // Get or create user
      const userExists = await UserService.getUserByWalletAddress(walletAddress);
      if (!userExists) {
        await UserService.createOrUpdateUser(walletAddress);
      }

      // Record swap attempt
      const swapRecord = await SwapHistoryService.recordSwap(
        walletAddress,
        inputToken.symbol,
        outputToken.symbol,
        parseFloat(inputAmount),
        routeState.data?.dex || 'asset_hub',
        'success'
      );

      // Create transaction callbacks
      const callbacks = createTransactionCallbacks(
        walletAddress,
        swapRecord,
        {
          setSwapHash: (hash) => updateSwapState({ swapHash: hash }),
          setSwapStatus: (status) => updateSwapState({ swapStatus: status }),
          setIsFinalized: (isFinalized) => updateSwapState({ isFinalized }),
          setIsSwapping: (isSwapping) => updateSwapState({ isSwapping }),
          onSuccess,
          onBalanceUpdateNeeded
        },
        isHydraDx,
        assetHubApi
      );

      // Execute transaction
      await FrontendTransactionService.signSubmitAndWatch(
        transaction,
        polkadotSigner,
        callbacks
      );

      // Handle XCM monitoring for HydraDX swaps
      if (isHydraDx) {
        await handleXcmMonitoring(
          assetHubApi,
          walletAddress,
          {
            setSwapHash: (hash) => updateSwapState({ swapHash: hash }),
            setSwapStatus: (status) => updateSwapState({ swapStatus: status }),
            setIsFinalized: (isFinalized) => updateSwapState({ isFinalized }),
            setIsSwapping: (isSwapping) => updateSwapState({ isSwapping }),
            onSuccess,
            onBalanceUpdateNeeded
          }
        );
      }

    } catch (error) {
      console.error('Error:', error);
      handleError(error as Error);
    }
  }, [
    inputToken,
    outputToken,
    walletAddress,
    inputAmount,
    outputAmount,
    slippageTolerance,
    routeState,
    onSuccess,
    onSimulationComplete,
    onBalanceUpdateNeeded,
    handleError
  ]);

  return {
    isSwapping: swapState.isSwapping,
    swapHash: swapState.swapHash,
    swapStatus: swapState.swapStatus,
    swapError: swapState.swapError,
    isFinalized: swapState.isFinalized,
    executeSwap
  };
}
