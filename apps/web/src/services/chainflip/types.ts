/**
 * Chainflip Protocol Types
 * 
 * Type definitions for interacting with the Chainflip Broker API (REST)
 * Reference: https://docs.chainflip-broker.io/features/ask-quote/
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Asset ID Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chainflip compound asset identifier
 * Format: {asset}.{network}
 * Examples: "btc.btc", "dot.hub", "usdc.arb", "eth.eth"
 */
export type ChainflipAssetId = string;

// ═══════════════════════════════════════════════════════════════════════════════
// Quote Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChainflipQuoteRequest {
  sourceAsset: ChainflipAssetId;  // e.g., "dot.hub"
  destinationAsset: ChainflipAssetId;  // e.g., "usdc.arb"
  amount: string;  // Amount in human-readable format (e.g., "1" for 1 BTC, "100" for 100 USDC)
}

export interface ChainflipFee {
  type: string;  // e.g., "ingress", "network", "broker", "liquidity", "egress", "boost"
  asset: ChainflipAssetId;
  amount: string;  // Fee amount in human-readable format
  amountNative: string;  // Fee amount in native units
}

export interface ChainflipBoostQuote {
  ingressAsset: ChainflipAssetId;
  ingressAmount: string;
  ingressAmountNative: string;
  egressAsset: ChainflipAssetId;
  egressAmount: string;
  egressAmountNative: string;
  includedFees: ChainflipFee[];
  estimatedDurationSeconds: number;
  estimatedDurationsSeconds?: {
    deposit: number;
    swap: number;
    egress: number;
  };
  estimatedBoostFeeBps: number;
  lowLiquidityWarning?: boolean;
}

export interface ChainflipQuote {
  type: 'regular' | 'dca';
  ingressAsset: ChainflipAssetId;
  ingressAmount: string;  // Input amount in human-readable format
  ingressAmountNative: string;  // Input amount in native units
  egressAsset: ChainflipAssetId;
  egressAmount: string;  // Output amount in human-readable format
  egressAmountNative: string;  // Output amount in native units
  includedFees: ChainflipFee[];  // Array of fees
  estimatedDurationSeconds: number;
  estimatedDurationsSeconds?: {
    deposit: number;
    swap: number;
    egress: number;
  };
  recommendedSlippageTolerancePercent?: number;
  lowLiquidityWarning?: boolean;
  boostQuote?: ChainflipBoostQuote;
}

/**
 * Response from /quotes endpoint
 * Returns an array of quote types (regular and/or DCA)
 */
export type ChainflipQuoteResponse = ChainflipQuote[];

// ═══════════════════════════════════════════════════════════════════════════════
// Swap Request/Response Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChainflipSwapRequest {
  sourceAsset: ChainflipAssetId;
  destinationAsset: ChainflipAssetId;
  destinationAddress: string;
  amount: string;  // Amount in human-readable format (e.g., "1" for 1 BTC, "100" for 100 USDC)
  refundAddress?: string;  // For refunds
  maxBoostFeeBps?: number;  // Max boost fee in basis points
  dcaEnabled?: boolean;  // Enable DCA (Dollar Cost Averaging)
}

export interface ChainflipDepositChannel {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface ChainflipSwapResponse {
  id: string;
  depositAddress: string;
  depositChannel: ChainflipDepositChannel;
  estimatedEgressAmount: string;  // Estimated output amount in human-readable format
  estimatedEgressAmountNative: string;  // Estimated output amount in native units
}

// ═══════════════════════════════════════════════════════════════════════════════
// Swap Status Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ChainflipSwapState =
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_RECEIVED'
  | 'SWAP_EXECUTING'
  | 'EGRESS_SCHEDULED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export interface ChainflipSwapStatus {
  state: ChainflipSwapState;
  sourceAsset: ChainflipAssetId;
  destinationAsset: ChainflipAssetId;
  depositAmount?: string;  // Deposit amount in human-readable format
  egressAmount?: string;  // Output amount in human-readable format
  txHash?: string;
  error?: string;
  refundTxHash?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Execution Stage Types (for UI)
// ═══════════════════════════════════════════════════════════════════════════════

export type ChainflipExecutionStage =
  | 'idle'
  | 'preparing'           // Getting deposit address from Chainflip
  | 'awaiting_signature'  // Waiting for user to sign transaction
  | 'submitting'          // Submitting transaction to source chain
  | 'confirming'          // Waiting for source chain confirmation
  | 'swap_executing'      // Chainflip processing the swap
  | 'completed'
  | 'failed';

// ═══════════════════════════════════════════════════════════════════════════════
// Token Info Extension for Chainflip
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChainflipTokenInfo {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  chainflipId: ChainflipAssetId;  // Compound ID like "dot.hub", "usdc.arb"
  icon: string;
  network: string;
  contractAddress?: string;
}
