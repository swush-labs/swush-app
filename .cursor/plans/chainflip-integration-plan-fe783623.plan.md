<!-- fe2c56c3-95fd-49b9-952e-fc4c04180a99 bfa555f9-677b-4ce7-97e6-90efc71c650c -->
# Chainflip Integration Implementation Plan

## Overview

Extend the existing swap infrastructure to support Chainflip protocol for cross-chain swaps with Ethereum, Arbitrum, and Solana. Uses a **hybrid approach**: single unified asset registry with provider-aware aggregation. Leverages existing kheopskit wallet integration including the implemented Solana support.

## Architecture

```
ASSET_REGISTRY (unified)
├── XCM networks → Validate with ParaSpell → UnifiedAsset
└── Chainflip networks → Direct from registry → UnifiedAsset
         ↓
    useSwapRouter (new)
    ├── XCM path → useXcmRoute + useXcmSwapExecution (existing)
    └── Chainflip path → useChainflipRoute + useChainflipExecution (new)
```

## Prerequisites

**Kheopskit Update Required:** Update `@kheopskit/core` to version with Solana support (per [SOLANA_INTEGRATION_SUMMARY.md](docs/chainflip/SOLANA_INTEGRATION_SUMMARY.md)).

The Solana implementation provides:

- `SolanaAccount` type with `platform: "solana"`, `address`, `publicKey`, `signMessage()`
- Wallet detection via `@wallet-standard/app` (Phantom, Solflare, etc.)
- Consistent API: `accounts.filter(a => a.platform === "solana")`

---

## Phase 1: Foundation and Types

### 1.1 Extend Asset Registry Types

**File:** [apps/web/src/services/xcm-router/assetRegistry.ts](apps/web/src/services/xcm-router/assetRegistry.ts)

- Add `SwapProvider` type: `'xcm' | 'chainflip'`
- Add `CHAINFLIP_CHAINS` constant: `['Ethereum', 'Arbitrum', 'Solana', 'Polkadot', 'Bitcoin']`
- Add `POLKADOT_ECOSYSTEM_NETWORKS` array (existing XCM chains)
- Add `CHAINFLIP_NETWORKS` array: `['Ethereum', 'Arbitrum', 'Solana', 'Bitcoin']`
- Extend `AssetRegistryEntry.networkInstances` with:
  - `provider?: SwapProvider` (default: 'xcm')
  - `chainflipChain?: string`
  - `chainflipAsset?: string`
  - `decimals?: number`
  - `contractAddress?: string`
- Add `getSwapProvider(source, dest)` helper function

### 1.2 Extend TokenInfo Type

**File:** [apps/web/src/components/swap/types.ts](apps/web/src/components/swap/types.ts)

Add fields to `TokenInfo`:

- `provider?: SwapProvider`
- `chainflipChain?: string`
- `chainflipAsset?: string`
- `contractAddress?: string`

### 1.3 Add Chainflip Assets to Registry

**File:** [apps/web/src/services/xcm-router/assetRegistry.ts](apps/web/src/services/xcm-router/assetRegistry.ts)

Add Chainflip network instances:

