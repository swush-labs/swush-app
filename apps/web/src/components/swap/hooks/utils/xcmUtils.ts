import { safeStringify, serializeKey } from '@/components/swap/utils';
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
import { type XcmV4Location } from "@swush/api";
import { AssetWithId } from "@/lib/api";

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
    assetHubInputLocation: XcmV4Location,  // Asset Hub relative location for input asset
    assetHubOutputLocation: XcmV4Location, // Asset Hub relative location for output asset (unused here, but good for context)
    hydraDxInputLocation: XcmV4Location,   // HydraDX relative location for input asset
    hydraDxOutputLocation: XcmV4Location,  // HydraDX relative location for output asset
    inputAmountPlanck: bigint,
    minOutputAmountPlanck: bigint,
    beneficiaryAccountId: Uint8Array<ArrayBufferLike>
) {
    console.log('Constructing XCM: Debug Fees:', fees);
    console.log('Constructing XCM: Asset Hub Input Location:', safeStringify(assetHubInputLocation, true));
    console.log('Constructing XCM: HydraDX Input Location:', safeStringify(hydraDxInputLocation, true));
    console.log('Constructing XCM: HydraDX Output Location:', safeStringify(hydraDxOutputLocation, true));

    // Define Asset Hub relative location for DOT (used for fee payments on Asset Hub)
    const dotAssetHubLocation: XcmV4Location = {
        parents: 1,
        interior: XcmV3Junctions.Here()
    };

    // Calculate total fees (to be paid in DOT)
    const totalFees = fees.initialExecution +
        fees.initialDelivery +
        fees.hydradxExecution +
        fees.returnDelivery +
        fees.finalExecution;

    // Assets to withdraw from Asset Hub
    // We need the input amount of the input asset AND the total fees in DOT.
    const assetsToWithdraw = [];
    const isInputDot = safeStringify(assetHubInputLocation) === safeStringify(dotAssetHubLocation);

    if (isInputDot) {
        // Input is DOT: Withdraw total amount (input + fees) in DOT
        console.log('Debug: Withdrawing DOT (Input + Fees)');
        assetsToWithdraw.push({
            id: dotAssetHubLocation,
            fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck + totalFees)
        });
    } else {
        // Input is not DOT: Withdraw input amount of input asset AND total fees in DOT
        console.log('Debug: Withdrawing Non-DOT Input Asset + DOT Fees');
        assetsToWithdraw.push({
            id: assetHubInputLocation, // Use Asset Hub relative location
            fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
        });
        assetsToWithdraw.push({
            id: dotAssetHubLocation,
            fun: XcmV3MultiassetFungibility.Fungible(totalFees)
        });
    }

    console.log('Debug: Assets to Withdraw:', safeStringify(assetsToWithdraw, true));

    // Assets to deposit on HydraDX (will be filtered from withdrawn assets)
    const assetsToDepositOnHydra = XcmV4AssetAssetFilter.Definite(assetsToWithdraw.map(a => ({ ...a }))); // Use a copy

    return XcmVersionedXcm.V4([
        // 1. Withdraw asset(s) from Asset Hub (using Asset Hub relative locations)
        XcmV4Instruction.WithdrawAsset(assetsToWithdraw),

        // 2. Deposit on HydraDX reserve account and execute instructions there
        XcmV4Instruction.DepositReserveAsset({
            assets: assetsToDepositOnHydra,
            dest: {
                parents: 1,
                interior: XcmV3Junctions.X1(
                    XcmV3Junction.Parachain(2034) // HydraDX parachain ID
                )
            },
            xcm: [
                // 2a. Pay for HydraDX execution + incoming delivery fees (using HydraDX relative location for DOT)
                XcmV4Instruction.BuyExecution({
                    fees: {
                        id: dotAssetHubLocation, // DOT from HydraDX's perspective
                        fun: XcmV3MultiassetFungibility.Fungible(fees.hydradxExecution + fees.initialDelivery)
                    },
                    weight_limit: XcmV3WeightLimit.Unlimited()
                }),

                // 2b. Exchange asset on HydraDX (using HydraDX relative locations)
                XcmV4Instruction.ExchangeAsset({
                    give: XcmV4AssetAssetFilter.Definite([{ // Give the input asset amount
                        id: hydraDxInputLocation, // Use HydraDX relative location
                        fun: XcmV3MultiassetFungibility.Fungible(inputAmountPlanck)
                    }]),
                    want: [{ // Expect the minimum output amount
                        id: hydraDxOutputLocation, // Use HydraDX relative location
                        fun: XcmV3MultiassetFungibility.Fungible(minOutputAmountPlanck)
                    }],
                    maximal: true // We provided the exact input amount
                }),

                // 2c. Send *all* resulting assets back to Asset Hub reserve account
                XcmV4Instruction.InitiateReserveWithdraw({
                    assets: XcmV4AssetAssetFilter.Wild(XcmV4AssetWildAsset.All()), // Withdraw whatever the exchange resulted in
                    reserve: {
                        parents: 1,
                        interior: XcmV3Junctions.X1(
                            XcmV3Junction.Parachain(1000) // Asset Hub parachain ID
                        )
                    },
                    xcm: [
                        // 2c.i Pay for final Asset Hub execution + return delivery fees (using Asset Hub relative location for DOT)
                        XcmV4Instruction.BuyExecution({
                            fees: {
                                id: dotAssetHubLocation, // DOT from Asset Hub's perspective
                                fun: XcmV3MultiassetFungibility.Fungible(fees.finalExecution + fees.returnDelivery)
                            },
                            weight_limit: XcmV3WeightLimit.Unlimited()
                        }),
                        // 2c.ii Deposit the final assets to the beneficiary on Asset Hub
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
        throw new Error(`Fee calculation was not successful: ${safeStringify(feeResult)}`);
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

    // Handle direct bigint value from query_weight_to_asset_fee
    if (feeResult.value?.fun?.type === 'Fungible') {
        const value = feeResult.value.fun.value.toString();
        return BigInt(value);
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

    console.log("Problematic fee result:", safeStringify(feeResult));
    throw new Error(`Unexpected fee result structure: ${safeStringify(feeResult)}`);
}

// Helper function to convert XCM junction
const convertJunction = (junction: any): XcmV3Junction => {
    if (!junction) {
        throw new Error(`Invalid junction: ${safeStringify(junction)}`);
    }

    // Handle both camelCase and PascalCase formats
    // Prioritize specific keys if present
    if (junction.parachain !== undefined) {
        return XcmV3Junction.Parachain(junction.parachain);
    }
    if (junction.palletInstance !== undefined) {
        return XcmV3Junction.PalletInstance(junction.palletInstance);
    }
    if (junction.generalIndex !== undefined) {
        // Ensure GeneralIndex is treated as BigInt
        return XcmV3Junction.GeneralIndex(BigInt(junction.generalIndex));
    }
    if (junction.accountId32 !== undefined) {
        return XcmV3Junction.AccountId32({
            network: junction.accountId32.network, // Network may be undefined
            id: typeof junction.accountId32.id === 'string'
                ? Binary.fromHex(junction.accountId32.id)
                : Binary.fromBytes(junction.accountId32.id)
        });
    }

    // Handle { type: 'Here', value: undefined } or { Here: null }
    if (junction.type === 'Here' || junction.Here !== undefined) {
        // There's no specific 'Here' junction type, it's represented by the Junctions enum
        // This case should be handled by convertJunctions
        throw new Error(`'Here' junction should be handled by convertJunctions`);
    }

    // Handle type/value format (often from older representations or serialization)
    if (junction.type) {
        switch (junction.type) {
            case 'Parachain':
                return XcmV3Junction.Parachain(junction.value);
            case 'PalletInstance':
                return XcmV3Junction.PalletInstance(junction.value);
            case 'GeneralIndex':
                return XcmV3Junction.GeneralIndex(BigInt(junction.value));
            case 'AccountId32':
                const network = junction.value.network; // May be undefined
                const idBytes = typeof junction.value.id === 'string'
                    ? Binary.fromHex(junction.value.id)
                    : Binary.fromBytes(junction.value.id);
                return XcmV3Junction.AccountId32({ network, id: idBytes });
        }
    }

    throw new Error(`Unsupported junction format: ${safeStringify(junction)}`);
};

// Helper function to convert XCM junctions (interior)
const convertJunctions = (interior: any): XcmV3Junctions => {
    if (!interior) {
        throw new Error(`Invalid interior: ${safeStringify(interior)}`);
    }

    // Handle specific keys first (camelCase, preferred)
    if (interior.here !== undefined || interior.Here !== undefined) {
        return XcmV3Junctions.Here();
    }
    if (interior.x1 !== undefined) {
        // Ensure x1 is treated as a single junction object, not an array
        const junction = Array.isArray(interior.x1) ? interior.x1[0] : interior.x1;
        return XcmV3Junctions.X1(convertJunction(junction));
    }
    if (interior.x2 !== undefined && Array.isArray(interior.x2) && interior.x2.length === 2) {
        return XcmV3Junctions.X2([
            convertJunction(interior.x2[0]),
            convertJunction(interior.x2[1])
        ]);
    }
    if (interior.x3 !== undefined && Array.isArray(interior.x3) && interior.x3.length === 3) {
        return XcmV3Junctions.X3([
            convertJunction(interior.x3[0]),
            convertJunction(interior.x3[1]),
            convertJunction(interior.x3[2])
        ]);
    }
    if (interior.x4 !== undefined && Array.isArray(interior.x4) && interior.x4.length === 4) {
        return XcmV3Junctions.X4([
            convertJunction(interior.x4[0]),
            convertJunction(interior.x4[1]),
            convertJunction(interior.x4[2]),
            convertJunction(interior.x4[3])
        ]);
    }

    // Handle type/value format (PascalCase, fallback)
    if (interior.type) {
        switch (interior.type) {
            case 'Here':
                return XcmV3Junctions.Here();
            case 'X1':
                // Ensure value is treated as a single junction object
                const junction = Array.isArray(interior.value) ? interior.value[0] : interior.value;
                return XcmV3Junctions.X1(convertJunction(junction));
            case 'X2':
                if (!Array.isArray(interior.value) || interior.value.length !== 2) {
                    throw new Error(`Invalid interior format for X2: ${safeStringify(interior)}`);
                }
                return XcmV3Junctions.X2([
                    convertJunction(interior.value[0]),
                    convertJunction(interior.value[1])
                ]);
            case 'X3':
                if (!Array.isArray(interior.value) || interior.value.length !== 3) {
                    throw new Error(`Invalid interior format for X3: ${safeStringify(interior)}`);
                }
                return XcmV3Junctions.X3([
                    convertJunction(interior.value[0]),
                    convertJunction(interior.value[1]),
                    convertJunction(interior.value[2])
                ]);
            case 'X4':
                if (!Array.isArray(interior.value) || interior.value.length !== 4) {
                    throw new Error(`Invalid interior format for X4: ${safeStringify(interior)}`);
                }
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

// Fetch HydraDX relative location using data from AssetWithId
export function fetchHydraXCMLocation(asset: AssetWithId): XcmV4Location | null {
    try {
        // Check if hydradx specific location data exists
        if (!asset?.hydradx?.location) {
            console.warn(`Asset ${asset.id} (${asset.metadata.symbol}) has no hydradx location data.`);
            return null;
        }

        const location = asset.hydradx.location;
        console.log(`Raw HydraDX location for ${asset.id}:`, safeStringify(location, true));

        // Construct the XcmV4Location using the helper functions
        // Ensure the structure matches XcmV4Location
        const xcmLocation: XcmV4Location = {
            parents: location.parents,
            interior: convertJunctions(location.interior) // Use the robust converter
        };

        console.log(`Constructed HydraDX XCM Location for ${asset.id}:`, safeStringify(xcmLocation, true));
        return xcmLocation;

    } catch (error) {
        console.error(`Error constructing HydraDX XCM location for asset ${asset.id}:`, error);
        // Return null or throw, depending on desired error handling
        // Returning null allows the caller (useAssetConversionSwap) to handle it gracefully
        return null;
        // throw new Error(`Failed to construct HydraDX XCM location for ${asset.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}