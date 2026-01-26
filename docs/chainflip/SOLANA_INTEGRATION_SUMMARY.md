# Solana Wallet Integration Summary

## Overview

This document summarizes all changes made to integrate Solana wallet support into the Kheopskit SDK. The implementation follows the existing patterns used for Polkadot and Ethereum, providing a consistent API across all three platforms.

## Architecture Decisions

### Design Philosophy
- **Modular Approach**: Core SDK provides wallet connection and signing interfaces, while transaction building remains in the UI layer
- **Wallet Standard**: Uses `@wallet-standard/app` for wallet detection (similar to EIP-6963 for Ethereum)
- **Consistent Patterns**: Follows the same observable-based architecture as Polkadot/Ethereum implementations
- **Type Safety**: Full TypeScript support with proper type definitions

### Comparison with Other Platforms

| Platform | Wallet Detection | Signing Interface | Transaction Building |
|----------|-----------------|-------------------|---------------------|
| **Polkadot** | `getInjectedExtensions()` | `polkadotSigner` in core | `polkadot-api` in app |
| **Ethereum** | `mipd` (EIP-6963) | `WalletClient` in core | `viem` client in core |
| **Solana** | `@wallet-standard/app` | `signMessage`, `signTransaction*` in core | `@solana/kit` in app |

*Note: `signTransaction` and `signAndSendTransaction` are planned but not yet implemented*

---

## Files Created

### 1. Core Utilities

#### `packages/core/src/utils/isSolanaAddress.ts`
- **Purpose**: Validates Solana Base58 addresses
- **Implementation**: Uses `@solana/addresses` library
- **Exported**: Yes (via `utils/index.ts`)

```typescript
import { isAddress } from "@solana/addresses";

export const isSolanaAddress = (address: string): boolean => {
  try {
    return isAddress(address);
  } catch {
    return false;
  }
};
```

### 2. Solana API Implementation

#### `packages/core/src/api/solana/wallets.ts`
- **Purpose**: Detects and manages Solana wallets via Wallet Standard
- **Key Features**:
  - Detects injected wallets using `@wallet-standard/app`
  - Filters for Solana-compatible wallets using `isWalletAdapterCompatibleStandardWallet`
  - Manages connection state with RxJS `BehaviorSubject`
  - Supports `standard:connect` and `standard:disconnect` features
- **Exports**: `getSolanaWallets$()`

#### `packages/core/src/api/solana/accounts.ts`
- **Purpose**: Extracts accounts from connected Solana wallets
- **Key Features**:
  - Converts public key bytes to Base58 addresses
  - Subscribes to account changes via `standard:events` feature
  - Implements `signMessage` using `solana:signMessage` Wallet Standard feature
  - Caches account observables for performance
- **Exports**: `getSolanaAccounts$()`

#### `packages/core/src/api/solana/index.ts`
- **Purpose**: Barrel export file for Solana module
- **Exports**: All functions from `wallets.ts` and `accounts.ts`

---

## Files Modified

### 1. Type Definitions

#### `packages/core/src/api/types.ts`

**Added Types:**
```typescript
export type SolanaInjectedWallet = {
  id: WalletId;
  platform: "solana";
  type: "injected";
  wallet: WalletAdapterCompatibleStandardWallet;
  name: string;
  icon: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

export type SolanaWallet = SolanaInjectedWallet;

export type SolanaAccount = {
  id: WalletAccountId;
  platform: "solana";
  publicKey: Uint8Array;
  address: string;
  walletName: string;
  walletId: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};
```

**Updated Union Types:**
- `Wallet = PolkadotWallet | EthereumWallet | SolanaWallet`
- `WalletAccount = PolkadotAccount | EthereumAccount | SolanaAccount`
- `WalletPlatform = "polkadot" | "ethereum" | "solana"`

### 2. Platform Validators

#### `packages/core/src/utils/isWalletPlatform.ts`
- **Change**: Added `"solana"` to platforms array
```typescript
["polkadot", "ethereum", "solana"].includes(platform as WalletPlatform)
```

#### `packages/core/src/utils/isValidAddress.ts`
- **Change**: Added Solana address validation
```typescript
export const isValidAddress = (address: string): boolean => {
  if (address.startsWith("0x")) {
    return isEthereumAddress(address);
  }
  // Try SS58 (Polkadot) first, then Solana Base58
  return isSs58Address(address) || isSolanaAddress(address);
};
```

