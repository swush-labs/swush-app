import { Asset } from '@/services/assets/types';
import { api } from '@/lib/api';

// Format amount from raw blockchain format to readable decimal format
export function formatAmount(
  amount: string | bigint | null | undefined,
  decimals: number,
  options?: {
    round?: number;      // Number of decimal places to round to
    commify?: boolean;   // Whether to add thousand separators
    trim?: boolean;      // Whether to trim trailing zeros
  }
): { raw: string; decimal: string } {
  try {
    // Handle null, undefined, or empty values
    if (amount === null || amount === undefined || amount === '') {
      return { raw: '0', decimal: '0' };
    }

    // Handle string that can't be converted to BigInt
    if (typeof amount === 'string' && amount.trim() === '') {
      return { raw: '0', decimal: '0' };
    }

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

// Fetch asset information from API
export async function fetchAssetInfo(assetId: string | number): Promise<Asset | null> {
  try {
    // Use the existing API client to fetch assets
    const assets = await api.assets.getAll();
    // Find the asset by ID
    const asset = assets.find(a => a.id === assetId.toString());
    
    if (!asset) {
      console.warn(`Asset not found: ${assetId}`);
      return null;
    }
    
    return asset;
  } catch (error) {
    console.error('Error fetching asset:', error);
    return null;
  }
} 