import { api } from '@/lib/api';
import { AssetsMap } from '../types';
import { safeParse } from '@/components/swap/utils';
import { XcmV4Location } from '@swush/api';

export const getAssetsWithXcmLocations = async (): Promise<AssetsMap> => {
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
};

export const parseXcmLocation = (rawLocation: any): XcmV4Location => {
  try {
    // If it's already an object, parse its stringified form
    const locationStr = typeof rawLocation === 'string'
      ? rawLocation
      : JSON.stringify(rawLocation);

    // Parse the location while preserving the exact structure
    const parsed = safeParse<XcmV4Location>(locationStr);

    // Return the raw parsed structure without modification
    return parsed;
  } catch (error) {
    console.error('Failed to parse XCM location:', error);
    throw new Error('Invalid XCM location format');
  }
};

export const toAssetPlanckFormat = (amount: string, decimals: number): bigint => {
  if (!amount || parseFloat(amount) <= 0) return BigInt(0);

  const amountFloat = parseFloat(amount);
  const amountPlanck = amountFloat * 10 ** decimals;
  return BigInt(Math.floor(amountPlanck));
};

export const calculateMinimumOutput = (amount: string, slippagePercent: number, decimals: number): bigint => {
  if (!amount || parseFloat(amount) <= 0) return BigInt(0);

  // Convert to a number, apply slippage, then convert back to string
  const amountFloat = parseFloat(amount);
  const slippageFactor = 1 - (slippagePercent / 100);
  const minimumAmount = amountFloat * slippageFactor;

  // Convert to bigint with appropriate precision
  return BigInt(Math.floor(minimumAmount * 10 ** decimals));
}; 