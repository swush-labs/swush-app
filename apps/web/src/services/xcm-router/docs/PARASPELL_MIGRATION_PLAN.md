# ParaSpell XCM Router Migration Plan

> **Goal**: Replace all dummy asset and routing logic with ParaSpell SDK integration

---

## 📊 Current State Analysis

### Files Using Dummy Data
1. **`useSwapTokens.ts`** - Uses `DUMMY_ASSETS` array (23 hardcoded tokens)
2. **`useSwapRoute.ts`** - Uses dummy route with 95% conversion rate
3. Both have flags: `USE_DUMMY_ASSETS = true` and `USE_DUMMY_ROUTE = true`

### What We Have Ready
✅ **`useAssetAggregator`** - Provides real ParaSpell asset data with network support  
✅ **`feeCalculator`** - Calculates real fees from RouterBuilder  
✅ **`assetRegistry`** - Curated asset definitions with DEX compatibility  
✅ **Asset Selection UI** - Already supports network grouping (AssetList component)

---

## 🎯 Implementation Approach: Clean Replacement Strategy

### **Phase 1: Token Selection Migration** (Day 1-2)

#### **1.1 Create New Hook: `useXcmTokens.ts`**

**Purpose**: Replace `useSwapTokens` with ParaSpell-powered token management

**Location**: `apps/web/src/components/swap/hooks/useXcmTokens.ts`

**Key Features**:
- Use `useAssetAggregator` for asset data
- Maintain backward compatibility with `TokenInfo` interface
- Add network awareness with asset keys
- Preserve URL parameter integration

**Implementation**:

