import { XcmV3Junctions } from '@polkadot-api/descriptors';



export type XcmV4Location = {
    parents: number;
    interior: XcmV3Junctions;
};

export enum AssetType {
    Native = 'Native',
    Foreign = 'Foreign',
    Hydration = 'Hydration'
}

export interface Asset {
    asset: AssetInfo;
    metadata: AssetMetadata;
    assetType: AssetType;
    xcmLocation: XcmV4Location;
    hydradx?: HydraDxInfo;
}

export interface AssetMetadata {
    deposit: bigint;
    name: string;
    symbol: string;
    decimals: number;
    is_frozen: boolean;
}

export interface AssetInfo {
    owner: string;
    issuer: string;
    admin: string;
    freezer: string;
    supply: bigint;
    deposit: bigint;
    min_balance: bigint;
    is_sufficient: boolean;
    accounts: number;
    sufficients: number;
    approvals: number;
}

export interface HydraDxInfo {
    assetId: string;
    location: XcmV4Location;
    poolAddress: string;
    poolType: string;
    balance: string;
    existentialDeposit: string;
}

export interface TokenPair {
    pairOne: XcmV4Location;
    pairTwo: XcmV4Location;
} 