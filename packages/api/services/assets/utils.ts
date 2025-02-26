import { XcmV3Junction } from '@polkadot-api/descriptors';
import { XcmV3Junctions } from '@polkadot-api/descriptors';
import { Asset, XcmV4Location } from './types';
import { CacheService } from 'services/cache/CacheService';
import { CACHE_KEYS } from 'services/constants';
import { Binary } from 'polkadot-api';

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
    return safeStringify(normalizedLocation);
  } catch (error) {
    console.error('Error matching foreign asset:', error);
    return null;
  }
};

/**
 * 
 * @param amount 
 * @param decimals 
 * @param options 
 * @returns 
 * 
 * 
 * // Example amounts in planck (raw blockchain format)
const examples = {
    smallAmount: "1234500000",        // 1.2345 with 8 decimals
    largeAmount: "123450000000000",   // 1,234,500 with 8 decimals
    tinyAmount: "123",                // 0.00000123 with 8 decimals
    zeroAmount: "0",                  // 0
    preciseAmount: "123456789123456"  // 1,234,567.89123456 with 8 decimals
};

// Let's demonstrate different formatting options:

// 1. Basic formatting (no options)
console.log(formatAmount(examples.smallAmount, 8));
// Output: { raw: "1234500000", decimal: "1.2345" }

// 2. With rounding
console.log(formatAmount(examples.preciseAmount, 8, { round: 2 }));
// Output: { raw: "123456789123456", decimal: "1234567.89" }

// 3. With commify (thousand separators)
console.log(formatAmount(examples.largeAmount, 8, { commify: true }));
// Output: { raw: "123450000000000", decimal: "1,234,500" }

// 4. With all options
console.log(formatAmount(examples.preciseAmount, 8, { 
    round: 4,
    commify: true,
    trim: true 
}));
// Output: { raw: "123456789123456", decimal: "1,234,567.8912" }

// 5. Tiny amounts with different rounding
console.log(formatAmount(examples.tinyAmount, 8, { round: 8 }));
// Output: { raw: "123", decimal: "0.00000123" }

console.log(formatAmount(examples.tinyAmount, 8, { round: 6 }));
// Output: { raw: "123", decimal: "0.000001" }

// 6. Zero handling
console.log(formatAmount(examples.zeroAmount, 8, { 
    round: 2,
    commify: true 
}));
// Output: { raw: "0", decimal: "0" }
 */

export function formatAmount(
  amount: string | bigint,
  decimals: number,
  options?: {
    round?: number;      // Number of decimal places to round to
    commify?: boolean;   // Whether to add thousand separators
    trim?: boolean;      // Whether to trim trailing zeros
  }
): { raw: string; decimal: string } {
  try {
    const rawBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
    const raw = rawBigInt.toString();

    // Handle zero amount
    if (rawBigInt === BigInt(0)) {
      return { raw: '0', decimal: '0' };
    }

    // Convert to decimal
    const decimalStr = (Number(rawBigInt) / Math.pow(10, decimals)).toString();

    // Apply rounding if specified
    let formattedDecimal = decimalStr;
    if (options?.round !== undefined) {
      const rounded = Number(decimalStr);
      if (Number.isFinite(rounded)) {
        formattedDecimal = rounded.toFixed(options.round);
      }
    }

    // Trim trailing zeros if requested
    if (options?.trim) {
      formattedDecimal = formattedDecimal.replace(/\.?0+$/, '');
    }

    // Add thousand separators if requested
    if (options?.commify) {
      const parts = formattedDecimal.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formattedDecimal = parts.join('.');
    }

    return {
      raw,
      decimal: formattedDecimal
    };
  } catch (error) {
    console.error('Error formatting amount:', error);
    return {
      raw: '0',
      decimal: '0'
    };
  }
}


/**
 * 
 * @param amount 
 * @param decimals 
 * @returns 
 */
export function convertToPlank(amount: string | number, decimals: number): bigint {
  try {
    // Handle empty or invalid input
    if (!amount || amount === '0') {
      return BigInt(0);
    }

    // Convert amount to a number and handle scientific notation
    const numAmount = typeof amount === 'string' ?
      Number(amount.replace(/,/g, '')) : amount;

    if (!Number.isFinite(numAmount)) {
      throw new Error('Invalid number format');
    }

    // Calculate planck amount with proper decimal handling
    const multiplier = Math.pow(10, decimals);
    const planckAmount = Math.round(numAmount * multiplier);

    // Check for overflow
    if (!Number.isSafeInteger(planckAmount)) {
      throw new Error('Amount too large for safe conversion');
    }

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

// Helper function to check if a value is a BigInt
export const isBigInt = (value: unknown): value is bigint => {
  return typeof value === 'bigint';
};

// Helper function to check if a value is a Binary type from Polkadot API
export const isBinary = (value: unknown): boolean => {
  return value !== null && 
         typeof value === 'object' && 
         'asHex' in value && 
         typeof value.asHex === 'function';
};

/**
 * Safely stringify complex objects including BigInt and Binary values
 * @param value The value to stringify
 * @param format Whether to format the JSON with indentation
 * @returns A string representation of the value
 */
export const safeStringify = (value: unknown, format?: boolean): string => {
  if (!value) return value?.toString() ?? "";

  return JSON.stringify(
    value,
    (key, value) => {
      if (isBigInt(value)) {
        return `bigint:${value.toString()}`;
      } else if (isBinary(value)) {
        return `binary:${value.asHex()}`;
      }
      return value;
    },
    format ? 2 : undefined,
  );
};

/**
 * Parse a string created with safeStringify back to its original form
 * @param text The string to parse
 * @returns The parsed value
 */
export const safeParse = <T = unknown>(value: string): T => {
  return JSON.parse(value, (key, value) => {
    if (typeof value === "string") {
      if (value.startsWith("bigint:")) return BigInt(value.slice(7));
      if (value.startsWith("binary:")) return Binary.fromHex(value.slice(7));
    }
    
    // Handle the specific case for AccountKey20's network property which should be an Option
    if (key === "network" && value === null) {
      // Return undefined to indicate that this is None/null Option
      return undefined;
    }
    
    return value;
  });
};

/**
 * Ensures an asset has properly serialized XCM location for caching
 * @param asset The asset to prepare
 * @returns The asset with properly serialized XCM location
 */
export const ensureSerializedXcmLocation = (asset: Asset): Asset => {
  // If xcmLocation is already a string, no need to change
  if (typeof asset.xcmLocation === 'string') {
    return asset;
  }
  
  // Make a copy to avoid mutating the original
  const preparedAsset = {...asset};
  
  // Ensure the xcmLocation is serialized
  preparedAsset.xcmLocation = safeStringify(asset.xcmLocation);
  
  return preparedAsset;
};