```typescript
// apps/web/src/components/swap/hooks/useXcmTokens.ts

import { useState, useMemo, useCallback, useEffect } from 'react';
import useAssetAggregator, { determineCurrency } from '@/services/xcm-router/useAssetAggregator';
import { EXCHANGE_CHAINS } from '@paraspell/xcm-router';
import type { TokenInfo } from '@/components/swap/types';
import { useFromTokenState, useToTokenState } from './utils/queryParams';

// Extended TokenInfo to include XCM-specific fields
export interface XcmTokenInfo extends TokenInfo {
  assetKey: string;        // e.g., "USDC-1984"
  networkChain: string;    // e.g., "AssetHubPolkadot"
}

export function useXcmTokens() {
  // Preserve URL params for token symbols
  const [fromSymbol, setFromSymbol] = useFromTokenState();
  const [toSymbol, setToSymbol] = useToTokenState();
  
  // Add network selection (new state - will be added to URL params later)
  const [fromNetwork, setFromNetwork] = useState<string>('');
  const [toNetwork, setToNetwork] = useState<string>('');

  // Initialize asset aggregator with all exchange chains
  const {
    unifiedFromAssets,
    unifiedToAssets,
    getTAssetFromKey,
    getAssetKeyForNetwork,
    getOptimalExchanges,
    currencyFromMap,
    currencyToMap,
  } = useAssetAggregator(undefined, [...EXCHANGE_CHAINS], undefined);

  // Auto-select first available network when symbol changes
  useEffect(() => {
    if (fromSymbol && !fromNetwork) {
      const asset = unifiedFromAssets.find(a => a.symbol === fromSymbol);
      if (asset && asset.supportedNetworks.length > 0) {
        // Prefer verified networks
        const verifiedNetwork = asset.supportedNetworks.find(n => n.verified);
        setFromNetwork(verifiedNetwork?.network || asset.supportedNetworks[0].network);
      }
    }
  }, [fromSymbol, fromNetwork, unifiedFromAssets]);

  useEffect(() => {
    if (toSymbol && !toNetwork) {
      const asset = unifiedToAssets.find(a => a.symbol === toSymbol);
      if (asset && asset.supportedNetworks.length > 0) {
        const verifiedNetwork = asset.supportedNetworks.find(n => n.verified);
        setToNetwork(verifiedNetwork?.network || asset.supportedNetworks[0].network);
      }
    }
  }, [toSymbol, toNetwork, unifiedToAssets]);

  // Convert UnifiedAssets to flat TokenInfo list for UI compatibility
  const tokens = useMemo<XcmTokenInfo[]>(() => {
    const allTokens: XcmTokenInfo[] = [];
    
    // Combine from and to assets, removing duplicates
    const allUnifiedAssets = [...unifiedFromAssets];
    unifiedToAssets.forEach(toAsset => {
      if (!allUnifiedAssets.find(a => a.symbol === toAsset.symbol)) {
        allUnifiedAssets.push(toAsset);
      }
    });
    
    allUnifiedAssets.forEach(asset => {
      asset.supportedNetworks.forEach(network => {
        allTokens.push({
          id: network.assetKey,
          name: asset.name,
          symbol: asset.symbol,
          icon: asset.symbol.charAt(0),
          decimals: network.actualAsset.decimals || 10,
          network: network.network,
          assetKey: network.assetKey,
          networkChain: network.network,
        });
      });
    });
    
    return allTokens;
  }, [unifiedFromAssets, unifiedToAssets]);

  // Get current input token
  const inputToken = useMemo<XcmTokenInfo | null>(() => {
    if (!fromSymbol || !fromNetwork) return null;
    
    const assetKey = getAssetKeyForNetwork(fromSymbol, fromNetwork, 'from');
    if (!assetKey) return null;
    
    const asset = getTAssetFromKey(assetKey, 'from');
    if (!asset) return null;
    
    return {
      id: assetKey,
      name: asset.symbol || fromSymbol,
      symbol: asset.symbol || fromSymbol,
      icon: (asset.symbol || fromSymbol).charAt(0),
      decimals: asset.decimals || 10,
      network: fromNetwork,
      assetKey,
      networkChain: fromNetwork,
    };
  }, [fromSymbol, fromNetwork, getAssetKeyForNetwork, getTAssetFromKey]);

  // Get current output token
  const outputToken = useMemo<XcmTokenInfo | null>(() => {
    if (!toSymbol || !toNetwork) return null;
    
    const assetKey = getAssetKeyForNetwork(toSymbol, toNetwork, 'to');
    if (!assetKey) return null;
    
    const asset = getTAssetFromKey(assetKey, 'to');
    if (!asset) return null;
    
    return {
      id: assetKey,
      name: asset.symbol || toSymbol,
      symbol: asset.symbol || toSymbol,
      icon: (asset.symbol || toSymbol).charAt(0),
      decimals: asset.decimals || 10,
      network: toNetwork,
      assetKey,
      networkChain: toNetwork,
    };
  }, [toSymbol, toNetwork, getAssetKeyForNetwork, getTAssetFromKey]);

  // Token selection handlers
  const setInputToken = useCallback((token: XcmTokenInfo) => {
    setFromSymbol(token.symbol);
    setFromNetwork(token.networkChain);
  }, [setFromSymbol]);

  const setOutputToken = useCallback((token: XcmTokenInfo) => {
    setToSymbol(token.symbol);
    setToNetwork(token.networkChain);
  }, [setToSymbol]);

  return {
    inputToken,
    outputToken,
    tokens,
    setInputToken,
    setOutputToken,
    // Expose additional helpers for routing
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    // For debugging/inspection
    unifiedFromAssets,
    unifiedToAssets,
  };
}
```

**Trade-offs**:
- ✅ **Real asset data** from ParaSpell SDK
- ✅ **Network-aware** selection with proper asset keys
- ✅ **Auto-selects networks** for better UX
- ✅ **Backward compatible** with existing TokenInfo interface
- ❌ **Additional state** for network selection
- ❌ **Needs UI updates** to show network selection

---

#### **1.2 Update TokenInfo Type**

**File**: `apps/web/src/components/swap/types.ts`

**Change**:
```typescript
export interface TokenInfo {
  id: string;              // Now holds assetKey (e.g., "USDC-1984")
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  network?: string;        // Already exists - now required
  assetKey?: string;       // NEW: Explicit asset key field
  networkChain?: string;   // NEW: Explicit network chain field
}
```

---

### **Phase 2: Routing Migration** (Day 2-3)

#### **2.1 Create New Hook: `useXcmRoute.ts`**

**Purpose**: Replace `useSwapRoute` with real RouterBuilder integration

**Location**: `apps/web/src/components/swap/hooks/useXcmRoute.ts`

**Key Features**:
- Use RouterBuilder for real quotes
- Automatic DEX selection via `getOptimalExchanges`
- Real fee calculation with multi-currency support
- Proper BigInt handling for amounts

