import { safeStringify } from "@swush/api";
import { Binary, TypedApi } from "polkadot-api";
import {
    XcmVersionedLocation,
    XcmVersionedAssetId,
    XcmV3WeightLimit,
    XcmV3Junction,
    XcmV3Junctions,
    XcmV3MultiassetFungibility,
    XcmVersionedXcm,
    XcmV4Instruction,
    XcmV4AssetAssetFilter,
    XcmV4AssetWildAsset,
    polkadot_asset_hub,
    hydration,
    PolkadotRuntimeOriginCaller
  } from '@polkadot-api/descriptors';
import { XcmV4Location } from "@swush/api";
import { AssetWithId } from "@/lib/api";
import { serializeKey } from "../..";

// Helper function to calculate fees for HydraDX XCM swap
export async function calculateHydraDxXcmFees(
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
export async function constructHydraDxXcmMessage(
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

export function fetchHydraXCMLocation(asset: AssetWithId): XcmV4Location | null {
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
