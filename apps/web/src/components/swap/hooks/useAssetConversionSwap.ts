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
import { safeParse, safeStringify, serializeKey } from '@/components/swap/utils';
import { type XcmV4Location } from '@swush/api';
import { TransactionErrorService, SwushError } from '@/services/TransactionErrorService';
import { Binary, TypedApi, FixedSizeBinary } from 'polkadot-api';
import {
  XcmVersionedLocation,
  XcmVersionedAssets,
  XcmVersionedAssetId,
  XcmV3WeightLimit,
  XcmV3Junction,
  XcmV3Junctions,
  XcmV3MultiassetAssetId,
  XcmV3MultiassetFungibility,
  XcmVersionedXcm,
  XcmV4Instruction,
  XcmV4AssetAssetFilter,
  XcmV4AssetWildAsset,
  polkadot_asset_hub,
  hydration,
  PolkadotRuntimeOriginCaller
} from '@polkadot-api/descriptors';
import {
  ss58Encode
} from "@polkadot-labs/hdkd-helpers"
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

// Helper function to calculate fees for HydraDX XCM swap
async function calculateHydraDxXcmFees(
  assetHubApi: TypedApi<typeof polkadot_asset_hub>,
  hydraDxApi: TypedApi<typeof hydration>,
  inputAssetLocation: XcmV4Location,
  outputAssetLocation: XcmV4Location,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  beneficiaryAccountId: Uint8Array<ArrayBufferLike>,
  address: string
): Promise<{
  initialExecution: bigint;
  initialDelivery: bigint;
  hydradxExecution: bigint;
  returnDelivery: bigint;
  finalExecution: bigint;
  initialWeight: any;
}> {
  console.log('Debug: Input parameters:', {
    inputAmountPlanck: inputAmountPlanck.toString(),
    minOutputAmountPlanck: minOutputAmountPlanck.toString(),
  });

  // const inputAssetLocation = {
  //   parents: 1,
  //   interior: XcmV3Junctions.Here()
  // };
  // const outputAssetLocation = {
  //   parents: 1,
  //   interior: XcmV3Junctions.X3([
  //     XcmV3Junction.Parachain(1000),
  //     XcmV3Junction.PalletInstance(50),
  //     XcmV3Junction.GeneralIndex(BigInt(1984))
  //   ])
  // };

  const dotAssetId = {
    parents: 1,
    interior: XcmV3Junctions.Here()
  };

  // First create the initial message
  const message = XcmVersionedXcm.V4([
    XcmV4Instruction.WithdrawAsset([{
      id: inputAssetLocation,
      fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
    }]),
    XcmV4Instruction.DepositReserveAsset({
      assets: XcmV4AssetAssetFilter.Definite([{
        id: inputAssetLocation,
        fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
      }]),
      dest: {
        parents: 1,
        interior: XcmV3Junctions.X1(
          XcmV3Junction.Parachain(2034) // HydraDX parachain ID
        )
      },
      xcm: [
        XcmV4Instruction.BuyExecution({
          fees: {
            id: dotAssetId,
            fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
          },
          weight_limit: XcmV3WeightLimit.Unlimited()
        }),
        XcmV4Instruction.ExchangeAsset({
          give: XcmV4AssetAssetFilter.Definite([{
            id: inputAssetLocation,
            fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
          }]),
          want: [{
            id: outputAssetLocation,
            fun: XcmV3MultiassetFungibility.Fungible(minOutputAmountPlanck)
          }],
          maximal: true
        }),
        XcmV4Instruction.InitiateReserveWithdraw({
          assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
          reserve: {
            parents: 1,
            interior: XcmV3Junctions.X1(
              XcmV3Junction.Parachain(1000) // Asset Hub parachain ID
            )
          },
          xcm: [
            XcmV4Instruction.BuyExecution({
              fees: {
                id: dotAssetId,
                fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
              },
              weight_limit: XcmV3WeightLimit.Unlimited()
            }),
            XcmV4Instruction.DepositAsset({
              assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
              beneficiary: {
                parents: 0,
                interior: XcmV3Junctions.X1(
                  XcmV3Junction.AccountId32({
                    network: undefined,
                    id: Binary.fromBytes(beneficiaryAccountId)
                  })
                )
              }
            })
          ]
        })
      ]
    })
  ]);

  // Calculate initial weight for the complete message
  console.log('Debug: Calculating initial weight...');
  const xcmWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(message);
  if (!xcmWeight.success) {
    console.error('Debug: Failed to calculate XCM weight:', xcmWeight);
    throw new Error("Failed to calculate total XCM weight");
  }

  // Create the transaction for dry run
  const tx = assetHubApi.tx.PolkadotXcm.execute({
    message: message,
    max_weight: {
      ref_time: xcmWeight.value.ref_time,
      proof_size: xcmWeight.value.proof_size
    }
  });


  // Do a dry run to get the actual forwarded messages
  console.log('Debug: Performing dry run...');
  const dryRun = await assetHubApi.apis.DryRunApi.dry_run_call(
    PolkadotRuntimeOriginCaller.system({
      type: "Signed",
      value: address
    }),
    tx.decodedCall,
    {}
  );

  if (!dryRun.success) {
    throw new Error("Dry run failed");
  }

  const { forwarded_xcms } = dryRun.value;

  // Find the message targeting HydraDX
  const targetMessage = forwarded_xcms.find(([location, _]) =>
    location.type === 'V4' &&
    location.value.parents === 1 &&
    location.value.interior.type === 'X1' &&
    location.value.interior.value.type === 'Parachain' &&
    location.value.interior.value.value === 2034 // HydraDX parachain ID
  );

  if (!targetMessage) {
    throw new Error('No forwarded message found for HydraDX parachain');
  }

  // Extract the XCM message
  const [_, messages] = targetMessage;
  const xcmMessage = messages[0];

  // Calculate initial execution fee
  console.log('Debug: Calculating initial execution fee...');
  const xcmFee = await assetHubApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
    xcmWeight.value,
    XcmVersionedAssetId.V4(dotAssetId)
  );

  if (!xcmFee.success) {
    throw new Error("Failed to calculate initial execution fee");
  }
  const initialExecutionFee = extractFeeValue(xcmFee);

  // Calculate delivery fees to HydraDX using the extracted message
  console.log('Debug: Calculating delivery fees...');
  const deliveryFeesResult = await assetHubApi.apis.XcmPaymentApi.query_delivery_fees(
    XcmVersionedLocation.V4({
      parents: 1,
      interior: XcmV3Junctions.X1(
        XcmV3Junction.Parachain(2034)
      )
    }),
    xcmMessage
  );

  if (!deliveryFeesResult.success) {
    throw new Error("Failed to calculate delivery fees");
  }
  const deliveryFees = extractFeeValue(deliveryFeesResult);

  // Calculate HydraDX execution fees using the extracted message
  console.log('Debug: Calculating HydraDX execution fees...');
  const remoteXcmWeight = await hydraDxApi.apis.XcmPaymentApi.query_xcm_weight(xcmMessage);
  if (!remoteXcmWeight.success) {
    throw new Error("Failed to calculate HydraDX execution weight");
  }

  const remoteXcmFee = await hydraDxApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
    remoteXcmWeight.value,
    XcmVersionedAssetId.V4(dotAssetId)
  );
  if (!remoteXcmFee.success) {
    throw new Error("Failed to calculate HydraDX execution fee");
  }
  const hydraDxExecutionFee = extractFeeValue(remoteXcmFee);

  // Construct return message
  const returnMessage = XcmVersionedXcm.V4([
    XcmV4Instruction.InitiateReserveWithdraw({
      assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
      reserve: {
        parents: 1,
        interior: XcmV3Junctions.X1(
          XcmV3Junction.Parachain(1000)
        )
      },
      xcm: [
        XcmV4Instruction.BuyExecution({
          fees: {
            id: dotAssetId,
            fun: XcmV3MultiassetFungibility.Fungible(BigInt(10000000000))
          },
          weight_limit: XcmV3WeightLimit.Unlimited()
        }),
        XcmV4Instruction.DepositAsset({
          assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
          beneficiary: {
            parents: 0,
            interior: XcmV3Junctions.X1(
              XcmV3Junction.AccountId32({
                network: undefined,
                id: Binary.fromBytes(beneficiaryAccountId)
              })
            )
          }
        })
      ]
    })
  ]);

  // Calculate return delivery fees
  console.log('Debug: Calculating return delivery fees...');
  const returnDeliveryFeesResult = await hydraDxApi.apis.XcmPaymentApi.query_delivery_fees(
    XcmVersionedLocation.V4({
      parents: 1,
      interior: XcmV3Junctions.X1(
        XcmV3Junction.Parachain(1000)
      )
    }),
    returnMessage
  );

  let returnDeliveryFees = BigInt(0);
  if (returnDeliveryFeesResult.success) {
    const returnDeliveryFeesValue = returnDeliveryFeesResult.value.value[0];
    if (returnDeliveryFeesValue) {
      returnDeliveryFees = returnDeliveryFeesValue.fun.value as bigint;
    }
  }

  // Calculate final Asset Hub execution fees
  console.log('Debug: Calculating final Asset Hub execution fees...');
  const finalAssetHubWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(returnMessage);
  if (!finalAssetHubWeight.success) {
    throw new Error("Failed to calculate final Asset Hub execution weight");
  }

  const finalAssetHubFee = await assetHubApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
    finalAssetHubWeight.value,
    XcmVersionedAssetId.V4(dotAssetId)
  );
  const finalExecutionFee = extractFeeValue(finalAssetHubFee);

  return {
    initialExecution: initialExecutionFee,
    initialDelivery: deliveryFees,
    hydradxExecution: hydraDxExecutionFee,
    returnDelivery: returnDeliveryFees,
    finalExecution: finalExecutionFee,
    initialWeight: xcmWeight.value
  };
}