**Implementation**:

```typescript
// apps/web/src/components/swap/hooks/useXcmRoute.ts

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { RouterBuilder } from '@paraspell/xcm-router';
import debounce from 'lodash.debounce';
import { calculateTotalFees, formatFeeSummary, type FeeSummary } from '@/services/xcm-router/feeCalculator';
import type { XcmTokenInfo } from './useXcmTokens';
import type { TAssetInfo } from '@paraspell/sdk';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';

interface UseXcmRouteProps {
  inputToken: XcmTokenInfo | null;
  outputToken: XcmTokenInfo | null;
  walletAddress?: string;
  slippageTolerance?: number; // percentage (e.g., 1 for 1%)
  getOptimalExchanges: (fromKey: string, toKey: string, fromChain: string, toChain: string) => any[];
  determineCurrency: (asset: TAssetInfo) => any;
  getTAssetFromKey: (key: string, direction: 'from' | 'to') => TAssetInfo | undefined;
}

// TEMPORARY: Dummy wallet address for testing until wallet library is implemented
const DUMMY_WALLET_ADDRESS = '5EWNeodpcQ6iYibJ3jmWVe85nsok1EDG8Kk3aFg8ZzpfY1qX';

export interface RouteState {
  isLoading: boolean;
  error: string | null;
  data: any | null;
}

// Utility: Convert user input to smallest unit
function toSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return BigInt(0);
  return BigInt(Math.floor(parsed * Math.pow(10, decimals)));
}

// Utility: Convert smallest unit to decimal
function toDecimalUnit(amount: bigint, decimals: number): string {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(6);
}

export function useXcmRoute({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance = 1,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
}: UseXcmRouteProps) {
  const [outputAmount, setOutputAmount] = useState('');
  const [routeDex, setRouteDex] = useState<string>('');
  const [routeState, setRouteState] = useState<RouteState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [estimatedFees, setEstimatedFees] = useState<string>('0');
  const [feeBreakdown, setFeeBreakdown] = useState<FeeSummary | undefined>(undefined);

  // Track latest input to prevent stale responses
  const latestInputAmountRef = useRef<string>('');

  // Reset when tokens change
  useEffect(() => {
    setOutputAmount('');
    setRouteDex('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
    latestInputAmountRef.current = '';
  }, [inputToken?.id, outputToken?.id]);

  const fetchRoute = useCallback(async (currentInputAmount: string) => {
    if (!inputToken || !outputToken || !currentInputAmount || parseFloat(currentInputAmount) <= 0) {
      setOutputAmount('');
      setRouteDex('');
      setRouteState({ isLoading: false, error: null, data: null });
      setEstimatedFees('0');
      setFeeBreakdown(undefined);
      return;
    }

    latestInputAmountRef.current = currentInputAmount;
    setIsProcessing(true);
    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('');
    setRouteDex('');

    try {
      // Get optimal DEX selection
      const optimalExchanges = getOptimalExchanges(
        inputToken.assetKey,
        outputToken.assetKey,
        inputToken.networkChain,
        outputToken.networkChain
      );

      const exchangesToUse = optimalExchanges.length > 0 
        ? optimalExchanges 
        : ["HydrationDex"]; // Fallback

      // Get asset info for RouterBuilder
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(`Assets not found: ${inputToken.assetKey} or ${outputToken.assetKey}`);
      }

      // Convert to smallest unit
      const amountInSmallestUnit = toSmallestUnit(currentInputAmount, inputToken.decimals);

      console.log('🔄 Fetching route:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amount: currentInputAmount,
        amountSmallest: amountInSmallestUnit.toString(),
        exchanges: exchangesToUse,
      });

      // Get best quote from RouterBuilder
      const quoteResult = await RouterBuilder()
        .from(inputToken.networkChain)
        .to(outputToken.networkChain)
        .exchange(exchangesToUse)
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(amountInSmallestUnit)
        .getBestAmountOut();

      // Check if this response is still relevant
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale response, ignoring');
        return;
      }

      // Convert output to decimal
      const outputDecimal = toDecimalUnit(quoteResult.amountOut, outputToken.decimals);
      setOutputAmount(outputDecimal);
      setRouteDex(Array.isArray(quoteResult.exchange) 
        ? quoteResult.exchange.join(' → ') 
        : quoteResult.exchange
      );

      console.log('✅ Quote received:', {
        outputAmount: outputDecimal,
        exchange: quoteResult.exchange,
      });

      // Get fees - use dummy wallet until real wallet is implemented
      const addressToUse = walletAddress || DUMMY_WALLET_ADDRESS;
      
      console.log('💰 Fetching fees...', { 
        usingDummyAddress: !walletAddress,
        address: addressToUse 
      });
      
      const feeResult = await RouterBuilder()
        .from(inputToken.networkChain as any)
        .to(outputToken.networkChain as any)
        .exchange(exchangesToUse as any)
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(amountInSmallestUnit)
        .senderAddress(addressToUse)
        .recipientAddress(addressToUse)
        .slippagePct(slippageTolerance.toString())
        .getXcmFees();

      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale fee response, ignoring');
        return;
      }

      const feeSummary = calculateTotalFees(feeResult);
      setFeeBreakdown(feeSummary);
      setEstimatedFees(formatFeeSummary(feeSummary));

      console.log('✅ Fees calculated:', formatFeeSummary(feeSummary));

      setRouteState({
        isLoading: false,
        error: null,
        data: quoteResult,
      });

    } catch (error: any) {
      console.error('❌ Route fetch error:', error);
      
      if (latestInputAmountRef.current === currentInputAmount) {
        setRouteState({
          isLoading: false,
          error: error.message || 'Failed to fetch route',
          data: null,
        });
        setOutputAmount('');
        setRouteDex('');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    inputToken,
    outputToken,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    walletAddress,
    slippageTolerance,
  ]);

  const debouncedFetchRoute = useMemo(
    () => debounce((amount: string) => {
      if (amount && parseFloat(amount) > 0 && !isNaN(parseFloat(amount))) {
        fetchRoute(amount);
      } else {
        setOutputAmount('');
        setRouteDex('');
        setRouteState({ isLoading: false, error: null, data: null });
        setEstimatedFees('0');
        setFeeBreakdown(undefined);
      }
    }, ROUTE_FETCH_TIMEOUT),
    [fetchRoute]
  );

  const resetRoute = useCallback(() => {
    latestInputAmountRef.current = '';
    setOutputAmount('');
    setRouteDex('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedFetchRoute.cancel();
      latestInputAmountRef.current = '';
    };
  }, [debouncedFetchRoute]);

  return {
    outputAmount,
    routeDex,
    routeState,
    estimatedFees,
    feeBreakdown,
    debouncedFetchRoute,
    isProcessing,
    resetRoute,
  };
}
```

