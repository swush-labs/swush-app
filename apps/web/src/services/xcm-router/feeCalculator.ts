import { TRouterXcmFeeResult } from "@paraspell/xcm-router";
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';

export type FeeDetail = {
  rawAmount: string;
  adjustedAmount: string;
  decimals: number;
  currency: string;
};

export type FeeSummary = {
  totalFees: {
    [currency: string]: FeeDetail;
  };
  breakdown: {
    origin: TRouterXcmFeeResult['origin'];
    destination: TRouterXcmFeeResult['destination'];
    hops: TRouterXcmFeeResult['hops'];
  };
};

export type FeeEstimate = {
  fees: FeeSummary | null;
  isLoading: boolean;
  error?: string;
};

/**
 * Safe JSON serialization that handles BigInt values
 */
export const safeStringify = (obj: any): string => {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
};

/**
 * Calculates total fees from RouterBuilder fee result
 * Aggregates fees by currency and converts to human-readable format
 * 
 * @param feeResult - Fee result from ParaSpell XCM Router (includes asset decimals)
 */
export const calculateTotalFees = (feeResult: TRouterXcmFeeResult): FeeSummary => {
  const feeMap = new Map<string, { raw: bigint; decimals: number }>();
  
  /**
   * Get decimals from asset info - throws if not available
   * This ensures we never use incorrect decimal values
   */
  const getDecimals = (currency: string, assetDecimals?: number): number => {
    // Use decimals from fee result asset (should always be present from ParaSpell)
    if (assetDecimals !== undefined && assetDecimals > 0) {
      return assetDecimals;
    }
    
    throw new Error(
      `Missing decimals for currency ${currency}. ` +
      `ParaSpell fee result should include asset.decimals but it's undefined. ` +
      `This is likely a ParaSpell API issue or unsupported token.`
    );
  };
  
  // Process origin fees
  const originFee = BigInt(feeResult.origin.fee || "0");
  const originDecimals = getDecimals(feeResult.origin.currency, feeResult.origin.asset?.decimals);
  feeMap.set(feeResult.origin.currency, { raw: originFee, decimals: originDecimals });
  
  // Process destination fees
  const destFee = BigInt(feeResult.destination.fee || "0");
  const destDecimals = getDecimals(feeResult.destination.currency, feeResult.destination.asset?.decimals);
  const existingDest = feeMap.get(feeResult.destination.currency);
  if (existingDest) {
    feeMap.set(feeResult.destination.currency, { 
      raw: existingDest.raw + destFee, 
      decimals: existingDest.decimals 
    });
  } else {
    feeMap.set(feeResult.destination.currency, { raw: destFee, decimals: destDecimals });
  }
  
  // Process hops fees
  feeResult.hops.forEach(hop => {
    const hopFee = BigInt(hop.result.fee || "0");
    const hopDecimals = getDecimals(hop.result.currency, hop.result.asset?.decimals);
    const existingHop = feeMap.get(hop.result.currency);
    if (existingHop) {
      feeMap.set(hop.result.currency, { 
        raw: existingHop.raw + hopFee, 
        decimals: existingHop.decimals 
      });
    } else {
      feeMap.set(hop.result.currency, { raw: hopFee, decimals: hopDecimals });
    }
  });
  
  return {
    totalFees: Object.fromEntries(
      Array.from(feeMap.entries()).map(([currency, { raw, decimals }]) => {
        const { decimal: adjustedAmount } = formatAmount(raw, decimals, NUMBER_FORMAT_OPTIONS);
        return [
          currency,
          {
            rawAmount: raw.toString(),
            adjustedAmount,
            decimals,
            currency
          }
        ];
      })
    ),
    breakdown: {
      origin: feeResult.origin,
      destination: feeResult.destination,
      hops: feeResult.hops
    }
  };
};

/**
 * Formats fee summary for display
 */
export const formatFeeSummary = (feeSummary: FeeSummary): string => {
  return Object.entries(feeSummary.totalFees)
    .map(([currency, { adjustedAmount }]) => `${adjustedAmount} ${currency}`)
    .join(' + ');
};

/**
 * Gets adjusted fee amount for a specific fee value and decimals
 */
export const getAdjustedFeeAmount = (fee: string | bigint | undefined, decimals: number): string => {
  if (!fee) return "0";
  const { decimal } = formatAmount(fee, decimals, NUMBER_FORMAT_OPTIONS);
  return decimal;
};
