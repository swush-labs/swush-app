export type StepStatus = 'waiting' | 'pending' | 'loading' | 'completed' | 'failed';

export interface SigningStep {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  needsSignature: boolean;
}

export interface SwapHistoryItem {
  id: number;
  type: 'success' | 'error';
  message: string;
  timestamp: Date;
}

import type { SwapProvider } from '@/services/xcm-router/assetRegistry';

export interface TokenInfo {
  id: string;              // Asset key (e.g., "USDC-1984") - used for ParaSpell integration
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  network?: string;        // Network/chain name (e.g., "AssetHubPolkadot")
  assetKey?: string;       // Explicit asset key for XCM operations
  networkChain?: string;   // Explicit network chain for XCM operations
  // Chainflip-specific fields
  provider?: SwapProvider;        // 'xcm' (default) or 'chainflip'
  chainflipId?: string;           // Chainflip compound asset ID (e.g., "dot.hub", "usdc.arb")
  contractAddress?: string;       // ERC20/SPL contract address
  assetId?: string;               // Polkadot asset ID for Assets pallet (e.g., "1337" for USDC on AssetHub)
  // EVM chain identification
  chainId?: number;               // EVM chain ID (e.g., 1 for Ethereum, 11155111 for Sepolia, 42161 for Arbitrum)
  // Price data
  usdPrice?: number;              // Current USD price per token
}

// Group of the same asset symbol across multiple networks
export interface AssetGroup {
  symbol: string;
  name: string;
  icon: string;
  network: string;
  tokens: TokenInfo[];
}

export interface DetailedRouteInfo {
  route: {
    path: string;
    details: string;
  };
}

export interface AssetListProps {
  assetGroups: AssetGroup[];
  onSelect: (asset: TokenInfo) => void;
  currentAsset?: TokenInfo | null;
  onClose: () => void;
}

export interface TokenButtonProps {
  token: string;
  symbol: string;
  icon: React.ReactNode;
  network: string;
  onClick: () => void;
}

export interface WalletMenuProps {
  address: string;
  onDisconnect: () => void;
  className?: string;
}

export interface WalletButtonProps {
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setWalletAddress: (value: string) => void;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onWalletModalClose?: () => void;
}

export interface SwapFieldProps {
  type: 'input' | 'output';
  token?: TokenInfo | null;
  amount: string;
  balance: string;
  onTokenSelect: (token: TokenInfo) => void;
  onAmountChange?: (value: string) => void;
  openDialog: boolean;
  setOpenDialog: (value: boolean) => void;
  availableTokens: TokenInfo[];
  percentageOptions?: Array<{ label: string; value: number }>;
  onPercentageSelect?: (value: number) => void;
  isLoading?: boolean;
  balancesLoaded?: boolean;
  isConnected?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  onConnectWalletClick?: () => void
  onSelectRecipientClick?: () => void
  recipientAddress?: string // Address of the recipient (for output field)
  isCustomRecipient?: boolean // Whether recipient is different from sender
  // Price display
  formatUSD?: (amount: string, symbol: string, decimals: number) => string; // Function to format USD value
}

export interface XcmSwapPreviewData {
  inputAmount: string;
  inputToken: string;
  outputAmount: string;
  outputToken: string;
  sourceChain: string;
  destinationChain: string;
  priceImpact: string;
  slippageTolerance: string;
  networkFee: string;
  simulationSuccess: boolean;
  simulationWarning?: string;
}

export interface XcmSwapFailureData {
  inputAmount: string;
  inputToken: string;
  sourceChain: string;
  destinationChain: string;
  suggestedSlippage: string;
  estimatedOutput: string;
  outputToken: string;
  refundFee: string;
}

export type XcmSwapStatus = 'idle' | 'previewing' | 'swapping' | 'failed' | 'succeeded' | 'refunding'; 