**Trade-offs**:
- ✅ **Real quotes** from ParaSpell RouterBuilder
- ✅ **Auto DEX selection** based on asset compatibility
- ✅ **Accurate fees** with proper breakdown
- ✅ **BigInt handling** for precision
- ⚠️ **Dummy wallet address** - Using temporary address until wallet library is ready
- ❌ **Network latency** - slower than dummy (needs good loading UX)
- ❌ **Potential API failures** - needs robust error handling

---

### **Phase 3: SwapContainer Integration** (Day 3-4)

#### **3.1 Replace Hooks in SwapContainer**

**File**: `apps/web/src/components/swap/SwapContainer.tsx`

**Changes**:

```typescript
// BEFORE:
import { useSwapTokens } from '@/components/swap/hooks/useSwapTokens'
import { useSwapRoute } from '@/components/swap/hooks/useSwapRoute'

// AFTER:
import { useXcmTokens } from '@/components/swap/hooks/useXcmTokens'
import { useXcmRoute } from '@/components/swap/hooks/useXcmRoute'
```

```typescript
export function SwapContainer() {
  // ... existing state ...
  
  // REPLACE: Token handling
  const { 
    inputToken, 
    setInputToken, 
    outputToken, 
    setOutputToken, 
    tokens,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
  } = useXcmTokens(); // ← Changed from useSwapTokens()

  // ... balances hook stays the same ...

  // REPLACE: Swap route
  const {
    outputAmount,
    routeDex,
    routeState,
    estimatedFees,
    feeBreakdown,
    debouncedFetchRoute,
    isProcessing,
    resetRoute
  } = useXcmRoute({ // ← Changed from useSwapRoute()
    inputToken,
    outputToken,
    walletAddress,
    slippageTolerance,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
  });

  // Rest of the component stays the same!
  // The interface is backward compatible
}
```

