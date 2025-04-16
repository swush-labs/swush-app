import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId, RouteQuote } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { FrontendTransactionService } from '@/services/FrontendTransactionService';
import { toast } from 'react-hot-toast';
import { getPolkadotSignerFromPjs, SignPayload, SignRaw } from 'polkadot-api/pjs-signer';
import { getWalletBySource } from '@talismn/connect-wallets';
import type { Signer } from '@polkadot/api/types';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import type { TransactionCallbacks, TransactionStatus } from '@/services/types';
import { safeParse } from '@/components/swap/utils';
import { type XcmV4Location } from '@swush/api';
import { TransactionErrorService, SwushError } from '@/services/TransactionErrorService';
import { TypedApi } from 'polkadot-api';
import {
  polkadot_asset_hub,
  hydration,
} from '@polkadot-api/descriptors';
import {
  ss58Encode
} from "@polkadot-labs/hdkd-helpers"
import { constructHydraDxXcmMessage, fetchHydraXCMLocation } from './utils/xcmUtils';
interface UseAssetConversionSwapProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress: string;
  slippageTolerance: number;
  inputAmount: string;
  outputAmount: string;
  routeState: {
    isLoading: boolean;
    error: string | null;
    data: RouteQuote | null;
  };
  onSuccess?: () => void;
  onError?: (error: SwushError) => void;
}

