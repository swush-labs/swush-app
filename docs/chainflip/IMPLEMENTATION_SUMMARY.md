# Chainflip Integration Implementation Summary

## Overview

This document summarizes the Chainflip BaaS (Broker as a Service) integration implemented in the Swush swap application. The integration enables cross-chain swaps between Polkadot ecosystem chains and external chains (Ethereum, Arbitrum, Solana, Bitcoin) via Chainflip's REST API.

**Status**: ✅ Core implementation complete, but needs API endpoint fixes (see Issues section)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SwapContainer (UI)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         useSwapRouter (Unified Router)                │   │
│  │  ┌──────────────┐          ┌──────────────────┐     │   │
│  │  │ useXcmRoute  │          │ useChainflipRoute │     │   │
│  │  └──────────────┘          └──────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Execution Hooks                               │   │
│  │  ┌──────────────┐          ┌──────────────────┐     │   │
│  │  │ useXcmSwap   │          │ useChainflipExec  │     │   │
│  │  │ Execution    │          │                   │     │   │
│  │  └──────────────┘          └──────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Chainflip Service Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   client.ts  │  │   types.ts   │  │ signerUtils  │      │
│  │  (REST API)  │  │  (TypeDefs)  │  │  (Tx Helpers)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              https://chainflip-broker.io
```

---

## Files Created/Modified

### ✅ New Files Created

#### Service Layer
1. **`apps/web/src/services/chainflip/types.ts`** (160 lines)
   - Type definitions for Chainflip BaaS REST API
   - `ChainflipAssetId` (compound format: `"dot.hub"`, `"usdc.arb"`)
   - `ChainflipQuote`, `ChainflipQuoteResponse` (array of regular/DCA quotes)
   - `ChainflipSwapRequest`, `ChainflipSwapResponse`
   - `ChainflipSwapStatus`, `ChainflipExecutionStage`

2. **`apps/web/src/services/chainflip/client.ts`** (242 lines)
   - REST API client (NOT JSON-RPC - corrected from original plan)
   - Methods:
     - `getQuote()` → `GET /quotes?sourceAsset=...&destinationAsset=...&amount=...`
     - `requestSwapDepositAddress()` → `POST /swap`
     - `getSwapStatus()` → `GET /swap/{swapId}`
   - API key authentication via query parameter (`?apikey=...`)
   - Helper functions: `toSmallestUnit()`, `fromSmallestUnit()`, `formatDuration()`

3. **`apps/web/src/services/chainflip/signerUtils.ts`** (270 lines)
   - Transaction building utilities for Chainflip deposits
   - `sendEvmNativeDeposit()` - Send native ETH/ARB
   - `sendEvmTokenDeposit()` - Send ERC20 tokens
   - `sendSolanaDeposit()` - Placeholder (requires @solana/kit)
   - `sendSolanaTokenDeposit()` - Placeholder

4. **`apps/web/src/services/chainflip/index.ts`** (44 lines)
   - Service module exports

#### React Hooks
5. **`apps/web/src/components/swap/hooks/useChainflipRoute.ts`** (321 lines)
   - Quote fetching hook for Chainflip swaps
   - Debounced API calls
   - Fee calculation and formatting
   - Estimated duration display

6. **`apps/web/src/components/swap/hooks/useChainflipExecution.ts`** (388 lines)
   - Swap execution hook
   - Deposit address request flow
   - Status polling (5s interval, 30min max)
   - Stage management (idle → preparing → awaiting_signature → swap_executing → completed)

7. **`apps/web/src/components/swap/hooks/useSwapRouter.ts`** (234 lines)
   - **Unified router** that automatically selects XCM or Chainflip
   - Provider detection logic (2-layer: token provider field → network-based fallback)
   - Unified interface for both providers

### ✅ Modified Files

#### Asset Registry & Types
8. **`apps/web/src/services/xcm-router/assetRegistry.ts`**
   - Added `SwapProvider` type: `'xcm' | 'chainflip'`
   - Added `CHAINFLIP_CHAINS` constant
   - Added `CHAINFLIP_ONLY_NETWORKS` constant
   - Extended `AssetRegistryEntry.networkInstances` with:
     - `provider?: SwapProvider`
     - `chainflipId?: string` (compound ID like `"dot.hub"`)
     - `decimals?: number`
     - `contractAddress?: string`
   - Added `getSwapProvider()` helper function
   - Added Chainflip network instances for:
     - USDC: Ethereum, Arbitrum, Solana, AssetHub
     - USDT: Ethereum, AssetHub
     - DOT: AssetHub (via Chainflip)
     - ETH: Ethereum, Arbitrum
     - SOL: Solana
     - BTC: Bitcoin

9. **`apps/web/src/services/xcm-router/useAssetAggregator.ts`**
   - Extended `UnifiedAsset` type with `NetworkSupport` interface
   - Added `provider: SwapProvider` field
   - Modified aggregation logic:
     - XCM networks: Validate against ParaSpell `currencyFromMap`
     - Chainflip networks: Add directly from registry (no ParaSpell validation)
   - Created `createXcmNetworkData()` and `createChainflipNetworkData()` helpers

10. **`apps/web/src/components/swap/types.ts`**
    - Extended `TokenInfo` interface with:
      - `provider?: SwapProvider`
      - `chainflipId?: string`
      - `contractAddress?: string`

11. **`apps/web/src/components/swap/hooks/useXcmTokens.ts`**
    - Updated `convertUnifiedAssetsToTokens()` to pass through Chainflip fields
    - Handles both XCM and Chainflip network instances

#### UI Components
12. **`apps/web/src/components/swap/SwapContainer.tsx`**
    - Replaced `useXcmRoute` with `useSwapRouter`
    - Added dual execution hooks (XCM + Chainflip)
    - Unified success/error handlers
    - Provider-aware routing

13. **`apps/web/src/components/swap/ui/SwapDetails.tsx`**
    - Added `estimatedDuration` prop (Chainflip only)
    - Added `provider` prop
    - Shows Chainflip badge in route display
    - Displays estimated duration for Chainflip swaps

#### Wallet Integration
14. **`apps/web/src/lib/config/kheopskit.ts`**
    - Added Arbitrum network to `APPKIT_CHAINS`
    - Ready for Solana support (when kheopskit adds it)

15. **`apps/web/src/components/wallet/use-selected-account.ts`**
    - Extended `KheopskitAccount` interface with:
      - `platform: "polkadot" | "ethereum" | "solana"`
      - `publicKey?: Uint8Array`
      - `signMessage?: (message: Uint8Array) => Promise<Uint8Array>`
    - Added `useSelectedSolanaAccount()` convenience hook

---

## Provider Detection Logic

The router uses a **2-layer detection system**:

### Layer 1: Token Provider Field (Priority)
```typescript
if (inputToken?.provider === 'chainflip' || outputToken?.provider === 'chainflip') {
  return 'chainflip';
}
```

### Layer 2: Network-Based Fallback
```typescript
const CHAINFLIP_ONLY_NETWORKS = ['Ethereum', 'Arbitrum', 'Solana', 'Bitcoin'];

