<!-- 6ed51372-bc57-44c1-9b88-68d6f00ba371 3a0ce5e3-9900-445b-bdcc-96e7e58af4cb -->
# Phase 3: XCM Swap Execution Integration

## Overview

Replace the current Asset Hub-only swap execution (`useAssetConversionSwap`) with ParaSpell RouterBuilder's `.buildAndSend()` method for full cross-chain XCM swap support. Integrate Kheopskit wallet signer and implement proper transaction status tracking.

## Implementation Approach

### 1. Create New XCM Execution Hook

**File**: `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts` (NEW)

Replace `useAssetConversionSwap` with a new hook that uses ParaSpell RouterBuilder for transaction execution.

**Key Features**:

- Use RouterBuilder's `.buildAndSend()` method from ParaSpell docs
- Integrate Kheopskit's `selectedAccount.polkadotSigner` directly
- Track transaction status via `.onStatusChange()` callback
- Handle multi-step transactions (TRANSFER → SWAP → TRANSFER back)
- Support dry-run simulation before execution

**Interface**:

```typescript
interface UseXcmSwapExecutionProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  slippageTolerance: number;
  walletAddress: string;
  polkadotSigner: PolkadotSigner | undefined;
  
  // Helpers from useXcmTokens
  getOptimalExchanges: (fromKey: string, toKey: string, fromChain: string, toChain: string) => TExchangeChain[];
  determineCurrency: (asset: TAssetInfo) => any;
  getTAssetFromKey: (key: string, direction: 'from' | 'to') => TAssetInfo | undefined;
  
  // Callbacks
  onSimulationComplete?: (result: SimulationResult) => Promise<boolean>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseXcmSwapExecutionReturn {
  executeSwap: () => Promise<void>;
  isSwapping: boolean;
  swapStatus: string | null;
  swapError: Error | null;
  currentTransactionType: TRouterEventType | null;
  currentStep: number;
  totalSteps: number;
}
```

**Implementation Steps**:

1. **Dry-run Simulation Phase** (before showing confirmation):

   - Call `RouterBuilder().getXcmFees()` with wallet address (already done in `useXcmRoute`)
   - Parse `TRouterXcmFeeResult` for error indicators
   - Check `feeResult.origin.result?.feeType === 'dryRun'` and `feeResult.hops[].result.feeType === 'dryRun'`
   - If dry-run succeeded, create `SimulationResult` with `willSucceed: true`
   - If fees couldn't be calculated or errors present, set `willSucceed: false` with error message
   - Pass to `onSimulationComplete` callback

2. **Transaction Execution** (after user confirms):
   ```typescript
   const exchangesToUse = getOptimalExchanges(
     inputToken.assetKey,
     outputToken.assetKey,
     inputToken.networkChain,
     outputToken.networkChain
   );
   
   const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
   const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');
   
   const amountInSmallestUnit = toSmallestUnit(inputAmount, inputToken.decimals);
   
   await RouterBuilder()
     .from(inputToken.networkChain as TChain)
     .to(outputToken.networkChain as TChain)
     .exchange(exchangesToUse)
     .currencyFrom(determineCurrency(fromAsset))
     .currencyTo(determineCurrency(toAsset))
     .amount(amountInSmallestUnit)
     .slippagePct(slippageTolerance.toString())
     .senderAddress(walletAddress)
     .recipientAddress(walletAddress) // Same as sender for now
     .signer(polkadotSigner) // From Kheopskit
     .onStatusChange((status: TRouterEvent) => {
       // Update UI with current transaction status
       console.log(`Step ${status.currentStep + 1}: ${status.type}`);
       console.log(`Chain: ${status.chain} → ${status.destinationChain}`);
       setCurrentTransactionType(status.type);
       setCurrentStep(status.currentStep || 0);
       setTotalSteps(status.routerPlan?.length || 0);
       
       // Update swap status message
       if (status.type === 'TRANSFER') {
         setSwapStatus('Transferring assets to exchange...');
       } else if (status.type === 'SWAP') {
         setSwapStatus('Swapping on DEX...');
       } else if (status.type === 'SWAP_AND_TRANSFER') {
         setSwapStatus('Swapping and transferring back...');
       }
     })
     .buildAndSend();
   ```

