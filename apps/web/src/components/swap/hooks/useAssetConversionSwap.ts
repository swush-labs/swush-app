import { useState, useCallback } from 'react';
import { FrontendTransactionService } from '@/services/FrontendTransactionService';
import { getPolkadotSignerFromPjs, SignPayload, SignRaw } from 'polkadot-api/pjs-signer';
import { getWalletBySource } from '@talismn/connect-wallets';
import type { Signer } from '@polkadot/api/types';
import ChopsticksService from '@/services/ChopsticksService';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import { TransactionErrorService } from '@/services/TransactionErrorService';
import {
  polkadot_asset_hub,
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
  buildEnhancedTransaction,
  createSimulationSummary,
  TransactionBuildOptions
} from './builders/enhancedTransactionBuilders';
import {
  createTransactionCallbacks,
  handleXcmMonitoring
} from './monitoring/transactionMonitoring';
import { TypedApi } from 'polkadot-api';
import { formatAmount } from '@/services/balances/utils';
import { NETWORKS_SUPPORTED, NUMBER_FORMAT_OPTIONS } from '@/services/constants';
import { SwapToasts, TOAST_IDS } from '../utils/toastUtils';

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
    
    // Dismiss any active toasts and show error
    SwapToasts.dismiss(TOAST_IDS.SWAP_STATUS);
    SwapToasts.error(`Swap failed: ${swushError.message}`);
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
      updateSwapState({ isSwapping: true, swapStatus: 'Please confirm and sign the transaction', swapError: null, isFinalized: false });
      
      // Show user-friendly toast for the entire preparation phase
      SwapToasts.confirmAndSign();

      // Get wallet source and prepare signer
      const walletSource = localStorage.getItem('walletSource');
      if (!walletSource) {
        throw new Error('Wallet not connected');
      }

      // Handle chopsticks vs regular wallet
      const chopsticksService = ChopsticksService.getInstance();
      let polkadotSigner: any;
      
      if (walletSource === 'chopsticks' && chopsticksService.isChopsticksMode()) {
        // For chopsticks, use real Alice signer with seed phrase
        // Silent background processing - no status updates
        
        try {
          polkadotSigner = chopsticksService.createAliceSigner();
        } catch (error) {
          throw new Error(`Failed to create chopsticks signer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Regular wallet flow
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
        polkadotSigner = getPolkadotSignerFromPjs(walletAddress, signPayload, signRaw);

        if (!polkadotSigner) {
          throw new Error('Signer not available');
        }
      }

      // Get Asset Hub connection - silent background processing
      const connectionManager = FrontendConnectionManager.getInstance();
      const assetHubConnection = await connectionManager.getConnection(NETWORKS_SUPPORTED.ASSET_HUB);

      if (!assetHubConnection || !assetHubConnection.api) {
        throw new Error('Asset Hub RPC connection is not active. Please reconnect your wallet.');
      }

      const assetHubApi = assetHubConnection.api as TypedApi<typeof polkadot_asset_hub>;

      // Fetch assets with XCM locations - silent background processing
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

      const isHydraDx = routeState.data?.dex === NETWORKS_SUPPORTED.HYDRA_DX;
      
      // Configure enhanced transaction build options
      const buildOptions: TransactionBuildOptions = {
        performDryRun: true,
        fallbackOnDryRunFailure: true,
        dryRunOptions: {
          verbose: true,
          includeHydraDx: isHydraDx,
          includeReturnPath: isHydraDx,
          timeoutMs: isHydraDx ? 60000 : 30000,
          xcmVersion: 4 // Use XCM version 4
        }
      };

      // Build enhanced transaction with comprehensive dry run - silent background processing
      const enhancedResult = await buildEnhancedTransaction(
        assetHubApi,
        assetsMap,
        inputToken.id,
        outputToken.id,
        inputAmountPlanck,
        minOutputAmountPlanck,
        walletAddress,
        isHydraDx ? NETWORKS_SUPPORTED.HYDRA_DX : NETWORKS_SUPPORTED.ASSET_HUB,
        routeState.data?.path,
        isHydraDx ? polkadotSigner.publicKey : undefined,
        buildOptions
      );

      const transaction = enhancedResult.transaction;

      // Enhanced simulation with comprehensive results - silent background processing
      const simulationSummary = createSimulationSummary(enhancedResult, inputToken.decimals);
      const formattedEstimatedFee = formatAmount(
        enhancedResult.totalEstimatedFees, 
        inputToken.decimals, 
        NUMBER_FORMAT_OPTIONS
      ).decimal;

      const simulationResult = {
        success: enhancedResult.estimatedSuccess,
        estimatedFee: formattedEstimatedFee,
        feeBreakdown: {
          total: formattedEstimatedFee,
          breakdown: simulationSummary.breakdown
        },
        willSucceed: enhancedResult.estimatedSuccess,
        enhancedData: {
          summary: simulationSummary,
          dexType: enhancedResult.dexType,
          simulationDuration: enhancedResult.simulationDuration
        }
      };

      if (onSimulationComplete) {
        const shouldProceed = await onSimulationComplete(simulationResult);
        if (!shouldProceed) {
          return;
        }
        updateSwapState({ isSwapping: true });
      }

      // Update status to show we're waiting for user signature
      updateSwapState({ swapStatus: 'Waiting for signature...' });

      // Get or create user - silent background processing
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
        routeState.data?.dex || '',
        'success'
      );

      // Create transaction callbacks with swap details for success message
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
        assetHubApi,
        {
          inputAmount,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol
        }
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
          },
          {
            inputAmount,
            inputToken: inputToken.symbol,
            outputToken: outputToken.symbol
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
