# Chainflip Integration Plan

> **Status**: 📋 PLANNING  
> **Created**: November 25, 2025  
> **Target**: Enable cross-chain swaps with Solana, Arbitrum, Ethereum, and Bitcoin

---

## 📋 Executive Summary

This document outlines the integration of **Chainflip Protocol** alongside our existing XCM swap infrastructure (ParaSpell). Chainflip enables native cross-chain swaps between **Bitcoin, Ethereum, Solana, Arbitrum, and Polkadot** without wrapped tokens or bridges.

### Why Chainflip?

| Benefit | Description |
|---------|-------------|
| **Native cross-chain swaps** | No wrapped tokens or bridges needed |
| **Non-Polkadot chain support** | Solana, Arbitrum, Ethereum, Bitcoin |
| **Broker-as-a-Service** | No need to run infrastructure ([docs.chainflip.io](https://docs.chainflip.io/swapping/integrations/running-a-broker/broker-api)) |
| **Complementary to XCM** | XCM handles Polkadot ecosystem, Chainflip handles external chains |
| **One-click UX** | Deposit address handled programmatically - user signs once |

### References

- **Broker API Documentation**: https://chainflip-broker.io/docs/ui/index.html
- **Chainflip Docs**: https://docs.chainflip.io/
- **Supported Assets**: https://docs.chainflip.io/swapping/supported-chains-and-assets/supported-chains-and-assets

---

## 🔗 Supported Chains & Assets

### Chainflip Mainnet Support

| Chain | Assets | Chain ID / Namespace |
|-------|--------|---------------------|
| **Ethereum** | ETH, USDC, USDT, FLIP | `eip155:1` |
| **Arbitrum** | ETH, USDC | `eip155:42161` |
| **Solana** | SOL, USDC (SPL) | `solana:mainnet` |
| **Polkadot** | DOT | `polkadot:mainnet` |
| **Assethub** | DOT, USDC | `polkadot:assethub` |
| **Bitcoin** | BTC | `bitcoin:mainnet` |

### Testnet (Perseverance)

| Chain | Assets |
|-------|--------|
| **Sepolia** | ETH, USDC, USDT, FLIP |
| **Arbitrum Sepolia** | ETH, USDC |
| **Solana Devnet** | SOL, USDC |
| **Polkadot (Perseverance)** | pDOT |

---

## 🏗️ Architecture Overview

### Current Architecture (XCM Only)

```
┌─────────────────────────────────────────────────────────────┐
│                     SwapContainer                           │
├─────────────────────────────────────────────────────────────┤
│  useXcmTokens → useXcmRoute → useXcmSwapExecution          │
│                                                             │
│  Supports: Polkadot ecosystem only                         │
│  (Polkadot, AssetHub, Hydration, Moonbeam, Acala, Bifrost) │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture (Multi-Provider)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SwapContainer                            │
├─────────────────────────────────────────────────────────────────┤
│                      useSwapRouter (NEW)                        │
│         Automatically selects provider based on route           │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │   XCM Route Provider    │  │  Chainflip Route Provider   │  │
│  │   (Polkadot Ecosystem)  │  │  (External Chains)          │  │
│  │   ────────────────────  │  │  ────────────────────────── │  │
│  │   • ParaSpell Router    │  │  • Broker API               │  │
│  │   • useXcmRoute         │  │  • useChainflipRoute (NEW)  │  │
│  │   • useXcmSwapExecution │  │  • useChainflipExecution    │  │
│  │                         │  │                             │  │
│  │   Networks:             │  │   Networks:                 │  │
│  │   - Polkadot            │  │   - Ethereum                │  │
│  │   - AssetHubPolkadot    │  │   - Arbitrum                │  │
│  │   - Hydration           │  │   - Solana                  │  │
│  │   - Moonbeam            │  │   - Bitcoin                 │  │
│  │   - Acala               │  │   - Polkadot (cross-eco)    │  │
│  │   - BifrostPolkadot     │  │   - Assethub (cross-eco)    │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Selection Logic

```typescript
// Chainflip is used when:
// 1. Source OR destination is Ethereum, Arbitrum, Solana, or Bitcoin
// 2. Cross-ecosystem swaps (e.g., DOT <-> ETH, SOL <-> USDC on AssetHub)

const shouldUseChainflip = (sourceNetwork: string, destNetwork: string): boolean => {
  const polkadotEcosystem = ['Polkadot', 'AssetHubPolkadot', 'Hydration', 'Moonbeam', 'Acala', 'BifrostPolkadot'];
  const chainflipNetworks = ['Ethereum', 'Arbitrum', 'Solana', 'Bitcoin'];

  const isSourceChainflip = chainflipNetworks.includes(sourceNetwork);
  const isDestChainflip = chainflipNetworks.includes(destNetwork);

  return isSourceChainflip || isDestChainflip;
};
```

---

## 🔄 One-Click Swap Flow

### User Experience (Identical to XCM)

```
┌─────────────────────────────────────────────────────────────┐
│  1. User selects: SOL (Solana) → DOT (Polkadot)            │
│  2. User enters amount: 10 SOL                              │
│  3. User clicks "Swap"                                      │
│  4. Confirmation sheet shows:                               │
│     ┌─────────────────────────────────────────────────┐     │
│     │  You pay:      10 SOL                           │     │
│     │  You receive:  ~85.2 DOT                        │     │
│     │  Network fee:  $2.50                            │     │
│     │  Est. time:    3-5 min                          │     │
│     │  Provider:     Chainflip ←── NEW badge          │     │
│     │                                                 │     │
│     │  [Confirm Swap]                                 │     │
│     └─────────────────────────────────────────────────┘     │
│  5. User clicks "Confirm Swap"                              │
│  6. Wallet popup → User signs ONCE                          │
│  7. Progress dialog shows status updates                    │
│  8. Done! DOT arrives in wallet                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Flow (Behind the Scenes)

```
┌──────────────────────────────────────────────────────────────────┐
│                    ONE-CLICK CHAINFLIP FLOW                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: User clicks "Confirm Swap"                              │
│          │                                                       │
│          ▼                                                       │
│  STEP 2: Request deposit address from Chainflip Broker API       │
│          (automatic, ~500ms, no user interaction)                │
│          │                                                       │
│          │  POST /rpc                                            │
│          │  { method: "broker_requestSwapDepositAddress" }       │
│          │  Response: { depositAddress: "0x...", id: "swap123" } │
│          │                                                       │
│          ▼                                                       │
│  STEP 3: Build transaction to deposit address                    │
│          │                                                       │
│          │  Source Chain    │ Method                             │
│          │  ────────────────┼─────────────────────────────────── │
│          │  Ethereum/Arb    │ wagmi sendTransaction / writeContract│
│          │  Solana          │ @solana/wallet-adapter sendTx      │
│          │  Polkadot        │ polkadotSigner (Kheopskit)         │
│          │                                                       │
│          ▼                                                       │
│  STEP 4: Prompt wallet signature (SINGLE signature)              │
│          │                                                       │
│          │  ┌────────────────────────────────────┐               │
│          │  │  Wallet Popup                      │               │
│          │  │  ──────────────────────────────    │               │
│          │  │  Send 10 SOL to deposit address    │               │
│          │  │                                    │               │
│          │  │  [Confirm]  [Reject]               │               │
│          │  └────────────────────────────────────┘               │
│          │                                                       │
│          ▼                                                       │
│  STEP 5: Submit transaction to source chain                      │
│          │                                                       │
│          ▼                                                       │
│  STEP 6: Wait for source chain confirmation                      │
│          │                                                       │
│          ▼                                                       │
│  STEP 7: Poll Chainflip for swap status (every 5s)               │
│          │                                                       │
│          │  Status Flow:                                         │
│          │  AWAITING_DEPOSIT → DEPOSIT_RECEIVED →                │
│          │  SWAP_EXECUTING → COMPLETED                           │
│          │                                                       │
│          ▼                                                       │
│  STEP 8: Swap complete! Tokens arrive at destination wallet      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decision: Hidden Deposit Address

Unlike typical Chainflip integrations that show a QR code and deposit address for manual transfer, we **automate the deposit** using the connected wallet:

| Traditional Flow | Our One-Click Flow |
|------------------|-------------------|
| Show deposit address | Hide deposit address |
| Show QR code | No QR code needed |
| User manually sends | Auto-send via wallet |
| Multiple user actions | Single "Confirm" click |
| Separate waiting screen | Unified progress dialog |

---

## 📁 File Structure

```
apps/web/src/
├── services/
│   ├── chainflip/                        # NEW SERVICE
│   │   ├── index.ts                      # Exports
│   │   ├── config.ts                     # Configuration & constants
│   │   ├── types.ts                      # TypeScript interfaces
│   │   ├── client.ts                     # Broker API client
│   │   ├── assetRegistry.ts              # Chainflip asset definitions
│   │   └── __tests__/
│   │       └── client.test.ts            # Unit tests
│   │
│   └── xcm-router/                       # EXISTING (unchanged)
│       └── ...
│
├── components/
│   └── swap/
│       ├── hooks/
│       │   ├── useChainflipRoute.ts      # NEW - Quote fetching
│       │   ├── useChainflipExecution.ts  # NEW - Swap execution
│       │   ├── useSwapRouter.ts          # NEW - Unified router
│       │   ├── useUnifiedTokens.ts       # NEW - Combined token list
│       │   │
│       │   ├── useXcmRoute.ts            # EXISTING (unchanged)
│       │   ├── useXcmSwapExecution.ts    # EXISTING (unchanged)
│       │   └── useXcmTokens.ts           # EXISTING (unchanged)
│       │
│       ├── ui/
│       │   ├── SwapProviderBadge.tsx     # NEW - Shows "via Chainflip"
│       │   ├── ChainflipProgress.tsx     # NEW - Chainflip status steps
│       │   │
│       │   ├── SwapConfirmSheet.tsx      # UPDATE - Add provider info
│       │   ├── SwapCompleteDialog.tsx    # UPDATE - Handle both providers
│       │   └── ...
│       │
│       └── SwapContainer.tsx             # UPDATE - Use useSwapRouter
│
└── lib/
    └── config/
        ├── kheopskit.ts                  # UPDATE - Add Arbitrum network
        └── chainflip.ts                  # NEW - Chainflip config
```

---

## 📦 Implementation Phases

### Phase 1: Foundation & Configuration (~2-3 hours)

**Goal**: Set up Chainflip service infrastructure

| Task | File | Description |
|------|------|-------------|
| 1.1 | `services/chainflip/config.ts` | Chainflip constants, chain IDs, broker URL |
| 1.2 | `services/chainflip/types.ts` | TypeScript interfaces for API |
| 1.3 | `services/chainflip/assetRegistry.ts` | Chainflip-supported asset definitions |
| 1.4 | `lib/config/kheopskit.ts` | Add Arbitrum network definition |

**Deliverables**:
- [ ] Chainflip configuration module
- [ ] Type definitions for all API responses
- [ ] Asset registry with Ethereum, Arbitrum, Solana, Bitcoin assets
- [ ] Network configuration for Arbitrum

---

### Phase 2: Chainflip Service Layer (~3-4 hours)

**Goal**: Create Chainflip API client with full broker functionality

| Task | File | Description |
|------|------|-------------|
| 2.1 | `services/chainflip/client.ts` | Broker API client class |
| 2.2 | `services/chainflip/client.ts` | `getQuote()` method |
| 2.3 | `services/chainflip/client.ts` | `requestSwapDepositAddress()` method |
| 2.4 | `services/chainflip/client.ts` | `getSwapStatus()` method |
| 2.5 | `services/chainflip/__tests__/` | Unit tests |

**API Methods**:

```typescript
class ChainflipClient {
  // Get quote for a swap
  async getQuote(request: ChainflipQuoteRequest): Promise<ChainflipQuoteResponse>;
  
  // Request deposit address to initiate swap
  async requestSwapDepositAddress(request: ChainflipSwapRequest): Promise<ChainflipSwapResponse>;
  
  // Poll swap status
  async getSwapStatus(swapId: string): Promise<ChainflipSwapStatus>;
}
```

**Deliverables**:
- [ ] Working Chainflip API client
- [ ] Error handling with user-friendly messages
- [ ] Request/response logging for debugging
- [ ] Unit tests with mocked responses

---

### Phase 3: Chainflip Hooks (~4-5 hours)

**Goal**: Create React hooks for Chainflip integration

| Task | File | Description |
|------|------|-------------|
| 3.1 | `hooks/useChainflipRoute.ts` | Quote fetching with debounce |
| 3.2 | `hooks/useChainflipExecution.ts` | One-click swap execution |
| 3.3 | `hooks/useChainflipExecution.ts` | EVM transaction building (wagmi) |
| 3.4 | `hooks/useChainflipExecution.ts` | Status polling |

**useChainflipRoute Interface**:

```typescript
interface UseChainflipRouteReturn {
  outputAmount: string;
  estimatedFees: string;
  quote: ChainflipQuoteResponse | null;
  estimatedDuration: number; // seconds
  isLoadingQuote: boolean;
  error: string | null;
  fetchRoute: (inputAmount: string) => Promise<void>;
  resetRoute: () => void;
}
```

**useChainflipExecution Interface**:

```typescript
interface UseChainflipExecutionReturn {
  executeSwap: () => Promise<void>;
  stage: ChainflipSwapStage;
  statusMessage: string;
  swapId: string | null;
  txHash: string | null;
  error: string | null;
  reset: () => void;
  isExecuting: boolean;
}

type ChainflipSwapStage = 
  | 'idle'
  | 'preparing'           // Getting deposit address
  | 'awaiting_signature'  // Waiting for user to sign
  | 'submitting'          // Submitting to source chain
  | 'confirming'          // Waiting for source chain confirmation
  | 'swap_executing'      // Chainflip processing the swap
  | 'completed'
  | 'failed';
```

**Deliverables**:
- [ ] `useChainflipRoute` hook with debounced quote fetching
- [ ] `useChainflipExecution` hook with one-click flow
- [ ] EVM transaction support (ETH, ERC20)
- [ ] Proper cleanup and abort handling

---

### Phase 4: Unified Swap Router (~3-4 hours)

**Goal**: Create unified interface that auto-selects provider

| Task | File | Description |
|------|------|-------------|
| 4.1 | `hooks/useSwapRouter.ts` | Provider selection logic |
| 4.2 | `hooks/useSwapRouter.ts` | Unified route interface |
| 4.3 | `hooks/useUnifiedTokens.ts` | Combined token list (XCM + Chainflip) |
| 4.4 | `assetRegistry.ts` | Update `shouldUseChainflip()` logic |

**useSwapRouter Interface**:

```typescript
interface UseSwapRouterReturn {
  // Current provider
  provider: 'xcm' | 'chainflip';
  
  // Unified route data
  outputAmount: string;
  estimatedFees: string;
  isLoadingQuote: boolean;
  error: string | null;
  
  // Route functions
  fetchRoute: (amount: string) => Promise<void>;
  resetRoute: () => void;
  
  // Execution
  executeSwap: () => Promise<void>;
  isExecuting: boolean;
  executionStage: string;
  executionMessage: string;
}
```

**Deliverables**:
- [ ] `useSwapRouter` with automatic provider selection
- [ ] Unified interface for both XCM and Chainflip
- [ ] Combined token list supporting all networks
- [ ] Seamless provider switching

---

### Phase 5: UI Updates (~2-3 hours)

**Goal**: Update UI components for multi-provider support

| Task | File | Description |
|------|------|-------------|
| 5.1 | `ui/SwapProviderBadge.tsx` | "via Chainflip" / "via XCM" badge |
| 5.2 | `ui/ChainflipProgress.tsx` | Chainflip-specific progress steps |
| 5.3 | `ui/SwapConfirmSheet.tsx` | Add provider info, est. time |
| 5.4 | `ui/SwapCompleteDialog.tsx` | Handle both provider progress |
| 5.5 | `SwapContainer.tsx` | Integrate useSwapRouter |

**UI Changes**:

```tsx
// SwapConfirmSheet - Add provider badge
<div className="flex items-center gap-2">
  <span className="text-white/60">Route</span>
  <SwapProviderBadge provider={provider} />
</div>

// SwapCompleteDialog - Handle both providers
{provider === 'chainflip' ? (
  <ChainflipProgress stage={stage} message={message} />
) : (
  <XcmProgress step={currentStep} total={totalSteps} type={transactionType} />
)}
```

**Deliverables**:
- [ ] Provider badge component
- [ ] Chainflip progress component
- [ ] Updated confirmation sheet
- [ ] Updated completion dialog
- [ ] SwapContainer integration

---

### Phase 6: Wallet Integration (~2-3 hours)

**Goal**: Support all source chain wallets

| Task | File | Description |
|------|------|-------------|
| 6.1 | `package.json` | Add Solana wallet adapter deps |
| 6.2 | `hooks/useChainflipExecution.ts` | Solana transaction support |
| 6.3 | `hooks/useChainflipExecution.ts` | ERC20 approval handling |
| 6.4 | `lib/config/kheopskit.ts` | Solana wallet config |

**Wallet Support Matrix**:

| Source Chain | Wallet Solution | Package |
|--------------|-----------------|---------|
| Ethereum/Arbitrum | Wagmi + WalletConnect | `wagmi`, `@reown/appkit` |
| Polkadot | Kheopskit | `@kheopskit/core` |
| Solana | Solana Wallet Adapter | `@solana/wallet-adapter-react` |

**Deliverables**:
- [ ] Solana wallet integration
- [ ] ERC20 token approval flow
- [ ] Multi-chain wallet state management

---

### Phase 7: Testing & Polish (~3-4 hours)

**Goal**: Ensure reliability and production readiness

| Task | Description |
|------|-------------|
| 7.1 | Unit tests for Chainflip client |
| 7.2 | Integration tests with Perseverance testnet |
| 7.3 | E2E test: ETH → DOT swap |
| 7.4 | E2E test: SOL → USDC swap |
| 7.5 | Error handling edge cases |
| 7.6 | Loading states and animations |

**Deliverables**:
- [ ] Comprehensive test coverage
- [ ] Testnet validation
- [ ] Error handling for all failure modes
- [ ] Polished UI with proper loading states

---

## ⏱️ Timeline Summary

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| **Phase 1** | Foundation & Configuration | 2-3 hours |
| **Phase 2** | Chainflip Service Layer | 3-4 hours |
| **Phase 3** | Chainflip Hooks | 4-5 hours |
| **Phase 4** | Unified Swap Router | 3-4 hours |
| **Phase 5** | UI Updates | 2-3 hours |
| **Phase 6** | Wallet Integration | 2-3 hours |
| **Phase 7** | Testing & Polish | 3-4 hours |
| **Total** | | **~20-26 hours** |

---

## 🔧 Technical Details

### Chainflip Broker API

**Endpoint**: `https://chainflip-broker.io/rpc`

**Method: `broker_getQuote`**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "broker_getQuote",
  "params": {
    "src_chain": "Solana",
    "src_asset": "SOL",
    "dest_chain": "Polkadot",
    "dest_asset": "DOT",
    "amount": "10000000000"
  }
}
```

**Method: `broker_requestSwapDepositAddress`**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "broker_requestSwapDepositAddress",
  "params": {
    "src_chain": "Solana",
    "src_asset": "SOL",
    "dest_chain": "Polkadot",
    "dest_asset": "DOT",
    "dest_address": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
    "max_boost_fee_bps": 0
  }
}
```

**Method: `broker_getSwapStatus`**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "broker_getSwapStatus",
  "params": {
    "swap_id": "0x123..."
  }
}
```

### ERC20 Token Addresses

```typescript
const ERC20_ADDRESSES = {
  Ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    FLIP: '0x826180541412D574cf1336d22c0C0a287822678A',
  },
  Arbitrum: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
};
```

### Swap Status States

```typescript
type ChainflipSwapState = 
  | 'AWAITING_DEPOSIT'   // Deposit address created, waiting for funds
  | 'DEPOSIT_RECEIVED'   // Funds received, processing
  | 'SWAP_EXECUTING'     // Cross-chain swap in progress
  | 'COMPLETED'          // Success
  | 'FAILED';            // Failed with error