3. **Error Handling**:

   - Wrap in try-catch block
   - Parse ParaSpell errors into user-friendly messages
   - Show toast notifications for each transaction step
   - Handle user rejection (wallet signature cancelled)

4. **Success Handling**:

   - Call `onSuccess()` callback
   - Show success toast with transaction details
   - Reset swap state

### 2. Update SwapContainer Integration

**File**: `apps/web/src/components/swap/SwapContainer.tsx`

**Changes**:

1. Import new hook:
```typescript
import { useXcmSwapExecution } from '@/components/swap/hooks/useXcmSwapExecution'
```

2. Get polkadotSigner from selectedAccount:
```typescript
const { selectedAccount } = useSelectedAccount();
const polkadotSigner = selectedAccount?.polkadotSigner;
```

3. Replace `useAssetConversionSwap` with `useXcmSwapExecution`:
```typescript
const {
  executeSwap,
  isSwapping,
  swapStatus,
  swapError,
  currentTransactionType,
  currentStep,
  totalSteps
} = useXcmSwapExecution({
  inputToken,
  outputToken,
  inputAmount,
  slippageTolerance,
  walletAddress,
  polkadotSigner,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
  onSimulationComplete: handleSimulationComplete,
  onSuccess: () => {
    setInputAmount('');
    resetRoute();
    resetConfirmationState();
  },
  onError: (error) => {
    setInputAmount('');
    resetRoute();
    setIsSwapping(false);
    resetConfirmationState();
  }
});
```

4. Update `handleConfirmSwap` in `useSwapConfirmation`:
```typescript
const handleConfirmSwap = useCallback(() => {
  setIsConfirmingSwap(true);
  setIsSwappingInProgress(true);
  setShowConfirmation(false);
  
  // Call executeSwap from useXcmSwapExecution
  executeSwap().then(() => {
    setIsSwapComplete(true);
    setIsSwappingInProgress(false);
  }).catch(() => {
    setIsSwappingInProgress(false);
  });
  
  if (window.swapConfirmResolve) {
    window.swapConfirmResolve(true);
    window.swapConfirmResolve = undefined;
  }
}, [executeSwap]);
```


### 3. Update SwapConfirmSheet for Simulation

**File**: `apps/web/src/components/swap/ui/SwapConfirmSheet.tsx`

**Changes**:

1. Display dry-run simulation results:
```typescript
// Show warning if simulation indicates potential failure
{simulationResult && !simulationResult.willSucceed && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
    <div className="flex items-start gap-2">
      <AlertCircle className="text-red-400 w-5 h-5 mt-0.5" />
      <div>
        <p className="text-red-400 font-medium text-sm">Transaction may fail</p>
        <p className="text-red-300/70 text-xs mt-1">
          {simulationResult.error || 'Dry-run simulation indicates this swap might not succeed'}
        </p>
      </div>
    </div>
  </div>
)}
```

2. Display fee breakdown from simulation:

   - Use existing `estimatedFee` from `simulationResult`
   - Already displays multi-currency fees from Phase 2

3. Disable confirm button if simulation failed:

   - Already implemented: `isButtonDisabled` checks `simulationResult.willSucceed === false`

### 4. Update SwapCompleteDialog for Multi-Step Progress

**File**: `apps/web/src/components/swap/ui/SwapCompleteDialog.tsx`

**Enhancement**: Show current transaction step during multi-step swaps

```typescript
interface SwapCompleteDialogProps {
  // ... existing props
  currentStep?: number;
  totalSteps?: number;
  currentTransactionType?: TRouterEventType;
}

// Display progress: "Step 2 of 3: Swapping on HydrationDex"
{isSwappingInProgress && currentStep !== undefined && totalSteps > 1 && (
  <p className="text-sm text-white/60 mt-2">
    Step {currentStep + 1} of {totalSteps}: {formatTransactionType(currentTransactionType)}
  </p>
)}
```

### 5. Remove DUMMY_WALLET_ADDRESS

