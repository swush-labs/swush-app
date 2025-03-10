import { Asset, AssetType } from "./types";
import { safeStringify } from "./utils";

// Create the raw XCM location for DOT
const dotRawXcmLocation = {
    parents: 1,
    interior: { type: 'Here' }
};

export const NATIVE_DOT_ASSET: Asset = {
    asset: {
        owner: '0x0', // DOT doesn't have an owner
        issuer: '0x0',
        admin: '0x0',
        freezer: '0x0',
        supply: BigInt(0), // Will be updated from chain state if needed

        deposit: BigInt(0),
        min_balance: BigInt(1),
        is_sufficient: true,
        accounts: 0,
        sufficients: 0,
        approvals: 0,
    },
    metadata: {
        deposit: BigInt(0),
        name: "Polkadot",
        symbol: "DOT",
        decimals: 10, // DOT has 10 decimals
        is_frozen: false
    },
    assetType: AssetType.Native,
    // Store serialized XCM location as a string
    xcmLocation: safeStringify(dotRawXcmLocation),
    // Store the raw XCM location
    rawXcmLocation: dotRawXcmLocation,
    // Add hydradx info and assetId as 5
    hydradx: {
        assetId: '5',
        location: {
            parents: 1,
            interior: { type: 'Here', value: undefined }
        },
        poolAddress: '0x0',
        poolType: '0x0',
        balance: '0x0',
        existentialDeposit: '0x0'
    }
};