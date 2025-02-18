import { XcmV3Junction } from '@polkadot-api/descriptors';
import { XcmV3Junctions } from '@polkadot-api/descriptors';
import { Asset, XcmV4Location } from './types';
import { CacheService } from 'services/cache/CacheService';
import { CACHE_KEYS } from 'services/constants';

export function serializeKey(key: any): string {
    if (typeof key === 'number' || typeof key === 'bigint') {
        return key.toString();
    }

    if (key && typeof key === 'object') {
        const replacer = (_: string, value: any) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        };
        return JSON.stringify(key, replacer);
    }

    return JSON.stringify(key);
}

export function getXcmV3Multilocation(assetId: bigint | number): XcmV4Location {
    return {
        parents: 0,
        interior: XcmV3Junctions.X2([
            XcmV3Junction.PalletInstance(50),
            XcmV3Junction.GeneralIndex(BigInt(assetId)),
        ]),
    };
}

// Helper function to create XCM location
export function createXcmLocation(assetId: number) {
    return {
        parents: 0,
        interior: XcmV3Junctions.X2([
            XcmV3Junction.PalletInstance(50),
            XcmV3Junction.GeneralIndex(BigInt(assetId)),
        ])
    };
}


// Helper function to check native asset match and extract assetId
export const getNativeAssetId = (location: any): string | null => {
    if (!location?.interior?.x3) return null;
    const interior = location.interior.x3;

    if (!interior.some((j: { palletInstance?: number }) => j.palletInstance === 50) ||
        !interior.some((j: { parachain?: number }) => j.parachain === 1000)) {
        return null;
    }

    const generalIndexEntry = interior.find((j: { generalIndex?: string | number }) => j.generalIndex !== undefined);
    return generalIndexEntry ? generalIndexEntry.generalIndex.toString() : null;
};

// Helper function to check foreign asset match
export const getForeignAssetId = (location: any): string | null => {
    try {
        // Check if location and required properties exist
        if (!location || typeof location.parents === 'undefined' || !location.interior) {
            return null;
        }

        const normalizedLocation = {
            parents: location.parents,
            interior: location.interior
        };
        return serializeKey(normalizedLocation);
    } catch (error) {
        console.error('Error matching foreign asset:', error);
        return null;
    }
};


export function formatAmount(amount: string | bigint, decimals: number): { raw: string; decimal: string } {
    try {
        const rawBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
        const raw = rawBigInt.toString();
        const decimal = (Number(rawBigInt) / Math.pow(10, decimals)).toFixed(decimals);
        
        return {
            raw,
            decimal
        };
    } catch (error) {
        console.error('Error formatting amount:', error);
        return {
            raw: '0',
            decimal: '0'
        };
    }
}

export function convertToPlank(amount: string | number, decimals: number): bigint {
    try {
        // Convert amount to a number first to handle both string and number inputs
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        // Use Math.round to avoid floating point precision issues
        const planckAmount = Math.round(numAmount * Math.pow(10, decimals));
        return BigInt(planckAmount);
    } catch (error) {
        console.error('Error converting to planck:', error);
        return BigInt(0);
    }
}

export function fetchCachedAssets(assetId?: string): Asset | Map<string, Asset> | null {
    const cacheService = CacheService.getInstance();
    const assets = cacheService.get<Map<string, Asset>>(CACHE_KEYS.MERGED_ASSETS);
    return assetId ? assets.get(assetId) || null : assets;
}