**Why This Works**:
- Both hooks return the same interface
- UI components don't need changes
- State management stays identical

---

#### **3.2 Update Fee Display**

**File**: `apps/web/src/components/swap/ui/SwapDetails.tsx`

**Enhancement**: Show multi-currency fees properly

```typescript
// Current (single fee):
<div className="text-sm text-forest-400">
  Max Transaction Fee: {maxTransactionFee} {inputToken?.symbol}
</div>

// New (multi-currency support):
<div className="text-sm text-forest-400">
  Max Transaction Fee: {estimatedFees || '0'}
</div>

// Example output: "0.001000 DOT + 0.000500 USDC"
```

**Optional Enhancement**: Add fee breakdown tooltip

```typescript
{feeBreakdown && (
  <Tooltip>
    <TooltipTrigger>
      <Info className="w-4 h-4" />
    </TooltipTrigger>
    <TooltipContent>
      <div className="space-y-1">
        <div>Origin: {feeBreakdown.breakdown.origin.currency}</div>
        <div>Destination: {feeBreakdown.breakdown.destination.currency}</div>
        {feeBreakdown.breakdown.hops.map((hop, i) => (
          <div key={i}>Hop {i+1}: {hop.result.currency}</div>
        ))}
      </div>
    </TooltipContent>
  </Tooltip>
)}
```

---

### **Phase 4: Cleanup & Polish** (Day 4-5)

#### **4.1 Delete Old Files**

```bash
# These can be deleted:
apps/web/src/components/swap/hooks/useSwapTokens.ts
apps/web/src/components/swap/hooks/useSwapRoute.ts
```

#### **4.2 Remove Dummy Constants**

No more `DUMMY_ASSETS` array!  
No more `USE_DUMMY_ASSETS` or `USE_DUMMY_ROUTE` flags!

#### **4.3 Update Imports**

**Files to update**:
- `apps/web/src/components/swap/index.ts` (if it exports the hooks)
- Any test files that import the old hooks

---

## 🔧 Additional Enhancements (Optional)

### **Future: Real Wallet Integration**

**When wallet library is implemented**, update `useXcmRoute.ts`:

```typescript
// Remove DUMMY_WALLET_ADDRESS constant

// Update fee fetching logic:
if (!walletAddress) {
  console.log('⚠️ No wallet connected, skipping fee calculation');
  // Optional: Still show estimated fees using dummy address
  // Or skip fee calculation entirely
  return;
}

const feeResult = await RouterBuilder()
  // ... rest of the code
  .senderAddress(walletAddress)  // Use real wallet
  .recipientAddress(walletAddress)
  .getXcmFees();
```

**Benefits of real wallet**:
- ✅ Accurate fees based on actual account state
- ✅ Can validate sufficient balance for fees
- ✅ Better UX with connected wallet context

---

### **Network Selection in URL Params**

**File**: `apps/web/src/components/swap/hooks/utils/queryParams.ts`

Add network params:

```typescript
export const useFromNetworkState = () => {
  return useQueryState('fromNetwork', parseAsString.withDefault(''));
};

export const useToNetworkState = () => {
  return useQueryState('toNetwork', parseAsString.withDefault(''));
};
```

**Benefits**:
- Shareable swap links with full context
- Deep linking support
- Better UX for multi-network swaps

---

### **Enhanced Token Selection UI**

**File**: `apps/web/src/components/swap/ui/AssetList.tsx`

**Current**: Already supports network grouping! ✅

The UI already shows:
1. Asset symbols (USDC, DOT, etc.)
2. Expandable network list
3. Network badges

**Just needs**: Asset data from `useXcmTokens` instead of dummy data

---

## 📋 Migration Checklist

### **Pre-Migration**
- [ ] Review current dummy data structure
- [ ] Understand existing URL param integration
- [ ] Test ParaSpell SDK connection
- [ ] Verify asset registry completeness