// Helper function to construct HydraDX XCM message
async function constructHydraDxXcmMessage(
  fees: {
    initialExecution: bigint;
    initialDelivery: bigint;
    hydradxExecution: bigint;
    returnDelivery: bigint;
    finalExecution: bigint;
  },
  inputAssetLocation: any,
  outputAssetLocation: any,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  beneficiaryAccountId: Uint8Array<ArrayBufferLike>
) {

  //print all the fees  
  console.log('Debug: Fees:', fees);

  const dotAssetId = {
    parents: 1,
    interior: XcmV3Junctions.Here()
  };

  // const inputAssetLocation = {
  //   parents: 1,
  //   interior: XcmV3Junctions.Here()
  // };
  // const outputAssetLocation = {
  //   parents: 1,
  //   interior: XcmV3Junctions.X3([
  //     XcmV3Junction.Parachain(1000),
  //     XcmV3Junction.PalletInstance(50),
  //     XcmV3Junction.GeneralIndex(BigInt(1984))
  //   ])
  // };

  // Calculate total fees
  const totalFees = fees.initialExecution +
    fees.initialDelivery +
    fees.hydradxExecution +
    fees.returnDelivery +
    fees.finalExecution;

  const withdrawAmount = inputAmountPlanck + totalFees;

  return XcmVersionedXcm.V4([
    // 1. Withdraw asset from Asset Hub (including all fees)
    XcmV4Instruction.WithdrawAsset([{
      id: inputAssetLocation,
      fun: XcmV3MultiassetFungibility.Fungible(withdrawAmount)
    }]),
    // 2. Send to HydraDX with instructions
    XcmV4Instruction.DepositReserveAsset({
      assets: XcmV4AssetAssetFilter.Definite([{
        id: inputAssetLocation,
        fun: XcmV3MultiassetFungibility.Fungible(withdrawAmount)
      }]),
      dest: {
        parents: 1,
        interior: XcmV3Junctions.X1(
          XcmV3Junction.Parachain(2034) // HydraDX parachain ID
        )
      },
      xcm: [
        // 2a. Pay for HydraDX execution
        XcmV4Instruction.BuyExecution({
          fees: {
            id: dotAssetId,
            fun: XcmV3MultiassetFungibility.Fungible(fees.hydradxExecution + fees.initialDelivery)
          },
          weight_limit: XcmV3WeightLimit.Unlimited()
        }),
        // 2b. Exchange asset
        XcmV4Instruction.ExchangeAsset({
          give: XcmV4AssetAssetFilter.Definite([{
            id: inputAssetLocation,
            fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
          }]),
          want: [{
            id: outputAssetLocation,
            fun: XcmV3MultiassetFungibility.Fungible(minOutputAmountPlanck)
          }],
          maximal: true
        }),
        // 2c. Send swapped assets back to Asset Hub
        XcmV4Instruction.InitiateReserveWithdraw({
          assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
          reserve: {
            parents: 1,
            interior: XcmV3Junctions.X1(
              XcmV3Junction.Parachain(1000) // Asset Hub parachain ID
            )
          },
          xcm: [
            // Pay for final Asset Hub execution
            XcmV4Instruction.BuyExecution({
              fees: {
                id: dotAssetId,
                fun: XcmV3MultiassetFungibility.Fungible(fees.finalExecution + fees.returnDelivery)
              },
              weight_limit: XcmV3WeightLimit.Unlimited()
            }),
            XcmV4Instruction.DepositAsset({
              assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
              beneficiary: {
                parents: 0,
                interior: XcmV3Junctions.X1(
                  XcmV3Junction.AccountId32({
                    network: undefined,
                    id: Binary.fromBytes(beneficiaryAccountId)
                  })
                )
              }
            })
          ]
        })
      ]
    })
  ]);
}