```

---

## ⚠️ Edge Cases & Error Handling

### Deposit Channel Expiration

Chainflip deposit addresses expire after ~24 hours. Handle gracefully:

```typescript
if (swapResponse.depositChannel.expiresAt < Date.now()) {
  throw new Error('Deposit channel expired. Please try again.');
}
```

### Insufficient Balance

Check balance before requesting deposit address:

```typescript
const balance = await getBalance(walletAddress, srcAsset);
if (BigInt(balance) < BigInt(amountInSmallestUnit)) {
  throw new Error(`Insufficient ${srcAsset.symbol} balance`);
}
```

### Transaction Rejection

Handle wallet rejection gracefully:

```typescript
try {
  const hash = await walletClient.sendTransaction({...});
} catch (err) {
  if (err.message.includes('rejected') || err.code === 4001) {
    // User rejected - reset to idle, don't show error
    reset();
    return;
  }
  throw err;
}
```

### Network Mismatch

Ensure wallet is on correct network before sending:

```typescript
const chainId = await walletClient.getChainId();
const expectedChainId = CHAIN_IDS[srcAsset.chainflipChain];
if (chainId !== expectedChainId) {
  await walletClient.switchChain({ id: expectedChainId });
}
```

---

## 📊 Comparison: XCM vs Chainflip

| Aspect | XCM (ParaSpell) | Chainflip |
|--------|-----------------|-----------|
| **User Actions** | Click Confirm → Sign | Click Confirm → Sign |
| **Signatures** | 1 | 1 |
| **Execution Time** | ~30 seconds | 2-10 minutes |
| **Networks** | Polkadot ecosystem | Cross-ecosystem |
| **Mechanism** | XCM messages | Deposit → Swap → Withdraw |
| **Trust Model** | Trustless (XCM) | Decentralized validators |

---

## 🎯 Success Criteria

- [ ] Users can swap from Solana/Arbitrum to Polkadot ecosystem
- [ ] One-click experience (single signature)
- [ ] Unified UI for both XCM and Chainflip swaps
- [ ] Clear progress indicators during swap
- [ ] Proper error handling and user feedback
- [ ] < 3 second quote fetching
- [ ] Testnet validation before mainnet

---

## 📝 Next Steps

1. **Review this plan** and confirm approach
2. **Set up Perseverance testnet** for development
3. **Start Phase 1** - Foundation & Configuration
4. **Implement incrementally** with testing at each phase

---

## 📚 References

- [Chainflip Documentation](https://docs.chainflip.io/)
- [Chainflip Broker API](https://chainflip-broker.io/docs/ui/index.html)
- [Supported Chains & Assets](https://docs.chainflip.io/swapping/supported-chains-and-assets/supported-chains-and-assets)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Wagmi Documentation](https://wagmi.sh/)

