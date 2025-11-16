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

export interface TokenInfo {
  id: string;              // Asset key (e.g., "USDC-1984") - used for ParaSpell integration
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  network?: string;        // Network/chain name (e.g., "AssetHubPolkadot")
  assetKey?: string;       // Explicit asset key for XCM operations
  networkChain?: string;   // Explicit network chain for XCM operations
}

// Extended token information that can optionally include a network/chain label
// Note: NetworkTokenInfo is now equivalent to TokenInfo since network was added to TokenInfo
export interface NetworkTokenInfo extends TokenInfo {}

// Group of the same asset symbol across multiple networks
export interface AssetGroup {
  symbol: string;
  name: string;
  icon: string;
  network: string;
  tokens: NetworkTokenInfo[];
}

export interface DetailedRouteInfo {
  route: {
    path: string;
    details: string;
  };
}

export interface AssetListProps {
  assetGroups: AssetGroup[];
  onSelect: (asset: NetworkTokenInfo) => void;
  currentAsset?: NetworkTokenInfo | null;
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