// Helper function to extract fee value from API response
function extractFeeValue(feeResult: any): bigint {
  if (!feeResult || !feeResult.success) {
    throw new Error(`Fee calculation was not successful: ${serializeKey(feeResult)}`);
  }

  // Handle XCM versioned assets (delivery fees)
  if (feeResult.value?.type === 'V4' && Array.isArray(feeResult.value.value)) {
    // Sum up all fee values in the array
    return feeResult.value.value.reduce((sum: bigint, item: any) => {
      if (item && item.fun?.type === 'Fungible') {
        // Convert the value to string first to handle both string and number cases
        const value = item.fun.value.toString();
        return sum + BigInt(value);
      }
      return sum;
    }, BigInt(0));
  }

  // Handle direct bigint value
  if (typeof feeResult.value === 'bigint') {
    return feeResult.value;
  }

  // Handle numeric value
  if (typeof feeResult.value === 'number') {
    return BigInt(feeResult.value);
  }

  // Handle case where value is a string
  if (typeof feeResult.value === 'string') {
    return BigInt(feeResult.value);
  }

  // Handle case where value is an object with a toString method
  if (typeof feeResult.value === 'object' && feeResult.value !== null && 'toString' in feeResult.value) {
    return BigInt(feeResult.value.toString());
  }

  console.log("Problematic fee result:", serializeKey(feeResult));
  throw new Error(`Unexpected fee result structure: ${serializeKey(feeResult)}`);
}

