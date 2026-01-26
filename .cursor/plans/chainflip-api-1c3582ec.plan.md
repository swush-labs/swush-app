<!-- 1c3582ec-e51c-4350-9e55-3f84cedae683 b1222299-5939-4a78-861a-89a28998305f -->
# Chainflip BaaS API Integration Fix

## Problem Summary

The current implementation uses JSON-RPC at `/rpc` with methods like `broker_getQuote`, but the actual [Chainflip BaaS API](https://docs.chainflip-broker.io/features/ask-quote/) uses REST endpoints with query parameters.

**Key differences:**

- API Style: REST (not JSON-RPC)
- Auth: `?apikey=` query param (not Bearer header)
- Asset IDs: Compound format `eth.arb` (not separate chain/asset)
- Response: Array of quote types with `includedFees[]` array

---

## Phase 1: Update Types

**File:** [apps/web/src/services/chainflip/types.ts](apps/web/src/services/chainflip/types.ts)

- Remove JSON-RPC types (`JsonRpcRequest`, `JsonRpcResponse`)
- Add `ChainflipAssetId` type for compound IDs (e.g., `btc.btc`, `usdc.arb`)
- Update `ChainflipQuoteResponse` to match actual API response:
  - `type`: `'regular' | 'dca'`
  - `egressAmount`, `egressAmountNative`
  - `includedFees[]` array with `{ type, asset, amount }`
  - `estimatedDurationSeconds`, `boostQuote`
- Update swap request/response types for `/swap` endpoint

---

## Phase 2: Rewrite Client

**File:** [apps/web/src/services/chainflip/client.ts](apps/web/src/services/chainflip/client.ts)

Replace JSON-RPC with REST endpoints:

| Method | Old | New |

|--------|-----|-----|

| Quote | `POST /rpc` + `broker_getQuote` | `GET /quotes?apikey=...&sourceAsset=dot.hub&destinationAsset=usdc.arb&amount=1` |

| Swap | `POST /rpc` + `broker_requestSwapDepositAddress` | `POST /swap?apikey=...` |

| Status | `POST /rpc` + `broker_getSwapStatus` | `GET /swap/{swapId}?apikey=...` |

Key changes:

- Use query param `?apikey=` for authentication
- Use compound asset IDs (`sourceAsset=dot.hub`)
- Parse array response and select `regular` quote type
- Keep helper functions (`toSmallestUnit`, `fromSmallestUnit`, `formatDuration`)

---

## Phase 3: Update Asset Registry

**File:** [apps/web/src/services/xcm-router/assetRegistry.ts](apps/web/src/services/xcm-router/assetRegistry.ts)

Replace `chainflipChain` + `chainflipAsset` with single `chainflipId` field using [asset-mapping.json](docs/chainflip/asset-mapping.json):

| Asset | Network | chainflipId | decimals |

|-------|---------|-------------|----------|

| BTC | Bitcoin | `btc.btc` | 8 |

| DOT | Assethub | `dot.hub` | 10 |

| ETH | Ethereum | `eth.eth` | 18 |

| ETH | Arbitrum | `eth.arb` | 18 |

| FLIP | Ethereum | `flip.eth` | 18 |

| SOL | Solana | `sol.sol` | 9 |

| USDC | Ethereum | `usdc.eth` | 6 |

| USDC | Arbitrum | `usdc.arb` | 6 |

| USDC | Assethub | `usdc.hub` | 6 |

| USDC | Solana | `usdc.sol` | 6 |

| USDT | Ethereum | `usdt.eth` | 6 |

| USDT | Assethub | `usdt.hub` | 6 |

Update `AssetRegistryEntry.networkInstances` type to use `chainflipId?: string` instead of `chainflipChain` + `chainflipAsset`.

---

## Phase 4: Update TokenInfo Type

**File:** [apps/web/src/components/swap/types.ts](apps/web/src/components/swap/types.ts)

Replace `chainflipChain` + `chainflipAsset` with `chainflipId`:

```typescript
interface TokenInfo {
  // ... existing fields
  chainflipId?: string;  // e.g., "dot.hub", "usdc.arb"
  // Remove: chainflipChain, chainflipAsset
}
```

---

## Phase 5: Update Hooks

**Files:**

- [apps/web/src/components/swap/hooks/useChainflipRoute.ts](apps/web/src/components/swap/hooks/useChainflipRoute.ts)
- [apps/web/src/components/swap/hooks/useXcmTokens.ts](apps/web/src/components/swap/hooks/useXcmTokens.ts)

Changes:

- Update validation to check `token.chainflipId` instead of `chainflipChain`/`chainflipAsset`
- Pass `chainflipId` directly to client (no more building from separate fields)
- Update fee parsing to handle `includedFees[]` array format
- Select `regular` quote from response array (not DCA)

---

## Phase 6: Add Environment Variable

Add to `.env.local`:

```
NEXT_PUBLIC_CHAINFLIP_API_KEY=f21f20945f7c4797bf93490be088ec35
NEXT_PUBLIC_CHAINFLIP_BROKER_URL=https://chainflip-broker.io
```

---

## Files Changed Summary

| File | Change Type |

|------|-------------|

| `services/chainflip/types.ts` | Significant rewrite |

| `services/chainflip/client.ts` | Complete rewrite |

| `services/chainflip/index.ts` | Minor export updates |

| `services/xcm-router/assetRegistry.ts` | Update all Chainflip entries |

| `components/swap/types.ts` | Replace chainflip fields |

| `components/swap/hooks/useChainflipRoute.ts` | Update API calls and parsing |

| `components/swap/hooks/useChainflipExecution.ts` | Update swap initiation |

| `components/swap/hooks/useXcmTokens.ts` | Update field mapping |

### To-dos

- [ ] Rewrite types.ts with correct API response structures
- [ ] Rewrite client.ts from JSON-RPC to REST endpoints
- [ ] Update assetRegistry.ts with chainflipId field for all assets
- [ ] Update TokenInfo type to use chainflipId
- [ ] Update useChainflipRoute and useXcmTokens hooks
- [ ] Document env variable for API key