if (sourceNetwork in CHAINFLIP_ONLY_NETWORKS || destNetwork in CHAINFLIP_ONLY_NETWORKS) {
  return 'chainflip';
}
return 'xcm';  // Both are Polkadot ecosystem
```

### Decision Flow
```
User selects tokens
    ↓
Does token have provider='chainflip'? → YES → Use Chainflip
    ↓ NO
Is network in CHAINFLIP_ONLY_NETWORKS? → YES → Use Chainflip
    ↓ NO
Both Polkadot ecosystem → Use XCM
```

---

## Supported Assets & Networks

### Chainflip Assets (from `asset-mapping.json`)

| Asset | Network | Chainflip ID | Decimals |
|-------|---------|--------------|----------|
| BTC | Bitcoin | `btc.btc` | 8 |
| DOT | AssetHub | `dot.hub` | 10 |
| ETH | Arbitrum | `eth.arb` | 18 |
| ETH | Ethereum | `eth.eth` | 18 |
| FLIP | Ethereum | `flip.eth` | 18 |
| SOL | Solana | `sol.sol` | 9 |
| USDC | Arbitrum | `usdc.arb` | 6 |
| USDC | Ethereum | `usdc.eth` | 6 |
| USDC | AssetHub | `usdc.hub` | 6 |
| USDC | Solana | `usdc.sol` | 6 |
| USDT | Ethereum | `usdt.eth` | 6 |
| USDT | AssetHub | `usdt.hub` | 6 |

### Registry Status

✅ **Fully configured**: USDC, USDT, DOT, ETH, SOL, BTC  
❌ **Missing**: FLIP token (not yet added to registry)

---

## API Integration

### Base URL & Authentication
- **Base URL**: `https://chainflip-broker.io` (configurable via `NEXT_PUBLIC_CHAINFLIP_BROKER_URL`)
- **API Key**: `NEXT_PUBLIC_CHAINFLIP_API_KEY` (passed as query parameter: `?apikey=...`)

