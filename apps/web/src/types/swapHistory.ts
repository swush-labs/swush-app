/**
 * Shared types for swap history (client and server)
 * This file contains ONLY types - no implementation or database imports
 */

export type SwapProvider = 'xcm' | 'chainflip';

export type SwapStatus = 'success' | 'failed';

export interface SwapHistory {
  id: string;
  userWallet: string;
  fromAsset: string;
  toAsset: string;
  inputAmount: string;
  outputAmount: string | null;
  chainFrom: string;
  chainTo: string;
  provider: SwapProvider;
  routeSummary: string;
  status: SwapStatus;
  durationMs: number | null;
  txHash: string | null;
  pointsEarned: number;
  createdAt: Date;
}

export interface RecordSwapParams {
  walletAddress: string;
  fromAsset: string;
  toAsset: string;
  inputAmount: string;
  outputAmount?: string;
  chainFrom: string;
  chainTo: string;
  provider: SwapProvider;
  routeSummary: string;
  status: SwapStatus;
  durationMs?: number;
  txHash?: string;
  pointsEarned: number;
}