// Helper function to convert XCM junction
const convertJunction = (junction: any): XcmV3Junction => {
  if (!junction) {
    throw new Error(`Invalid junction: ${safeStringify(junction)}`);
  }

  // Handle both camelCase and PascalCase formats
  if (junction.parachain !== undefined) {
    return XcmV3Junction.Parachain(junction.parachain);
  }
  if (junction.palletInstance !== undefined) {
    return XcmV3Junction.PalletInstance(junction.palletInstance);
  }
  if (junction.generalIndex !== undefined) {
    return XcmV3Junction.GeneralIndex(BigInt(junction.generalIndex));
  }
  if (junction.accountId32 !== undefined) {
    return XcmV3Junction.AccountId32({
      network: junction.accountId32.network,
      id: Binary.fromBytes(junction.accountId32.id)
    });
  }

  // Handle PascalCase format as fallback
  if (junction.type) {
    switch (junction.type) {
      case 'Parachain':
        return XcmV3Junction.Parachain(junction.value);
      case 'PalletInstance':
        return XcmV3Junction.PalletInstance(junction.value);
      case 'GeneralIndex':
        return XcmV3Junction.GeneralIndex(BigInt(junction.value));
      case 'AccountId32':
        return XcmV3Junction.AccountId32({
          network: junction.value.network,
          id: Binary.fromBytes(junction.value.id)
        });
    }
  }

  throw new Error(`Unsupported junction format: ${safeStringify(junction)}`);
};