### **Phase 1: Tokens**
- [ ] Create `useXcmTokens.ts`
- [ ] Update `TokenInfo` type with asset key fields
- [ ] Test token selection with real data
- [ ] Verify network auto-selection logic
- [ ] Test URL param integration

### **Phase 2: Routing**
- [ ] Create `useXcmRoute.ts`
- [ ] Add DUMMY_WALLET_ADDRESS constant
- [ ] Add decimal conversion utilities
- [ ] Test RouterBuilder integration
- [ ] Verify DEX auto-selection
- [ ] Test fee calculation with dummy wallet
- [ ] Handle BigInt serialization
- [ ] Add TODO comment for real wallet integration

### **Phase 3: Integration**
- [ ] Replace hooks in SwapContainer
- [ ] Update fee display
- [ ] Test end-to-end swap flow
- [ ] Verify balance updates
- [ ] Test error handling

### **Phase 4: Cleanup**
- [ ] Delete old hook files
- [ ] Remove dummy constants
- [ ] Update all imports
- [ ] Clean up console logs
- [ ] Update documentation

### **Testing**
- [ ] Test with different asset pairs
- [ ] Test cross-chain swaps (AssetHub ↔ Hydration)
- [ ] Test same-chain swaps
- [ ] Test fee calculation with dummy wallet address
- [ ] Verify fees are fetched even without wallet connected
- [ ] Test error scenarios (no route, network failure)
- [ ] Test loading states
- [ ] Performance testing (debounce, caching)

---

## ⚠️ Risk Mitigation

### **Potential Issues**

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **RouterBuilder slow** | High | Aggressive debouncing (1000ms), skeleton loaders, caching |
| **Network failures** | High | Try-catch blocks, fallback messaging, retry logic |
| **Missing asset keys** | Medium | Comprehensive asset registry, validation on selection |
| **BigInt errors** | Medium | Use utilities, test thoroughly, safe serialization |
| **Stale responses** | Medium | Request tracking with refs, cancellation on unmount |
| **Type mismatches** | Low | Extend TokenInfo properly, thorough TypeScript checking |

### **Rollback Plan**

If critical issues arise:
1. **Keep old files** during migration (don't delete immediately)
2. **Git branching** - separate branch for migration
3. **Feature flag** - Add `USE_PARASPELL` env var for easy rollback
4. **Progressive rollout** - Test with subset of users first

---

## 🎯 Success Metrics

### **Functional**
- ✅ Real asset data from ParaSpell SDK
- ✅ Accurate routing with DEX selection
- ✅ Proper fee calculation (multi-currency)
- ✅ Network-aware token selection
- ✅ No dummy data remaining

### **Performance**
- ⏱️ Route fetch < 2 seconds (95th percentile)
- ⏱️ Asset load < 1 second
- 🔄 Debounce prevents excessive API calls

### **UX**
- 🎨 Loading states for async operations
- ⚠️ Clear error messages
- 🔗 Shareable URLs with full swap context
- 📱 Responsive network selection

---

## 🚀 Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | 1-2 days | Working `useXcmTokens` with real assets |
| **Phase 2** | 1-2 days | Working `useXcmRoute` with RouterBuilder |
| **Phase 3** | 1 day | Integrated SwapContainer |
| **Phase 4** | 1 day | Cleanup & polish |
| **Testing** | 1-2 days | Full QA across scenarios |
| **Total** | **5-7 days** | Production-ready XCM integration |

---

## 📚 Reference Documentation

- **ParaSpell SDK**: https://paraspell.github.io/docs/
- **XCM Router**: https://github.com/paraspell/xcm-tools/tree/main/packages/xcm-router
- **Asset Registry**: `apps/web/src/services/xcm-router/assetRegistry.ts`
- **Services API Reference**: `apps/web/src/services/xcm-router/docs/SERVICES_API_REFERENCE.md`

---

## 🎉 Final Notes

This migration replaces **all dummy logic** with production-ready ParaSpell integration while maintaining:
- ✅ **Backward compatibility** with existing UI components
- ✅ **Type safety** throughout the stack
- ✅ **User experience** with proper loading/error states
- ✅ **Code quality** with clear separation of concerns

The phased approach allows for **incremental validation** at each step, minimizing risk while delivering a robust XCM-powered DEX aggregator.

**Ready to implement? Start with Phase 1!** 🚀
