# 🔗 Wallet Integration Documentation

## Overview

This project uses **Kheopskit** for unified wallet management across Polkadot and Ethereum platforms. The implementation provides a seamless wallet connection and account selection experience integrated directly into the swap UI.

## Architecture

### Provider Setup
```typescript
// providers/wallet-provider.tsx
<ThemeProvider>
  <KheopskitClientProvider>
    {children}
  </KheopskitClientProvider>
</ThemeProvider>
```

Account selection uses a localStorage-based hook with cross-component synchronization via custom events, ensuring real-time updates across all components.

### Configuration Files
- `lib/config/kheopskit.ts` - Main Kheopskit configuration
- `lib/config/wagmi.ts` - Wagmi configuration for Ethereum chains

## Core Components

### 1. Connect Wallet Dialog (Swap UI Integration)
**File:** `components/swap/ui/ConnectWalletDialog.tsx`

**Features:**
- Two-view system: Wallet selection → Account selection
- Auto-transitions between views after wallet connection
- Shows account count per connected wallet
- Click connected wallets to view their accounts
- Integrated with global account selection hook

**Usage:**
```tsx
import ConnectWalletDialog from "@/components/swap/ui/ConnectWalletDialog";

<ConnectWalletDialog 
  isOpen={isOpen} 
  onOpenChange={setIsOpen} 
/>
```

### 2. Swap Field with Account Display
**File:** `components/swap/ui/SwapField.tsx`

**Features:**
- Shows "Connect Wallet" button when disconnected
- Displays shortened address with checkmark when connected
- Clickable address badge to change wallet/account
- No balance display (removed as per requirements)

### 3. Select Recipient Dialog
**File:** `components/swap/ui/SelectRecipientDialog.tsx`

**Features:**
- Shows connected account with avatar and details
- Option to connect wallet if not connected
- Custom recipient address input

## Account Selection Hook

### Using the Global Selected Account Hook
```tsx
import { useSelectedAccount } from "@/components/wallet/use-selected-account";

function MyComponent() {
  const { 
    selectedAccount,      // Current selected account object
    setSelectedAccount,   // Function to select an account
    clearSelection,       // Function to clear selection
    isLoading            // Hook initialization state
  } = useSelectedAccount();
  
  // selectedAccount contains: id, address, name, platform, walletName, polkadotSigner, client
}
```

### Platform-Specific Helpers
```tsx
import { 
  useSelectedPolkadotAccount,
  useSelectedEthereumAccount 
} from "@/components/wallet/use-selected-account";

// Get only if Polkadot account is selected
const polkadotAccount = useSelectedPolkadotAccount();

// Get only if Ethereum account is selected
const ethereumAccount = useSelectedEthereumAccount();
```

### Key Features
- **Persistent**: Survives page refreshes via localStorage
- **Synchronized**: Updates instantly across all components using custom events
- **Auto-cleanup**: Validates and clears invalid selections
- **Auto-select**: Automatically selects if only one account available

### Account Object Structure
```typescript
interface KheopskitAccount {
  id: string;
  address: string;
  name?: string;
  platform: "polkadot" | "ethereum";
  walletName: string;
  polkadotSigner?: any;  // For signing Polkadot transactions
  client?: any;          // For Ethereum operations
}
```

## Implementation in Swap Container

```tsx
// SwapContainer.tsx
import { useSelectedAccount } from '@/components/wallet/use-selected-account';

export function SwapContainer() {
  const { selectedAccount } = useSelectedAccount();
  const isConnected = !!selectedAccount;
  const walletAddress = selectedAccount?.address || '';
  
  // Use walletAddress for balance queries, transactions, etc.
}
```

## Key Files

```
components/swap/ui/
├── ConnectWalletDialog.tsx      # Main wallet + account selection modal
├── SwapField.tsx                # Shows wallet connection status
└── SelectRecipientDialog.tsx    # Recipient selection with account display

components/wallet/
└── use-selected-account.ts      # Global account selection hook with sync

lib/config/
├── kheopskit.ts                 # Kheopskit configuration
└── wagmi.ts                     # Ethereum chains configuration

providers/
├── kheopskit-provider.tsx       # Core Kheopskit provider
├── kheopskit-client-provider.tsx
└── wallet-provider.tsx          # Combined providers
```

## User Flow

1. User clicks "Connect Wallet" in swap interface
2. ConnectWalletDialog opens showing available wallets
3. User connects a wallet (e.g., Talisman, SubWallet, MetaMask)
4. Dialog auto-switches to account selection view
5. User selects an account
6. Selected account address appears in swap field
7. Clicking the address reopens dialog to change wallet/account
8. Selection persists across page refreshes and updates instantly in all components