### 3. Main Aggregators

#### `packages/core/src/api/wallets.ts`
- **Change**: Added Solana case to platform switch
```typescript
case "solana":
  return getSolanaWallets$(config);
```

#### `packages/core/src/api/accounts.ts`
- **Change**: Added Solana case to platform switch
```typescript
case "solana":
  return getSolanaAccounts$(
    wallets.pipe(
      map((w) => w.filter((w) => w.platform === "solana")),
    ),
  );
```

### 4. Barrel Exports

#### `packages/core/src/utils/index.ts`
- **Change**: Added export for `isSolanaAddress`

### 5. Package Configuration

#### `packages/core/package.json`
- **Added Dependencies**:
  ```json
  {
    "@solana/addresses": "^2.0.0",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@wallet-standard/app": "^1.1.0",
    "@wallet-standard/base": "^1.1.0"
  }
  ```

### 6. Example Application

#### `examples/vite-react/src/app/blocks/Accounts.tsx`
- **Change**: Added Solana case to `SignButton` component
```typescript
case "solana": {
  try {
    const messageBytes = new TextEncoder().encode(MESSAGE);
    const signature = await account.signMessage(messageBytes);
    const hexSignature = Array.from(signature)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
    toast.success(`Signature: 0x${hexSignature}`);
  } catch (err) {
    toast.error(`Error: ${(err as Error).message}`);
  }
  break;
}
```

---

## Dependencies Added

### Production Dependencies
```json
{
  "@solana/addresses": "^2.0.0",           // Address validation
  "@solana/wallet-adapter-base": "^0.9.23", // Wallet adapter types
  "@wallet-standard/app": "^1.1.0",        // Wallet detection
  "@wallet-standard/base": "^1.1.0"        // Base wallet types
}
```

### Why These Libraries?

1. **`@solana/addresses`**: Modern, tree-shakable address validation (part of `@solana/kit` ecosystem)
2. **`@solana/wallet-adapter-base`**: Provides `WalletAdapterCompatibleStandardWallet` type and compatibility checker
3. **`@wallet-standard/app`**: Standard wallet detection mechanism (similar to EIP-6963 for Ethereum)
4. **`@wallet-standard/base`**: Base types for Wallet Standard protocol

---

## Implementation Details

### Wallet Detection Flow

1. **Initialization**: `getWallets()` from `@wallet-standard/app` detects available wallets
2. **Filtering**: Only wallets compatible with Solana adapter are included
3. **Observable Pattern**: Uses RxJS to emit wallet list updates
4. **Connection State**: Tracks connected wallets using `BehaviorSubject<Set<WalletId>>`

### Account Extraction Flow

1. **Account Mapping**: Converts `WalletAccount` from Wallet Standard to `SolanaAccount`
2. **Address Conversion**: Uses `getAddressEncoder()` to convert public key bytes to Base58
3. **Event Subscription**: Listens to `standard:events` for account changes
4. **Caching**: Uses `getCachedObservable$` to prevent duplicate subscriptions

### Message Signing Implementation

```typescript
signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
  // 1. Check wallet support
  if (!("solana:signMessage" in wallet.wallet.features)) {
    throw new Error("Wallet does not support message signing");
  }
  
  // 2. Get feature
  const signMessageFeature = wallet.wallet.features["solana:signMessage"];
  
  // 3. Call Wallet Standard API
  const results = await signMessageFeature.signMessage({
    account,
    message,
  });
  
  // 4. Validate and return
  return new Uint8Array(results[0].signature);
}
```

---

## Usage Examples

### Basic Setup

```typescript
import { KheopskitProvider } from "@kheopskit/react";

<KheopskitProvider 
  config={{ 
    platforms: ["polkadot", "ethereum", "solana"],
    autoReconnect: true,
    debug: false
  }}
>
  {children}
</KheopskitProvider>
```

### Accessing Solana Accounts

```typescript
import { useWallets } from "@kheopskit/react";

const { accounts } = useWallets();
const solanaAccounts = accounts.filter(a => a.platform === "solana");
```

### Signing Messages

```typescript
const account = accounts.find(a => a.platform === "solana");

if (account && account.platform === "solana") {
  const message = new TextEncoder().encode("Hello Solana!");
  const signature = await account.signMessage(message);
  console.log("Signature:", Array.from(signature));
}
```
