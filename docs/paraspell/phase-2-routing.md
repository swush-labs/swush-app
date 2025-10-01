# Phase 2: Routing Migration - Implementation Plan

Looking at Phase 1 completion and the migration plan, here's a detailed implementation plan for Phase 2.

## 📊 Current State

✅ **Completed (Phase 1)**:
- `useXcmTokens` provides real ParaSpell token data
- `inputToken` and `outputToken` have `assetKey` and `networkChain` fields
- Helper functions exposed: `getOptimalExchanges`, `determineCurrency`, `getTAssetFromKey`
- Token selection working with real data

⏸️ **Skipped for Later**:
- Network URL parameters (`fromNetwork`, `toNetwork`)

🔄 **Still Using Dummy Data**:
- `useSwapRoute.ts` - 95% conversion rate, dummy fees

---

## 🎯 Phase 2 Goals

1. ✅ Create `useXcmRoute.ts` with real RouterBuilder integration
2. ✅ Use `getAssetKeyForNetwork` for asset resolution  
3. ✅ Replace all `any` types with proper ParaSpell types
4. ✅ Show real output amounts in UI
5. ✅ Display accurate fees with multi-currency support
6. ✅ Handle loading/error states properly

---

## 🔍 Type Analysis First

Let me check the current `useSwapRoute.ts` to understand the exact interface we need to maintain:

[7 tools called]

Now let me check what RouterBuilder returns to ensure proper typing:

[2 tools called]

Perfect! Now I have all the information needed. Let me create a comprehensive **Phase 2 Implementation Plan**.

---

# 📋 Phase 2: Routing Migration - Detailed Plan

## 🎯 Objectives

1. ✅ Replace `useSwapRoute.ts` with `useXcmRoute.ts`
2. ✅ Use real RouterBuilder for quotes and fees
3. ✅ **Zero `any` types** - Use proper ParaSpell types
4. ✅ Show real output amounts in UI
5. ✅ Multi-currency fee display
6. ✅ Maintain backward compatibility with `SwapContainer`

---

## 📊 Type Strategy: No More `any`!

### **Import Proper Types**

```typescript
// From ParaSpell SDK
import type { TAssetInfo, TChain } from '@paraspell/sdk';

// From ParaSpell XCM Router
import type { 
  TExchangeChain,
  TRouterXcmFeeResult,
  TRouterAmountOutResult 
} from '@paraspell/xcm-router';

// From our services
import type { FeeSummary } from '@/services/xcm-router/feeCalculator';
import type { TokenInfo } from '@/components/swap/types';
```

### **Key Type Mappings**

| Current (Dummy) | ParaSpell Type | Notes |
|-----------------|----------------|-------|
| `any` exchanges | `TExchangeChain[]` | "HydrationDex", "AcalaDex", etc. |
| `any` network | `TChain` | "AssetHubPolkadot", "Hydration", etc. |
| `any` asset | `TAssetInfo` | Has symbol, decimals, assetId |
| `FeeBreakdown` (old) | `FeeSummary` | Multi-currency support |
| Route data | `TRouterAmountOutResult` | Has `amountOut` (bigint) and `exchange` |

---

## 🔧 Implementation Steps

### **Step 1: Create Type-Safe Utilities** 

First, create utility functions for BigInt conversion:

**File**: `apps/web/src/components/swap/hooks/useXcmRoute.ts` (new file)

```typescript
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { RouterBuilder } from '@paraspell/xcm-router';
import debounce from 'lodash.debounce';

// Proper ParaSpell types
import type { TAssetInfo, TChain } from '@paraspell/sdk';
import type { 
  TExchangeChain,
  TRouterXcmFeeResult,
  TRouterAmountOutResult 
} from '@paraspell/xcm-router';

// Our types
import type { TokenInfo } from '@/components/swap/types';
import type { FeeSummary } from '@/services/xcm-router/feeCalculator';
import { calculateTotalFees, formatFeeSummary } from '@/services/xcm-router/feeCalculator';
import { ROUTE_FETCH_TIMEOUT } from '@/lib/const';

// TEMPORARY: Dummy wallet address until wallet integration
const DUMMY_WALLET_ADDRESS = '5EWNeodpcQ6iYibJ3jmWVe85nsok1EDG8Kk3aFg8ZzpfY1qX';

/**
 * Convert user input (decimal) to smallest unit (bigint)
 * Example: "1.5" with 12 decimals → 1500000000000n
 */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return BigInt(0);
  
  // Handle decimal places
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  
  return BigInt(combined);
}

/**
 * Convert smallest unit (bigint) to decimal (string)
 * Example: 1500000000000n with 12 decimals → "1.500000"
 */
function toDecimalUnit(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  // Pad fractional part with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  
  // Format to 6 decimal places
  return `${wholePart}.${fractionalStr}`.slice(0, wholePart.toString().length + 7);
}
```