## Independent Source/Receiver Wallet Management

### Overview

Source (sender) and receiver (destination) wallets are now **completely independent**. Changing the source wallet does not automatically update the receiver wallet, providing better UX and flexibility for cross-platform swaps.

### Key Changes

#### 1. Platform Detection Utility

**File:** `services/xcm-router/assetRegistry.ts`

Added `getNetworkPlatform()` function to determine which wallet platform a network requires:

```typescript
export type WalletPlatform = 'polkadot' | 'ethereum' | 'solana';

export function getNetworkPlatform(network: string | undefined): WalletPlatform {
  // Returns 'ethereum' for pure EVM chains (Ethereum, Sepolia, Arbitrum)
  // Returns 'solana' for Solana chains
  // Returns 'polkadot' for Polkadot ecosystem (including Moonbeam/Astar)
}
```

This utility enables future wallet-network compatibility checks and smart wallet retention within platform families.

#### 2. Independent Recipient Hook

**File:** `components/wallet/use-recipient-account.ts`

**Before:** Recipient hook automatically fell back to sender account when no explicit recipient was set.

**After:** Recipient hook is completely independent:
- Returns `null` when no explicit recipient is set (no fallback to sender)
- Removed dependency on `useSelectedAccount` (sender)
- `recipientAccount` and `recipientAddress` are stored independently in localStorage
- Added `hasSavedRecipient` flag to indicate when user has explicitly set a recipient

**Key Behavior:**
- Source wallet changes do NOT affect receiver wallet
- Receiver wallet persists independently across page refreshes
- When no explicit receiver is set, `recipientAddress` returns empty string

#### 3. Effective Recipient Address in SwapContainer

**File:** `components/swap/SwapContainer.tsx`

Added `effectiveRecipientAddress` that falls back to sender address for transactions:

```typescript
// Derive effective recipient address for transactions
// Falls back to sender address when no explicit recipient is set (self-transfer)
const effectiveRecipientAddress = recipientAddress || walletAddress
```

**Transaction Flow:**
- If user has explicitly set a recipient → use that address
- If no explicit recipient → use sender's address (self-transfer)
- All swap execution hooks (`useSwapRouter`, `useUnifiedBalances`, `useUnifiedSwapExecution`) use `effectiveRecipientAddress`

**UI Display:**
- Shows recipient address only when `hasSavedRecipient` is true
- Displays "Saved" badge in recipient dialog when recipient is explicitly set
- "Reset to sender" button clears explicit recipient selection

### Benefits

1. **Better UX**: Users can independently manage source and destination wallets
2. **Cross-platform flexibility**: Source and destination can be different wallet types (e.g., Polkadot → Ethereum)
3. **Persistent state**: Both wallet selections persist independently across page refreshes
4. **Self-transfer by default**: When no explicit recipient is set, transactions default to sender's address (same-wallet transfer)

#### 4. Auto-Clear Wallet on Platform Mismatch

**File:** `components/swap/SwapContainer.tsx`

When the user selects a token on a network that requires a different wallet platform, the incompatible wallet is automatically cleared:

```typescript
// Clear source wallet when switching to a network that requires a different platform
useEffect(() => {
  if (!selectedAccount || !inputToken?.network) return
  
  const requiredPlatform = getNetworkPlatform(inputToken.network)
  const currentPlatform = selectedAccount.platform
  
  // If platform doesn't match, clear the wallet selection
  if (requiredPlatform !== currentPlatform) {
    clearSelection()
  }
}, [inputToken?.network, selectedAccount, clearSelection])
```

**Examples:**
- User has Polkadot wallet connected → Selects ETH on Sepolia → Polkadot wallet is cleared
- User has MetaMask connected → Selects DOT on AssetHub → MetaMask wallet is cleared
- User has Polkadot wallet connected → Switches from DOT to USDC on AssetHub → Wallet stays (same platform)

### Migration Notes

- Existing users with saved recipient selections will continue to work
- New users will see self-transfer behavior until they explicitly set a recipient
- The `isDifferentFromSender` check is now computed in `SwapContainer` rather than the hook
- Wallets are now automatically cleared when switching to incompatible networks

### Platform Mapping

| Network | Required Platform |
|---------|------------------|
| Polkadot, AssetHubPolkadot, Hydration, Moonbeam, Acala, etc. | `polkadot` |
| Ethereum, Sepolia, Arbitrum, Arbitrum Sepolia | `ethereum` |
| Solana, SolanaDevnet | `solana` |