// Helper function to convert XCM junctions
const convertJunctions = (interior: any): XcmV3Junctions => {
  if (!interior) {
    throw new Error(`Invalid interior: ${safeStringify(interior)}`);
  }

  // Handle camelCase format (x1, x2, x3, x4)
  if (interior.here !== undefined) {
    return XcmV3Junctions.Here();
  }
  if (interior.x1 !== undefined) {
    return XcmV3Junctions.X1(convertJunction(interior.x1));
  }
  if (interior.x2 !== undefined) {
    return XcmV3Junctions.X2([
      convertJunction(interior.x2[0]),
      convertJunction(interior.x2[1])
    ]);
  }
  if (interior.x3 !== undefined) {
    return XcmV3Junctions.X3([
      convertJunction(interior.x3[0]),
      convertJunction(interior.x3[1]),
      convertJunction(interior.x3[2])
    ]);
  }
  if (interior.x4 !== undefined) {
    return XcmV3Junctions.X4([
      convertJunction(interior.x4[0]),
      convertJunction(interior.x4[1]),
      convertJunction(interior.x4[2]),
      convertJunction(interior.x4[3])
    ]);
  }

  // Handle PascalCase format as fallback
  if (interior.type) {
    switch (interior.type) {
      case 'Here':
        return XcmV3Junctions.Here();
      case 'X1':
        return XcmV3Junctions.X1(convertJunction(interior.value));
      case 'X2':
        return XcmV3Junctions.X2([
          convertJunction(interior.value[0]),
          convertJunction(interior.value[1])
        ]);
      case 'X3':
        return XcmV3Junctions.X3([
          convertJunction(interior.value[0]),
          convertJunction(interior.value[1]),
          convertJunction(interior.value[2])
        ]);
      case 'X4':
        return XcmV3Junctions.X4([
          convertJunction(interior.value[0]),
          convertJunction(interior.value[1]),
          convertJunction(interior.value[2]),
          convertJunction(interior.value[3])
        ]);
    }
  }

  throw new Error(`Invalid interior format: ${safeStringify(interior)}`);
};

function fetchHydraXCMLocation(asset: AssetWithId): XcmV4Location | null {
  try {
    if (!asset?.hydradx?.location) {
      return null;
    }

    const location = asset.hydradx.location;
    console.log('Raw location:', safeStringify(location, true));

    // Construct the XcmV4Location using the helper functions
    const xcmLocation: XcmV4Location = {
      parents: location.parents,
      interior: convertJunctions(location.interior)
    };

    return xcmLocation;

  } catch (error) {
    console.error('Error constructing XCM location:', error);
    throw new Error(`Failed to construct XCM location: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