**File**: `apps/web/src/components/swap/hooks/useXcmRoute.ts`

**Changes**:

1. Remove dummy wallet constant:
```typescript
// DELETE THIS:
const DUMMY_WALLET_ADDRESS = '5EWNeodpcQ6iYibJ3jmWVe85nsok1EDG8Kk3aFg8ZzpfY1qX';
```

2. Update fee calculation to use real wallet address:
```typescript
// In fetchRoute function, replace:
const addressToUse = walletAddress || DUMMY_WALLET_ADDRESS;

// With validation:
if (!walletAddress) {
  console.warn('⚠️ No wallet connected, skipping fee calculation');
  setIsLoadingFees(false);
  setEstimatedFees('—');
  // Still fetch quote but skip fees
  return;
}

// Use walletAddress directly:
.senderAddress(walletAddress)
.recipientAddress(walletAddress)
```

3. Update hook to require wallet address for fees:

   - Quote fetching works without wallet
   - Fee fetching requires connected wallet
   - UI shows "Connect wallet to see fees" if not connected

### 6. Enhanced Error Handling from Dry-Run

**File**: `apps/web/src/services/xcm-router/feeCalculator.ts`

**Enhancement**: Add dry-run error detection

```typescript
export interface SimulationResult {
  success: boolean;
  estimatedFee: string;
  feeBreakdown?: FeeSummary;
  willSucceed: boolean;
  error?: string;
}

export const validateDryRunResults = (feeResult: TRouterXcmFeeResult): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Check if origin fee calculation failed
  if (feeResult.origin.result?.feeType !== 'dryRun') {
    errors.push('Origin fee estimation failed (no dry-run)');
  }
  
  // Check destination
  if (feeResult.destination.result?.feeType !== 'dryRun') {
    errors.push('Destination fee estimation failed (no dry-run)');
  }
  
  // Check hops
  feeResult.hops.forEach((hop, index) => {
    if (hop.result.feeType !== 'dryRun') {
      errors.push(`Hop ${index + 1} (${hop.chain}) fee estimation failed`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

## Design Decisions

### Why RouterBuilder.buildAndSend() over manual transaction building?

**Chosen**: Use ParaSpell's `.buildAndSend()` method ([source](https://paraspell.github.io/docs/router/router-use.html#manual-exchange-selection))

**Reasoning**:

- Handles all XCM complexity automatically (multi-hop transfers, DEX interactions)
- Provides `.onStatusChange()` callback for transaction progress tracking
- Supports 8 DEX exchanges (Hydration, AssetHub, Acala, Bifrost, etc.)
- Automatic chain connection management
- Built-in error handling and retry logic
- Same API we used for quotes and fees (consistency)

**Trade-off**:

- Less control over individual transactions
- Relies on ParaSpell's transaction building logic
- BUT: Significantly reduces implementation complexity and maintenance burden

### Why use Kheopskit's polkadotSigner directly?

**Chosen**: Use `selectedAccount.polkadotSigner` from Kheopskit

**Reasoning**:

- Kheopskit already provides PolkadotSigner compatible with polkadot-api
- ParaSpell's RouterBuilder accepts PolkadotSigner type
- No conversion needed (unlike current pjs-signer approach)
- Consistent with Phase 1/2 wallet integration

**Implementation**:

```typescript
const { selectedAccount } = useSelectedAccount();
const polkadotSigner = selectedAccount?.polkadotSigner;

// Pass directly to RouterBuilder
.signer(polkadotSigner)
```

### Simulation Strategy: Use getXcmFees dry-run results

**Chosen**: Leverage existing `getXcmFees()` call in `useXcmRoute` for simulation

**Reasoning**:

- ParaSpell already performs dry-run when calculating fees
- `TRouterXcmFeeResult` includes `feeType: 'dryRun'` when successful
- No additional API call needed (already fetching in Phase 2)
- Can detect failures by checking if `feeType !== 'dryRun'`

**Implementation**:

```typescript
// In useXcmRoute, after fee calculation:
const simulationValid = validateDryRunResults(feeResult);
const simulationResult: SimulationResult = {
  success: simulationValid.isValid,
  estimatedFee: formatFeeSummary(feeSummary),
  feeBreakdown: feeSummary,
  willSucceed: simulationValid.isValid,
  error: simulationValid.errors.join('; ')
};

