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