---

### **Step 2: Define Interfaces**

```typescript
export interface RouteState {
  isLoading: boolean;
  error: string | null;
  data: TRouterAmountOutResult | null;  // ← ParaSpell type, not RouteQuote
}

interface UseXcmRouteProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress?: string;
  slippageTolerance?: number; // percentage (e.g., 1 for 1%)
  
  // Helpers from useXcmTokens
  getOptimalExchanges: (
    fromKey: string, 
    toKey: string, 
    fromChain: string, 
    toChain: string
  ) => TExchangeChain[];
  
  determineCurrency: (asset: TAssetInfo) => any;  // ParaSpell TCurrencyInput (complex type)
  
  getTAssetFromKey: (
    key: string, 
    direction: 'from' | 'to'
  ) => TAssetInfo | undefined;
}

interface UseXcmRouteReturn {
  outputAmount: string;
  routeDex: string;
  routeState: RouteState;
  estimatedFees: string;
  feeBreakdown: FeeSummary | undefined;  // ← New FeeSummary, not old FeeBreakdown
  debouncedFetchRoute: (amount: string) => void;
  isProcessing: boolean;
  resetRoute: () => void;
}
```

---

### **Step 3: Main Hook Implementation**

```typescript
export function useXcmRoute({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance = 1,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
}: UseXcmRouteProps): UseXcmRouteReturn {
  
  // State
  const [outputAmount, setOutputAmount] = useState<string>('');
  const [routeDex, setRouteDex] = useState<string>('');
  const [routeState, setRouteState] = useState<RouteState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [estimatedFees, setEstimatedFees] = useState<string>('0');
  const [feeBreakdown, setFeeBreakdown] = useState<FeeSummary | undefined>(undefined);
  
  // Track latest input for stale response prevention
  const latestInputAmountRef = useRef<string>('');
  
  // Reset when tokens change
  useEffect(() => {
    setOutputAmount('');
    setRouteDex('');
    setRouteState({ isLoading: false, error: null, data: null });
    setEstimatedFees('0');
    setFeeBreakdown(undefined);
    latestInputAmountRef.current = '';
  }, [inputToken?.assetKey, outputToken?.assetKey]);  // Use assetKey for precise tracking
```

---

### **Step 4: Core Fetch Logic**