// Pass to SwapConfirmSheet via onSimulationComplete callback
```

## Files to Modify

### New Files

- `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts` (~250 lines)

### Modified Files

- `apps/web/src/components/swap/SwapContainer.tsx` - Replace useAssetConversionSwap
- `apps/web/src/components/swap/hooks/useSwapConfirmation.ts` - Update handleConfirmSwap
- `apps/web/src/components/swap/ui/SwapConfirmSheet.tsx` - Add simulation warnings
- `apps/web/src/components/swap/ui/SwapCompleteDialog.tsx` - Add multi-step progress
- `apps/web/src/components/swap/hooks/useXcmRoute.ts` - Remove dummy wallet address
- `apps/web/src/services/xcm-router/feeCalculator.ts` - Add dry-run validation

### Files to Deprecate (after testing)

- `apps/web/src/components/swap/hooks/useAssetConversionSwap.ts` - No longer needed
- `apps/web/src/components/swap/hooks/builders/` - Directory no longer needed
- `apps/web/src/components/swap/hooks/monitoring/` - Directory no longer needed
- `apps/web/src/components/swap/hooks/utils/assetUtils.ts` - No longer needed

## Success Criteria

### Functional Requirements

- Wallet connects and provides PolkadotSigner to RouterBuilder
- Clicking "Swap" shows confirmation dialog with simulation results
- Simulation shows warnings if dry-run indicates failure
- User confirms → wallet prompts for signature
- Multi-step transactions show progress (Step X of Y)
- Success state shows completion dialog
- Errors show user-friendly messages

### Non-Functional Requirements

- No TypeScript errors
- No use of DUMMY_WALLET_ADDRESS
- Proper loading states during execution
- Toast notifications for transaction progress
- Clean console logs for debugging
- No breaking changes to Phase 1/2 functionality

## Testing Checklist

1. **Wallet Integration**:

   - [ ] Connect Polkadot wallet (Talisman/SubWallet)
   - [ ] Verify polkadotSigner is passed to RouterBuilder
   - [ ] Test wallet disconnect handling

2. **Simulation Flow**:

   - [ ] Select tokens and enter amount
   - [ ] Verify dry-run simulation runs during fee calculation
   - [ ] Check simulation results show in confirmation dialog
   - [ ] Test with potentially failing swap (insufficient balance)

3. **Transaction Execution**:

   - [ ] Single-hop swap (AssetHub DOT → USDC)
   - [ ] Multi-hop swap (Polkadot DOT → Astar ASTR via Hydration)
   - [ ] Verify onStatusChange callback updates UI
   - [ ] Check transaction progress shows correctly

4. **Error Handling**:

   - [ ] User rejects signature → proper error message
   - [ ] Network error during execution → retry or clear error
   - [ ] Insufficient balance → shown in simulation

5. **Success Flow**:

   - [ ] Swap completes → success dialog shows
   - [ ] Input amount resets
   - [ ] Route state clears
   - [ ] Can perform another swap immediately

## Notes

- Keep `useAssetConversionSwap` temporarily for reference during development
- Delete old transaction builders after Phase 3 is tested and stable
- Monitor ParaSpell console logs for transaction details
- Document any ParaSpell API quirks or limitations discovered

### To-dos

- [ ] Create useXcmSwapExecution.ts hook with RouterBuilder.buildAndSend() integration
- [ ] Add validateDryRunResults function to feeCalculator.ts for simulation error detection
- [ ] Remove DUMMY_WALLET_ADDRESS from useXcmRoute.ts and require real wallet for fees
- [ ] Replace useAssetConversionSwap with useXcmSwapExecution in SwapContainer.tsx
- [ ] Update handleConfirmSwap in useSwapConfirmation.ts to call executeSwap
- [ ] Add simulation warning display to SwapConfirmSheet.tsx
- [ ] Add multi-step progress display to SwapCompleteDialog.tsx
- [ ] Test complete swap flow from wallet connect through execution to success