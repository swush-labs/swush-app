import { AssetWithId, RouteQuote } from '@/lib/api';
import { TokenInfo } from '@/components/swap/types';
import { SwushError } from '@/services/TransactionErrorService';
import { TransactionStatus } from '@/services/types';
import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';

export interface UseAssetConversionSwapProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress: string;
  slippageTolerance: number;
  inputAmount: string;
  outputAmount: string;
  routeState: {
    isLoading: boolean;
    error: string | null;
    data: RouteQuote | null;
  };
  onSuccess?: () => void;
  onError?: (error: SwushError) => void;
  onSimulationComplete?: (result: SimulationResult) => Promise<boolean>;
  onBalanceUpdateNeeded?: (txHash?: string) => void;
}

export interface SimulationResult {
  success: boolean;
  estimatedFee: string;
  willSucceed: boolean;
  error?: string;
}

export interface SwapState {
  isSwapping: boolean;
  swapHash: string | null;
  swapStatus: string | null;
  swapError: SwushError | null;
  isFinalized: boolean;
}

export interface XcmFees {
  initialExecution: bigint;
  initialDelivery: bigint;
  hydradxExecution: bigint;
  returnDelivery: bigint;
  finalExecution: bigint;
}

export type AssetHubApi = TypedApi<typeof polkadot_asset_hub>;

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: Error;
  status?: TransactionStatus;
}

export interface AssetsMap extends Map<string, AssetWithId> {} 