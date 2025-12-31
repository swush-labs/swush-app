/**
 * Chainflip Service Module
 * 
 * Exports types and client for Chainflip protocol integration
 */

// Types
export type {
  ChainflipAssetId,
  ChainflipQuoteRequest,
  ChainflipQuote,
  ChainflipQuoteResponse,
  ChainflipFee,
  ChainflipBoostQuote,
  ChainflipSwapRequest,
  ChainflipSwapResponse,
  ChainflipDepositChannel,
  ChainflipSwapStatus,
  ChainflipSwapState,
  ChainflipExecutionStage,
  ChainflipTokenInfo,
} from './types';

// Client
export {
  ChainflipClient,
  chainflipClient,
  toSmallestUnit,
  fromSmallestUnit,
  formatDuration,
  calculateMinimumPrice,
  minutesToBlocks,
} from './client';

// Signer Utilities
export {
  sendEvmNativeDeposit,
  sendEvmTokenDeposit,
  sendSolanaDeposit,
  sendSolanaTokenDeposit,
  sendPolkadotDeposit,
  getDepositType,
  isChainSupportedForDeposit,
  type DepositResult,
} from './signerUtils';