### Endpoints Used

1. **GET `/quotes`**
   - Parameters: `sourceAsset`, `destinationAsset`, `amount` (human-readable)
   - Returns: Array of quotes (`regular` and/or `dca`)
   - Currently selects `regular` quote type

2. **POST `/swap`**
   - Body: `sourceAsset`, `destinationAsset`, `destinationAddress`, `amount`
   - Returns: `depositAddress`, `swapId`, `depositChannel`

3. **GET `/swap/{swapId}`**
   - Returns: Current swap status with state transitions

### Response Format
- **Amounts**: Human-readable format (e.g., `"1.5"` for 1.5 ETH)
- **Fees**: Array of fee objects with `type`, `asset`, `amount`, `amountNative`
- **Duration**: Seconds (converted to "2-5 min" format)

---

## Swap Flow

### Chainflip Swap Execution Stages

1. **`idle`** - Ready to swap
2. **`preparing`** - Requesting deposit address from Chainflip
3. **`awaiting_signature`** - User needs to send funds to deposit address
4. **`submitting`** - Transaction submitted to source chain
5. **`confirming`** - Waiting for source chain confirmation
6. **`swap_executing`** - Chainflip processing the swap (polling status)
7. **`completed`** - Swap finished successfully
8. **`failed`** - Swap failed or refunded

### Status Polling
- **Interval**: 5 seconds
- **Max Duration**: 30 minutes
- **States Tracked**: `AWAITING_DEPOSIT`, `DEPOSIT_RECEIVED`, `SWAP_EXECUTING`, `EGRESS_SCHEDULED`, `COMPLETED`, `FAILED`, `REFUNDED`

---

## Testing URLs

### Valid Chainflip Routes

```
# ETH → USDC
http://localhost:3000/?from=ETH&fromNetwork=Ethereum&to=USDC&toNetwork=Arbitrum

# SOL → ETH
http://localhost:3000/?from=SOL&fromNetwork=Solana&to=ETH&toNetwork=Ethereum

# USDC cross-chain
http://localhost:3000/?from=USDC&fromNetwork=Ethereum&to=USDC&toNetwork=Solana

# DOT (AssetHub) → USDC (Arbitrum)
http://localhost:3000/?from=DOT&fromNetwork=AssetHub&to=USDC&toNetwork=Arbitrum
```

### Invalid Routes (Will Error)

```
# AssetHub → Arbitrum (missing chainflipId on source)
http://localhost:3000/?fromNetwork=AssetHubPolkadot&toNetwork=Arbitrum
# Error: "Input token not configured for Chainflip"
```

---

## Environment Variables Required

```bash
# Chainflip BaaS API Configuration
NEXT_PUBLIC_CHAINFLIP_BROKER_URL=https://chainflip-broker.io
NEXT_PUBLIC_CHAINFLIP_API_KEY=f21f20945f7c4797bf93490be088ec35
```

---

## Next Steps

1. ✅ **Fix API endpoints** - DONE (REST instead of JSON-RPC)
2. ✅ **Fix asset ID format** - DONE (compound IDs)
3. ⚠️ **Add `chainflipId` to XCM AssetHub tokens** - TODO
4. ⚠️ **Test end-to-end swap flow** - TODO
5. ⚠️ **Implement Solana transaction building** - TODO (when kheopskit supports it)
6. ⚠️ **Add DCA quote support** - TODO (optional enhancement)

---

## Code Statistics

- **New Files**: 7 files (~1,500 lines)
- **Modified Files**: 8 files (~500 lines changed)
- **Total Implementation**: ~2,000 lines of code
- **Time Estimate**: 11-18 hours (per original plan)

---

## References

- [Chainflip BaaS Documentation](https://docs.chainflip-broker.io/)
- [Chainflip BaaS Website](https://chainflip-broker.io)
- [Asset Mapping JSON](./asset-mapping.json)
- [Original Integration Plan](../.cursor/plans/chainflip-integration-plan-fe783623.plan.md)