- **USDC**: Add `USDC-Ethereum`, `USDC-Arbitrum`, `USDC-Solana` instances
- **DOT**: Add `DOT-Polkadot-CF` instance (Chainflip's Polkadot endpoint)
- **ETH**: New entry with `ETH-Ethereum`, `ETH-Arbitrum` instances
- **SOL**: New entry with `SOL-Solana` instance
- **USDT**: Add `USDT-Ethereum` instance

---

## Phase 2: Chainflip Service Layer

### 2.1 Create Chainflip Types

**New File:** `apps/web/src/services/chainflip/types.ts`

```typescript
export interface ChainflipQuoteRequest {
  srcChain: string;
  srcAsset: string;
  destChain: string;
  destAsset: string;
  amount: string;
}

export interface ChainflipQuoteResponse {
  id: string;
  inputAmount: string;
  outputAmount: string;
  rate: string;
  fees: { networkFee: string; brokerFee: string; liquidityFee: string };
  estimatedDurationSeconds: number;
}

export interface ChainflipSwapRequest {
  srcChain: string;
  srcAsset: string;
  destChain: string;
  destAsset: string;
  destAddress: string;
  amount: string;
}

export interface ChainflipSwapResponse {
  id: string;
  depositAddress: string;
  depositChannel: { id: string; expiresAt: string };
  estimatedOutputAmount: string;
}

export type ChainflipSwapState = 
  | 'AWAITING_DEPOSIT' | 'DEPOSIT_RECEIVED' 
  | 'SWAP_EXECUTING' | 'COMPLETED' | 'FAILED';
```

### 2.2 Create Chainflip API Client

**New File:** `apps/web/src/services/chainflip/client.ts`

Implement JSON-RPC client for `https://chainflip-broker.io/rpc`:

- `getQuote(request)` - calls `broker_getQuote`
- `requestSwapDepositAddress(request)` - calls `broker_requestSwapDepositAddress`
- `getSwapStatus(swapId)` - calls `broker_getSwapStatus`

### 2.3 Create Service Index

**New File:** `apps/web/src/services/chainflip/index.ts`

Export all types and client.

---

## Phase 3: Modify Asset Aggregator

### 3.1 Update UnifiedAsset Type

**File:** [apps/web/src/services/xcm-router/useAssetAggregator.ts](apps/web/src/services/xcm-router/useAssetAggregator.ts)

Extend `supportedNetworks` items:

- `provider: SwapProvider`
- `chainflipChain?: string`
- `chainflipAsset?: string`
- `decimals: number`
- `contractAddress?: string`
- Make `actualAsset: TAssetInfo | null` (null for Chainflip)

### 3.2 Modify Aggregation Logic

**File:** [apps/web/src/services/xcm-router/useAssetAggregator.ts](apps/web/src/services/xcm-router/useAssetAggregator.ts)

In `unifiedFromAssets` and `unifiedToAssets` memos, add provider check:

```typescript
const provider = networkInstance.provider || 'xcm';

if (provider === 'xcm') {
  // Existing: Validate against ParaSpell currencyFromMap
  const actualAsset = currencyFromMap[key];
  if (actualAsset) { /* add to supportedNetworks */ }
} else if (provider === 'chainflip') {
  // NEW: Add directly from registry (no ParaSpell validation)
  supportedNetworks.push({
    ...networkInstance,
    actualAsset: null,
    provider: 'chainflip',
  });
}
```

---

## Phase 4: Chainflip Hooks

### 4.1 Create useChainflipRoute Hook

**New File:** `apps/web/src/components/swap/hooks/useChainflipRoute.ts`

- Accept `inputToken`, `outputToken`, `walletAddress`
- Extract `chainflipChain`/`chainflipAsset` from tokens
- Call `chainflipClient.getQuote()`
- Return: `outputAmount`, `estimatedFees`, `estimatedDuration`, `quote`, `isLoadingQuote`, `error`

### 4.2 Create useChainflipExecution Hook

**New File:** `apps/web/src/components/swap/hooks/useChainflipExecution.ts`

One-click flow:

1. `chainflipClient.requestSwapDepositAddress()` - get deposit address
2. Build and send transaction to deposit address:

   - **EVM** (Ethereum/Arbitrum): Use `account.client` from kheopskit for `sendTransaction`
   - **Solana**: Use kheopskit's `SolanaAccount` - build tx with `@solana/kit`, sign with `signAndSendTransaction` (when available) or manual flow

3. Wait for source chain confirmation
4. Poll `chainflipClient.getSwapStatus()` until complete

Stages: `idle` -> `preparing` -> `awaiting_signature` -> `submitting` -> `confirming` -> `swap_executing` -> `completed` | `failed`

---

## Phase 5: Unified Swap Router

### 5.1 Create useSwapRouter Hook

**New File:** `apps/web/src/components/swap/hooks/useSwapRouter.ts`

```typescript
export function useSwapRouter({ inputToken, outputToken, ... }) {
  const provider = getSwapProvider(inputToken?.network, outputToken?.network);
  
  const xcmRoute = useXcmRoute({ ... });
  const chainflipRoute = useChainflipRoute({ ... });
  
  // Return unified interface based on provider
  return {
    provider,
    outputAmount: provider === 'chainflip' ? chainflipRoute.outputAmount : xcmRoute.outputAmount,
    estimatedFees: ...,
    isLoadingQuote: ...,
    fetchRoute: ...,
    resetRoute: ...,
  };
}
```

---

## Phase 6: Wallet Integration

### 6.1 Update Kheopskit Dependency

**File:** [apps/web/package.json](apps/web/package.json)

Update `@kheopskit/core` to version with Solana support.

### 6.2 Update Kheopskit Config

**File:** [apps/web/src/lib/config/kheopskit.ts](apps/web/src/lib/config/kheopskit.ts)

- Add `"solana"` to `platforms` array
- Add Arbitrum network to `APPKIT_CHAINS`

### 6.3 Update Account Interface

**File:** [apps/web/src/components/wallet/use-selected-account.ts](apps/web/src/components/wallet/use-selected-account.ts)

Extend `KheopskitAccount` interface:

```typescript
interface KheopskitAccount {
  platform: "polkadot" | "ethereum" | "solana";
  // Solana accounts have signMessage from kheopskit
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  // ... existing fields
}
```

### 6.4 Create Chainflip Signer Utility

**New File:** `apps/web/src/services/chainflip/signerUtils.ts`

Helper to build and send transactions for Chainflip deposits:

- `sendEvmDeposit(client, depositAddress, amount, tokenContract?)` - for ETH/Arbitrum
- `sendSolanaDeposit(account, depositAddress, amount)` - for Solana (using @solana/kit)

---

## Phase 7: UI Updates

### 7.1 Update SwapContainer

**File:** [apps/web/src/components/swap/SwapContainer.tsx](apps/web/src/components/swap/SwapContainer.tsx)

- Replace `useXcmRoute` with `useSwapRouter`
- Add provider badge: "via XCM Router" or "via Chainflip"
- Route to appropriate execution hook based on `provider`
- Handle Solana account selection for Chainflip swaps

### 7.2 Update SwapCompleteDialog

**File:** [apps/web/src/components/swap/ui/SwapCompleteDialog.tsx](apps/web/src/components/swap/ui/SwapCompleteDialog.tsx)

- Add Chainflip stages to progress display
- Show estimated time (2-10 min for Chainflip vs ~30s for XCM)

### 7.3 Update Token Conversion

**File:** [apps/web/src/components/swap/hooks/useXcmTokens.ts](apps/web/src/components/swap/hooks/useXcmTokens.ts)

Pass through Chainflip fields when converting `UnifiedAsset` to `TokenInfo`.

---

## File Structure Summary

```
apps/web/src/
├── services/
│   ├── chainflip/                    (NEW)
│   │   ├── types.ts
│   │   ├── client.ts
│   │   ├── signerUtils.ts
│   │   └── index.ts
│   └── xcm-router/
│       ├── assetRegistry.ts          (MODIFIED)
│       └── useAssetAggregator.ts     (MODIFIED)
├── components/
│   ├── swap/
│   │   ├── hooks/
│   │   │   ├── useChainflipRoute.ts      (NEW)
│   │   │   ├── useChainflipExecution.ts  (NEW)
│   │   │   ├── useSwapRouter.ts          (NEW)
│   │   │   └── useXcmTokens.ts           (MODIFIED)
│   │   ├── ui/
│   │   │   └── SwapCompleteDialog.tsx    (MODIFIED)
│   │   ├── types.ts                      (MODIFIED)
│   │   └── SwapContainer.tsx             (MODIFIED)
│   └── wallet/
│       └── use-selected-account.ts       (MODIFIED)
└── lib/config/
    └── kheopskit.ts                      (MODIFIED)
```

---

## Estimated Timeline

| Phase | Description | Estimate |

|-------|-------------|----------|

| Phase 1 | Foundation and Types | 1-2 hours |

| Phase 2 | Chainflip Service Layer | 2-3 hours |

| Phase 3 | Modify Asset Aggregator | 1-2 hours |

| Phase 4 | Chainflip Hooks | 3-4 hours |

| Phase 5 | Unified Swap Router | 1-2 hours |

| Phase 6 | Wallet Integration | 1-2 hours |

| Phase 7 | UI Updates | 2-3 hours |

| **Total** | | **11-18 hours** |

---

## Dependencies

- `@kheopskit/core` with Solana support (signMessage implemented, signAndSendTransaction planned)
- `@solana/kit` for Solana transaction building in app layer
- Chainflip broker API access (mainnet: `https://chainflip-broker.io/rpc`)

### To-dos

- [ ] Phase 1: Extend asset registry types and add Chainflip assets
- [ ] Phase 2: Create Chainflip service layer (types, client, API)
- [ ] Phase 3: Modify useAssetAggregator for dual-provider support
- [ ] Phase 4: Create useChainflipRoute and useChainflipExecution hooks
- [ ] Phase 5: Create unified useSwapRouter hook
- [ ] Phase 6: Update kheopskit config and wallet integration
- [ ] Phase 7: Update SwapContainer and UI components
- [ ] Phase 1: Extend asset registry types and add Chainflip assets
- [ ] Phase 2: Create Chainflip service layer (types, client, API)
- [ ] Phase 3: Modify useAssetAggregator for dual-provider support
- [ ] Phase 4: Create useChainflipRoute and useChainflipExecution hooks
- [ ] Phase 5: Create unified useSwapRouter hook
- [ ] Phase 6: Update kheopskit config and wallet integration
- [ ] Phase 7: Update SwapContainer and UI components