```typescript
  const fetchRoute = useCallback(async (currentInputAmount: string) => {
    // Validation
    if (
      !inputToken || 
      !outputToken || 
      !currentInputAmount || 
      parseFloat(currentInputAmount) <= 0
    ) {
      setOutputAmount('');
      setRouteDex('');
      setRouteState({ isLoading: false, error: null, data: null });
      setEstimatedFees('0');
      setFeeBreakdown(undefined);
      return;
    }
    
    // Ensure we have asset keys
    if (!inputToken.assetKey || !inputToken.networkChain) {
      console.error('❌ Input token missing assetKey or networkChain');
      return;
    }
    
    if (!outputToken.assetKey || !outputToken.networkChain) {
      console.error('❌ Output token missing assetKey or networkChain');
      return;
    }
    
    latestInputAmountRef.current = currentInputAmount;
    setIsProcessing(true);
    setRouteState(prev => ({ ...prev, isLoading: true, error: null }));
    setOutputAmount('');
    setRouteDex('');
    
    try {
      // Step 1: Get optimal DEX selection
      const optimalExchanges = getOptimalExchanges(
        inputToken.assetKey,
        outputToken.assetKey,
        inputToken.networkChain,
        outputToken.networkChain
      );
      
      const exchangesToUse: TExchangeChain[] = optimalExchanges.length > 0 
        ? optimalExchanges 
        : ['HydrationDex']; // Type-safe fallback
      
      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');
      
      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }
      
      // Step 3: Convert amount to smallest unit
      const amountInSmallestUnit = toSmallestUnit(
        currentInputAmount, 
        inputToken.decimals
      );
      
      console.log('🔄 Fetching route:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amount: currentInputAmount,
        amountSmallest: amountInSmallestUnit.toString(),
        exchanges: exchangesToUse,
      });
      
      // Step 4: Get quote from RouterBuilder
      const quoteResult: TRouterAmountOutResult = await RouterBuilder()
        .from(inputToken.networkChain as TChain)
        .to(outputToken.networkChain as TChain)
        .exchange(exchangesToUse)
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(amountInSmallestUnit)
        .getBestAmountOut();
      
      // Check for stale response
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale quote response, ignoring');
        return;
      }
      
      // Step 5: Convert output to decimal
      const outputDecimal = toDecimalUnit(
        quoteResult.amountOut, 
        outputToken.decimals
      );
      
      setOutputAmount(outputDecimal);
      
      // Handle exchange display (can be string or array)
      const dexDisplay = Array.isArray(quoteResult.exchange)
        ? quoteResult.exchange.join(' → ')
        : quoteResult.exchange;
      
      setRouteDex(dexDisplay);
      
      console.log('✅ Quote received:', {
        outputAmount: outputDecimal,
        exchange: dexDisplay,
      });
      
      // Step 6: Get fees
      const addressToUse = walletAddress || DUMMY_WALLET_ADDRESS;
      
      console.log('💰 Fetching fees...', {
        usingDummyAddress: !walletAddress,
        address: addressToUse,
      });
      
      const feeResult: TRouterXcmFeeResult = await RouterBuilder()
        .from(inputToken.networkChain as TChain)
        .to(outputToken.networkChain as TChain)
        .exchange(exchangesToUse)
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(amountInSmallestUnit)
        .senderAddress(addressToUse)
        .recipientAddress(addressToUse)
        .slippagePct(slippageTolerance.toString())
        .getXcmFees();
      
      // Check for stale response
      if (latestInputAmountRef.current !== currentInputAmount) {
        console.log('⚠️ Stale fee response, ignoring');
        return;
      }
      
      // Step 7: Calculate and format fees
      const feeSummary = calculateTotalFees(feeResult);
      setFeeBreakdown(feeSummary);
      setEstimatedFees(formatFeeSummary(feeSummary));
      
      console.log('✅ Fees calculated:', formatFeeSummary(feeSummary));
      
      // Step 8: Update state
      setRouteState({
        isLoading: false,
        error: null,
        data: quoteResult,
      });
      
    } catch (error: unknown) {
      console.error('❌ Route fetch error:', error);
      
      if (latestInputAmountRef.current === currentInputAmount) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to fetch route';
        
        setRouteState({
          isLoading: false,
          error: errorMessage,
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
```

---

### **Step 5: Debounce & Return**

```typescript
  const debouncedFetchRoute = useMemo(
    () =>
      debounce((amount: string) => {
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

---

### **Step 6: Update SwapContainer**

**File**: `apps/web/src/components/swap/SwapContainer.tsx`

**Changes**:

```typescript
// BEFORE:
import { useSwapRoute } from '@/components/swap/hooks/useSwapRoute'

// AFTER:
import { useXcmRoute } from '@/components/swap/hooks/useXcmRoute'
```

```typescript
// BEFORE:
const {
  outputAmount,
  routeDex,
  routeState,
  estimatedFees,
  feeBreakdown,
  debouncedFetchRoute,
  isProcessing,
  resetRoute
} = useSwapRoute({
  inputToken,
  outputToken
})

