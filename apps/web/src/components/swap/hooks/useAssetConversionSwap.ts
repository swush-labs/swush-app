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
  hydration
} from '@polkadot-api/descriptors';

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

          // Define DOT asset ID for fees
          const dotAssetId = {
            parents: 1,
            interior: { Here: null }
          };

          // Get the public key as Binary
          const publicKey = Binary.fromBytes(wallet.extension.publicKey);

          // Calculate all fees
          setSwapStatus('Calculating XCM fees...');
          const fees = await calculateHydraDxXcmFees(
            assetHubApi,
            hydraDxApi,
            parseXcmLocation(inputAsset.rawXcmLocation),
            parseXcmLocation(outputAsset.rawXcmLocation),
            inputAmountPlanck,
            minOutputAmountPlanck,
            publicKey,
            dotAssetId
          );

          // Construct XCM message
          setSwapStatus('Constructing XCM message...');
          const xcmMessage = await constructHydraDxXcmMessage(
            fees,
            parseXcmLocation(inputAsset.rawXcmLocation),
            parseXcmLocation(outputAsset.rawXcmLocation),
            inputAmountPlanck,
            minOutputAmountPlanck,
            publicKey,
            dotAssetId
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
  beneficiaryAccountId: FixedSizeBinary<32>,
  dotAssetId: any
): Promise<{
  initialExecution: bigint;
  initialDelivery: bigint;
  hydradxExecution: bigint;
  returnDelivery: bigint;
  finalExecution: bigint;
  initialWeight: any;
}> {

  try {
    console.log('Debug: Input parameters:', {
      inputAssetLocation: serializeKey(inputAssetLocation),
      outputAssetLocation: serializeKey(outputAssetLocation),
      inputAmountPlanck: inputAmountPlanck.toString(),
      minOutputAmountPlanck: minOutputAmountPlanck.toString(),
      dotAssetId: serializeKey(dotAssetId)
    });

    // Step 1: Construct WithdrawAsset instruction
    console.log('Debug: Constructing WithdrawAsset...');
    const withdrawAsset = {
      id: inputAssetLocation,
      fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
    };
    console.log('Debug: WithdrawAsset constructed:', serializeKey(withdrawAsset));

    // Step 2: Construct BuyExecution instruction
    console.log('Debug: Constructing BuyExecution...');
    const buyExecution = XcmV4Instruction.BuyExecution({
      fees: {
        id: dotAssetId,
        fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
      },
      weight_limit: XcmV3WeightLimit.Unlimited()
    });
    console.log('Debug: BuyExecution constructed:', serializeKey(buyExecution));

    // Step 3: Construct ExchangeAsset instruction
    console.log('Debug: Constructing ExchangeAsset...');
    const exchangeAsset = XcmV4Instruction.ExchangeAsset({
      give: XcmV4AssetAssetFilter.Definite([{
        id: inputAssetLocation,
        fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
      }]),
      want: [{
        id: outputAssetLocation,
        fun: XcmV3MultiassetFungibility.Fungible(minOutputAmountPlanck)
      }],
      maximal: true
    });
    console.log('Debug: ExchangeAsset constructed:', serializeKey(exchangeAsset));

    // Step 4: Construct InitiateReserveWithdraw instruction
    console.log('Debug: Constructing InitiateReserveWithdraw...');
    const initiateReserveWithdraw = XcmV4Instruction.InitiateReserveWithdraw({
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
        // XcmV4Instruction.DepositAsset({
        //   assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()),
        //   beneficiary: {
        //     parents: 0,
        //     interior: XcmV3Junctions.X1(
        //       XcmV3Junction.AccountId32({
        //         network: undefined,
        //         id: Binary.fromBytes(beneficiaryAccountId)
        //       })
        //     )
        //   }
        // })
      ]
    });
    console.log('Debug: InitiateReserveWithdraw constructed:', serializeKey(initiateReserveWithdraw));

    // Step 5: Construct the complete XCM message
    console.log('Debug: Constructing complete XCM message...');
    const message = XcmVersionedXcm.V4([
      XcmV4Instruction.WithdrawAsset([withdrawAsset]),
      XcmV4Instruction.DepositReserveAsset({
        assets: XcmV4AssetAssetFilter.Definite([withdrawAsset]),
        dest: {
          parents: 1,
          interior: XcmV3Junctions.X1(
            XcmV3Junction.Parachain(2034) // HydraDX parachain ID
          )
        },
        xcm: [buyExecution, exchangeAsset, initiateReserveWithdraw]
      })
    ]);
  console.log('Debug: Complete XCM message constructed:', serializeKey(message));

    // Calculate initial weight
    console.log('Debug: Calculating initial weight...');
    const xcmWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(message);
    if (!xcmWeight.success) {
      console.error('Debug: Failed to calculate XCM weight:', xcmWeight);
      throw new Error("Failed to calculate total XCM weight");
    }
    console.log('Debug: Initial weight calculated:', serializeKey(xcmWeight.value));

    // Calculate initial execution fee
    const xcmFee = await assetHubApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
      xcmWeight.value,
      dotAssetId
    );

    if (!xcmFee.success) {
      throw new Error("Failed to calculate initial execution fee");
    } else {
      console.log('Debug: Initial execution fee calculated:', serializeKey(xcmFee.value));
    }

    const initialExecutionFee = extractFeeValue(xcmFee);

    // Calculate delivery fees to HydraDX
    const deliveryFeesResult = await assetHubApi.apis.XcmPaymentApi.query_delivery_fees(
      XcmVersionedLocation.V4({
        parents: 1,
        interior: XcmV3Junctions.X1(
          XcmV3Junction.Parachain(2034) // HydraDX parachain ID
        )
      }),
      message
    );

    if (!deliveryFeesResult.success) {
      throw new Error("Failed to calculate delivery fees");
    } else {
      console.log('Debug: Delivery fees calculated:', serializeKey(deliveryFeesResult.value));
    }
    const deliveryFees = extractFeeValue(deliveryFeesResult);

    // Calculate HydraDX execution fees
    const remoteXcmWeight = await hydraDxApi.apis.XcmPaymentApi.query_xcm_weight(message);
    if (!remoteXcmWeight.success) {
      throw new Error("Failed to calculate HydraDX execution weight");
    }

    const remoteXcmFee = await hydraDxApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
      remoteXcmWeight.value,
      dotAssetId
    );
    if (!remoteXcmFee.success) {
      throw new Error("Failed to calculate HydraDX execution fee");
    } else {
      console.log('Debug: HydraDX execution fee calculated:', serializeKey(remoteXcmFee.value));
    }
    const hydraDxExecutionFee = extractFeeValue(remoteXcmFee);

    // Calculate return fees
    const returnMessage = XcmVersionedXcm.V4([
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
                  id: Binary.fromBytes(beneficiaryAccountId.asBytes())
                })
              )
            }
          })
        ]
      })
    ]);

    const returnDeliveryFeesResult = await hydraDxApi.apis.XcmPaymentApi.query_delivery_fees(
      XcmVersionedLocation.V4({
        parents: 1,
        interior: XcmV3Junctions.X1(
          XcmV3Junction.Parachain(1000) // Asset Hub parachain ID
        )
      }),
      returnMessage
    );
    const returnDeliveryFees = extractFeeValue(returnDeliveryFeesResult);

    // Calculate final Asset Hub execution fees
    const finalAssetHubWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(returnMessage);
    if (!finalAssetHubWeight.success) {
      throw new Error("Failed to calculate final Asset Hub execution weight");
    }

    const finalAssetHubFee = await assetHubApi.apis.XcmPaymentApi.query_weight_to_asset_fee(
      finalAssetHubWeight.value,
      dotAssetId
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
  } catch (e: unknown) {
    console.error('Error in HydraDX swap preparation:', e);
    if (e instanceof Error) {
      console.error('Error stack:', e.stack);
      console.error('Error message:', e.message);
    }
    throw new Error(`Failed to prepare HydraDX swap: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
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
  beneficiaryAccountId: FixedSizeBinary<32>,
  dotAssetId: any
) {
  try {
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
                      id: Binary.fromBytes(beneficiaryAccountId.asBytes())
                    })
                  )
                }
              })
            ]
          })
        ]
      })
    ]);
  } catch (e: unknown) {
    console.error('Error in HydraDX swap preparation:', e);
    throw new Error(`Failed to prepare HydraDX swap: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
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