export function useAssetConversionSwap({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance,
  inputAmount,
  outputAmount,
  routeState,
  onSuccess,
  onError
}: UseAssetConversionSwapProps) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapHash, setSwapHash] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<SwushError | null>(null);

  // Get assets with XCM location information
  const getAssetsWithXcmLocations = useCallback(async (): Promise<Map<string, AssetWithId>> => {
    try {
      const assets = await api.assets.getAll();
      // Create a map of id -> asset for quick lookup
      return new Map(
        assets.map(asset => [asset.id, asset])
      );
    } catch (error) {
      console.error('Failed to fetch assets with XCM locations:', error);
      throw new Error('Failed to prepare swap path. Please try again.');
    }
  }, []);

  // Calculate minimum output amount based on slippage tolerance
  const calculateMinimumOutput = useCallback((amount: string, slippagePercent: number, decimals: number): bigint => {
    if (!amount || parseFloat(amount) <= 0) return BigInt(0);

    // Convert to a number, apply slippage, then convert back to string
    const amountFloat = parseFloat(amount);
    const slippageFactor = 1 - (slippagePercent / 100);
    const minimumAmount = amountFloat * slippageFactor;

    // Convert to bigint with appropriate precision
    // We multiply by 10^decimals to get the planck format
    return BigInt(Math.floor(minimumAmount * 10 ** decimals));
  }, []);

  // Convert decimal amount to planck format
  const toAssetPlanckFormat = useCallback((amount: string, decimals: number): bigint => {
    if (!amount || parseFloat(amount) <= 0) return BigInt(0);

    const amountFloat = parseFloat(amount);
    const amountPlanck = amountFloat * 10 ** decimals;
    return BigInt(Math.floor(amountPlanck));
  }, []);

  // Parse XCM location safely
  const parseXcmLocation = useCallback((rawLocation: any): any => {
    try {
      // If it's already an object, parse its stringified form
      const locationStr = typeof rawLocation === 'string'
        ? rawLocation
        : JSON.stringify(rawLocation);

      // Parse the location while preserving the exact structure
      const parsed = safeParse<XcmV4Location>(locationStr);

      // Return the raw parsed structure without modification
      // This preserves the exact format expected by the pallet
      return parsed;
    } catch (error) {
      console.error('Failed to parse XCM location:', error);
      throw new Error('Invalid XCM location format');
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    const swushError = TransactionErrorService.handleTransactionError(error);
    setSwapError(swushError);
    setSwapStatus(`Failed: ${swushError.message}`);
    toast.dismiss('swap-status');
    toast.error(`Swap failed: ${swushError.message}`, {
      id: 'swap-error',
      duration: 5000
    });
    setIsSwapping(false);
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
      setIsSwapping(true);
      setSwapStatus('Preparing swap...');
      setSwapError(null);

      // Get wallet source from localStorage
      const walletSource = localStorage.getItem('walletSource');
      if (!walletSource) {
        throw new Error('Wallet not connected');
      }

      // Get wallet and prepare signer
      const wallet = getWalletBySource(walletSource);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Enable wallet if not already enabled
      if (!wallet.extension) {
        await wallet.enable('Swush');
      }

      // Get signer
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
      setSwapStatus('Fetching asset information...');
      const assetsMap = await getAssetsWithXcmLocations();

      // Get input and output asset details
      const inputAsset = assetsMap.get(inputToken.id);
      const outputAsset = assetsMap.get(outputToken.id);

      if (!inputAsset?.rawXcmLocation || !outputAsset?.rawXcmLocation) {
        throw new Error('Missing XCM location information for assets');
      }

      try {
        console.log('Input XCM Location:', inputAsset.rawXcmLocation);
        console.log('Output XCM Location:', outputAsset.rawXcmLocation);
      } catch (e: unknown) {
        console.error('Error logging XCM locations:', e);
      }

      // Calculate input amount in planck format
      const inputAmountPlanck = toAssetPlanckFormat(inputAmount, inputAsset.metadata.decimals);

      // Calculate minimum output amount with slippage
      const minOutputAmountPlanck = calculateMinimumOutput(
        outputAmount,
        slippageTolerance,
        outputAsset.metadata.decimals
      );

      let transaction;

      // Check if we're using Asset Hub or HydraDX
      if (!routeState.data || routeState.data.dex === 'asset_hub') {
        // Asset Hub swap logic
        setSwapStatus('Preparing Asset Hub swap...');

        let path: any[] = [];
        try {
          if (routeState.data && routeState.data.path.length > 0) {
            // Using the route from routeState
            setSwapStatus('Preparing optimal swap path...');

            // Map each asset ID in the path to its XCM location
            for (const assetId of routeState.data.path) {
              const asset = assetsMap.get(assetId);
              if (!asset?.rawXcmLocation) {
                throw new Error(`Missing XCM location for asset in path: ${assetId}`);
              }
              const parsedLocation = parseXcmLocation(asset.rawXcmLocation);
              console.log(`Parsed XCM location for ${assetId}:`, parsedLocation);
              path.push(parsedLocation);
            }
          } else {
            // Fallback to direct path
            path = [
              parseXcmLocation(inputAsset.rawXcmLocation),
              parseXcmLocation(outputAsset.rawXcmLocation)
            ];
          }
        } catch (e: unknown) {
          console.error('Error constructing swap path:', e);
          throw new Error(`Failed to construct swap path: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }

        try {
          // Build the Asset Hub swap transaction
          transaction = await assetHubApi.tx.AssetConversion.swap_exact_tokens_for_tokens({
            amount_in: inputAmountPlanck,
            amount_out_min: minOutputAmountPlanck,
            path: path,
            keep_alive: true,
            send_to: walletAddress
          });
        } catch (e: unknown) {
          console.error('Error constructing Asset Hub transaction:', e);
          throw new Error(`Failed to construct Asset Hub transaction: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      } else {
        // HydraDX swap logic
        setSwapStatus('Preparing HydraDX XCM swap...');
        try {
          // Get HydraDX connection
          const hydraDxConnection = await connectionManager.getConnection('hydra_dx');
          if (!hydraDxConnection || !hydraDxConnection.api) {
            throw new Error('HydraDX RPC connection is not active.');
          }
          const hydraDxApi = hydraDxConnection.api as TypedApi<typeof hydration>;

          // Get the public key as Binary
          const alicePublicKey = polkadotSigner.publicKey;
          const address = ss58Encode(alicePublicKey);
          // Calculate all fees
          setSwapStatus('Calculating XCM fees...');
          const inputAssetLocation =  parseXcmLocation(inputAsset.rawXcmLocation);
          const outputAssetLocation = fetchHydraXCMLocation(outputAsset);

          if (!inputAssetLocation || !outputAssetLocation) {
            throw new Error('Missing XCM location information for assets');
          } 
          
          // const fees = await calculateHydraDxXcmFees(
          //   assetHubApi,
          //   hydraDxApi,
          //   inputAssetLocation,
          //   outputAssetLocation,
          //   inputAmountPlanck,
          //   minOutputAmountPlanck,
          //   alicePublicKey,
          //   address
          // );

          //hardcode the fees initialExecution: 48945000n, initialDelivery: 307250000n, hydradxExecution: 266095510n, returnDelivery: 0n, finalExecution: 3098000000n
          const fees = {
            initialExecution: BigInt(48945000),
            initialDelivery: BigInt(307250000),
            hydradxExecution: BigInt(266095510),
            returnDelivery: BigInt(0),
            finalExecution: BigInt(3098000000)
          };
          // Construct XCM message
          setSwapStatus('Constructing XCM message...');
          const xcmMessage = await constructHydraDxXcmMessage(
            fees,
            inputAssetLocation,
            outputAssetLocation,
            inputAmountPlanck,
            minOutputAmountPlanck,
            alicePublicKey
          );

          // Calculate final weight for the complete message
          const xcmWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(xcmMessage);
          if (!xcmWeight.success) {
            throw new Error("Failed to calculate total XCM weight");
          }

          // Build the HydraDX XCM transaction
          transaction = assetHubApi.tx.PolkadotXcm.execute({
            message: xcmMessage,
            max_weight: {
              ref_time: xcmWeight.value.ref_time,
              proof_size: xcmWeight.value.proof_size
            }
          });
        } catch (e: unknown) {
          console.error('Error in HydraDX swap preparation:', e);
          throw new Error(`Failed to prepare HydraDX swap: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }

      setSwapStatus('Signing transaction...');

      // Define transaction callbacks
      const callbacks: TransactionCallbacks = {
        onStatusChange: (status: TransactionStatus) => {
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
              toast.dismiss('swap-status');
              console.log('Swap transaction status:', status);

              if (status.success) {
                const blockNum = status.blockNumber ? ` in block ${status.blockNumber}` : '';
                setSwapStatus(`Swap complete${blockNum}!`);
                toast.success('Swap completed successfully! 🎉', {
                  id: 'swap-status',
                  duration: 5000,
                  icon: '✅'
                });
              }
              break;
          }
        },
        onSuccess: (status: TransactionStatus) => {
          setIsSwapping(false);
          if (onSuccess) onSuccess();
        },
        onError: handleError
      };

      // Execute the transaction
      await FrontendTransactionService.signSubmitAndWatch(
        transaction,
        polkadotSigner,
        callbacks
      );

    } catch (error) {
      console.error('Error:', error);
      handleError(error as Error);
    }
  }, [
    inputToken, outputToken, walletAddress, inputAmount, outputAmount,
    slippageTolerance, routeState, getAssetsWithXcmLocations,
    calculateMinimumOutput, toAssetPlanckFormat, parseXcmLocation,
    onSuccess, handleError
  ]);

  return {
    isSwapping,
    swapHash,
    swapStatus,
    swapError,
    executeSwap
  };
}