// AFTER:
const {
  outputAmount,
  routeDex,
  routeState,
  estimatedFees,
  feeBreakdown,
  debouncedFetchRoute,
  isProcessing,
  resetRoute
} = useXcmRoute({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance,
  // Pass helpers from useXcmTokens
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
})
```

---

## 🎨 Design Decisions & Trade-offs

### **Decision 1: Use `FeeSummary` Instead of Old `FeeBreakdown`**

**Reasoning**:
- ✅ **Multi-currency support** - ParaSpell fees can be in different tokens
- ✅ **Type-safe** - Proper ParaSpell types
- ✅ **Better formatting** - `formatFeeSummary()` handles display
- ⚠️ **Breaking change** - `feeBreakdown` type changes

**Migration**: UI components using `feeBreakdown` may need updates (check SwapDetails.tsx)

---

### **Decision 2: Proper BigInt Conversion Utilities**

**Why not just `BigInt(Math.floor(amount * 10**decimals))`?**

**Issue**: JavaScript precision limits!
```typescript
// ❌ WRONG - loses precision with large decimals
BigInt(Math.floor(1.5 * 10**18))  // May lose precision

// ✅ CORRECT - string manipulation preserves precision
toSmallestUnit("1.5", 18)  // Exact: 1500000000000000000n
```

---

### **Decision 3: No `any` Types Except `determineCurrency`**

**Why `determineCurrency` returns `any`?**

Because ParaSpell's `TCurrencyInput` is a complex union type:
```typescript
type TCurrencyInput = 
  | { symbol: string }
  | { id: number | string }
  | { location: MultiLocation }
```

The function handles this internally, so we don't need to type it in our hook.

---

## 📋 Implementation Checklist

### **Pre-Implementation** ✅
- [x] Review current `useSwapRoute` interface
- [x] Understand ParaSpell types
- [x] Check `FeeSummary` vs old `FeeBreakdown`
- [x] Plan BigInt conversion strategy

### **Implementation** 
- [ ] Create `apps/web/src/components/swap/hooks/useXcmRoute.ts`
- [ ] Add BigInt utility functions (`toSmallestUnit`, `toDecimalUnit`)
- [ ] Define proper TypeScript interfaces (no `any`)
- [ ] Implement main `useXcmRoute` hook
- [ ] Add DUMMY_WALLET_ADDRESS constant with TODO comment
- [ ] Update `SwapContainer.tsx` to use new hook
- [ ] Verify no TypeScript errors
- [ ] Verify no linter errors

### **Testing**
- [ ] Test with DOT → USDC swap
- [ ] Test with USDT → DOT swap
- [ ] Verify output amount displays correctly
- [ ] Verify fee display shows multi-currency (e.g., "0.001 DOT + 0.0005 USDC")
- [ ] Test loading states
- [ ] Test error handling (invalid amounts, network failures)
- [ ] Test debounce behavior

### **Cleanup** (after validation)
- [ ] Delete `apps/web/src/components/swap/hooks/useSwapRoute.ts`
- [ ] Remove dummy route constants
- [ ] Update any remaining imports

---

## ⚠️ Potential Issues & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Type mismatch in `feeBreakdown`** | Medium | Update `SwapDetails.tsx` to use new `FeeSummary` |
| **RouterBuilder timeout** | High | Use `ROUTE_FETCH_TIMEOUT` (already configured), show loading skeleton |
| **Network API failures** | High | Try-catch with user-friendly error messages |
| **BigInt serialization errors** | Medium | Use `safeStringify` from feeCalculator when logging |
| **Stale responses** | Medium | Already handled with `latestInputAmountRef` |

---

## 🚀 Expected Outcome

After implementation:

1. ✅ **Real quotes** from ParaSpell RouterBuilder
2. ✅ **Real fees** with multi-currency support
3. ✅ **Auto DEX selection** based on asset compatibility
4. ✅ **Type-safe** with zero `any` types (except `determineCurrency`)
5. ✅ **Backward compatible** with existing UI components
6. ✅ Output visible in UI with accurate amounts

---

## 📊 Estimated Timeline

- **Implementation**: 2-3 hours
- **Testing**: 1-2 hours
- **Bug fixes**: 1 hour
- **Total**: ~4-6 hours

---

## 🎯 Ready to Implement?

**Shall I proceed with creating `useXcmRoute.ts` with this plan?** 

I'll ensure:
- ✅ Zero `any` types (except where unavoidable)
- ✅ Proper ParaSpell type imports
- ✅ BigInt handled correctly
- ✅ Complete backward compatibility
- ✅ Real output amounts in UI

Let me know if you'd like any adjustments to the plan!