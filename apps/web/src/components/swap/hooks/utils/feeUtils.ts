import { FeeBreakdown } from '../types';

// Hardcoded XCM fees for HydraDX from transactionBuilders
const HYDRA_DX_XCM_FEES = {
  initialExecution: BigInt(48945000),    // ~0.048945 DOT
  initialDelivery: BigInt(307250000),    // ~0.30725 DOT
  hydradxExecution: BigInt(266095510),   // ~0.266095 DOT
  finalExecution: BigInt(3098000000),    // ~3.098 DOT
};

// Base transaction fees
const BASE_TRANSACTION_FEE = BigInt(40000000); // ~0.04 DOT

/**
 * Calculate fees based on DEX type
 * @param dex - The DEX type ('hydra_dx' or 'asset_hub')
 * @returns Object containing estimated fee and fee breakdown
 */
export function calculateEstimatedFees(dex: string): {
  estimatedFee: string;
  feeBreakdown: FeeBreakdown;
} {
  const isHydraDx = dex === 'hydra_dx';
  
  // Calculate XCM fees for HydraDX
  const xcmFee = isHydraDx ? 
    Object.values(HYDRA_DX_XCM_FEES).reduce((a, b) => a + b, BigInt(0)) : 
    BigInt(0);
  
  // We don't include trading fees as they're handled by output calculation
  const tradingFee = BigInt(0);
  
  // Calculate total fee
  const totalFee = BASE_TRANSACTION_FEE + xcmFee;
  
  return {
    estimatedFee: totalFee.toString(),
    feeBreakdown: {
      transactionFee: BASE_TRANSACTION_FEE,
      xcmFee,
      tradingFee,
      totalFee
    }
  };
} 