# Cross-Platform Swap Implementation (EVM ↔ Substrate)

## Overview

This document describes the implementation of cross-platform swaps between EVM chains (Moonbeam, Moonriver, Astar, Shiden) and Substrate chains (AssetHub, Hydration, etc.).

## The Challenge

When swapping FROM an EVM chain TO a Substrate chain (or vice versa), ParaSpell's RouterBuilder requires:
1. **EVM Signer** - To sign the transaction on the EVM origin chain
2. **Polkadot Signer** - To construct XCM beneficiary locations for Substrate addresses

This creates a **multi-wallet requirement** that needs careful UX design.

## Solution: Smart Signer Selection (Option 2)

We implemented a smart approach where:
- User connects their origin wallet (e.g., MetaMask for Moonbeam)
- User selects a **connected Polkadot wallet** as the recipient
- The recipient's Polkadot wallet provides both the destination address AND the required signer

### Key Benefits
✅ Users can send to different recipients  
✅ Only need recipient's wallet connected (which they likely have access to)  
✅ Recipient wallet provides both address AND signer  
✅ Clear error messages prevent confusion  
⚠️ Limitation: Recipient must be a connected wallet (custom address strings not supported)

## Implementation Details

### 1. SwapContainer.tsx - Signer Management

**Location:** `apps/web/src/components/swap/SwapContainer.tsx` (Lines 93-133)

```typescript
// Get polkadotSigner from recipient - used for cross-platform swaps
const recipientPolkadotSigner = recipientAccount && 'polkadotSigner' in recipientAccount
  ? recipientAccount.polkadotSigner
  : undefined

// Determine which Polkadot signer to use based on chain types
const polkadotSigner = useMemo(() => {
  // Check if this is a cross-platform swap
  const isEVMOrigin = inputToken?.networkChain && 
    ['Moonbeam', 'Moonriver', 'Astar', 'Shiden'].includes(inputToken.networkChain);
  const isSubstrateDestination = outputToken?.networkChain && 
    !['Moonbeam', 'Moonriver', 'Astar', 'Shiden'].includes(outputToken.networkChain);
  
  const isCrossPlatformSwap = isEVMOrigin && isSubstrateDestination;

  if (isCrossPlatformSwap && recipientPolkadotSigner) {
    // Use recipient's Polkadot signer for cross-platform swaps
    return recipientPolkadotSigner;
  }

  // Default: use sender's Polkadot signer
  return senderPolkadotSigner;
}, [inputToken?.networkChain, outputToken?.networkChain, recipientPolkadotSigner, senderPolkadotSigner]);
```

### 2. useXcmSwapExecution.ts - Enhanced Validation

**Location:** `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts` (Lines 290-340)

**Added Cross-Platform Detection:**
```typescript
const isOriginEvm = isEvmChain(inputToken.networkChain);
const isDestinationEvm = isEvmChain(outputToken.networkChain);
const isCrossPlatformSwap = isOriginEvm !== isDestinationEvm;
```

**Added Cross-Platform Validation:**
```typescript
if (isCrossPlatformSwap && !polkadotSigner) {
  const errorDetails: ErrorDetails = {
    message: `Cross-chain swap from ${inputToken.networkChain} to ${outputToken.networkChain} requires a Polkadot wallet. Please connect a Polkadot wallet (Talisman/SubWallet) as the recipient.`,
    code: 'MISSING_POLKADOT_SIGNER_CROSS_PLATFORM'
  };
  onError?.(errorDetails);
  return;
}
```

**RouterBuilder Configuration:**
```typescript
if (isOriginEvm) {
  await (RouterBuilder(routerConfig)
    // ... config ...
    .recipientAddress(recipientAddress)
    .signer(polkadotSigner!)           // From recipient for cross-platform
    .evmSenderAddress(walletAddress)   // EVM sender for transaction signing
    .evmSigner(evmSigner!) as any)     // EVM signer for transaction signing
    .onStatusChange(onStatusChange)
    .build();
}
```

### 3. UI Warning Banner

**Location:** `apps/web/src/components/swap/SwapContainer.tsx` (Lines 436-470)

A visual warning banner that:
- Detects cross-platform swaps automatically
- Shows different messages based on recipient configuration:
  - No Polkadot wallet selected → "requires a Polkadot wallet"
  - Custom address entered → "Custom addresses not supported"
  - Polkadot wallet selected → "This swap will use recipient's wallet"

```typescript
{inputToken?.networkChain && outputToken?.networkChain && (
  (() => {
    const isEVMOrigin = ['Moonbeam', 'Moonriver', 'Astar', 'Shiden'].includes(inputToken.networkChain);
    const isSubstrateDestination = !['Moonbeam', 'Moonriver', 'Astar', 'Shiden'].includes(outputToken.networkChain);
    const isCrossPlatformSwap = isEVMOrigin && isSubstrateDestination;

    if (!isCrossPlatformSwap) return null;

    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
        {/* Warning message */}
      </div>
    );
  })()
)}
```

## EVM Chain Detection

**File:** `apps/web/src/services/xcm-router/evmChains.ts`

```typescript
export const EVM_CHAINS = [
  // Polkadot Parachains
  'Moonbeam',
  'Astar',
  
  // Kusama Parachains
  'Moonriver',
  'Shiden',
] as const;

export function isEvmChain(chainName: string): boolean {
  return EVM_CHAINS.includes(chainName as EvmChain);
}
```

## User Flow Examples

### Example 1: Moonbeam → AssetHub (Happy Path)

1. User connects **MetaMask** (0x address)
2. User selects **Moonbeam → AssetHub** swap
3. UI shows warning: "This swap requires a Polkadot wallet"
4. User clicks recipient selector
5. User selects **Talisman wallet** with Substrate address as recipient
6. Warning updates: "This swap will use recipient's wallet"
7. User confirms swap
8. Transaction executes:
   - MetaMask signs on Moonbeam (using evmSigner)
   - Recipient's Talisman provides Polkadot signer for XCM construction
   - Assets arrive at recipient's Substrate address

### Example 2: Custom Address Error

1. User connects MetaMask
2. User selects Moonbeam → AssetHub
3. User tries to enter custom Substrate address
4. Warning shows: "Custom addresses not supported"
5. Swap button disabled until they select a connected wallet

### Example 3: Substrate → Substrate (Normal Flow)

1. User connects Talisman
2. User selects AssetHub → Hydration
3. No warning shown (not cross-platform)
4. Transaction proceeds normally with sender's signer

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `MISSING_EVM_SIGNER` | EVM origin requires Ethereum wallet | Connect MetaMask/Ethereum wallet |
| `MISSING_POLKADOT_SIGNER` | Substrate origin requires Polkadot wallet | Connect Talisman/SubWallet |
| `MISSING_POLKADOT_SIGNER_CROSS_PLATFORM` | Cross-platform swap needs Polkadot signer | Select connected Polkadot wallet as recipient |

## Testing Checklist

- [ ] Moonbeam → AssetHub with MetaMask + Talisman recipient
- [ ] Moonbeam → Hydration with MetaMask + SubWallet recipient
- [ ] AssetHub → Moonbeam with Talisman + MetaMask recipient
- [ ] Custom address blocked for cross-platform swaps
- [ ] Warning banner shows correct messages
- [ ] Error messages display properly
- [ ] Same-platform swaps unaffected (AssetHub → Hydration)
- [ ] EVM-to-EVM swaps work (if supported)

## Future Enhancements

1. **Address Conversion**: Implement automatic Ethereum ↔ Substrate address mapping for Moonbeam
2. **Dual Wallet Auto-Connect**: Automatically prompt to connect both wallets when cross-platform swap detected
3. **Recipient Suggestion**: Suggest connected Polkadot wallets when EVM origin selected
4. **Better UX**: Add step-by-step wizard for first-time cross-platform swaps

## Related Files

- `apps/web/src/components/swap/SwapContainer.tsx` - Main swap logic and signer selection
- `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts` - Transaction execution and validation
- `apps/web/src/services/xcm-router/evmChains.ts` - EVM chain detection utility
- `apps/web/src/components/wallet/use-recipient-account.ts` - Recipient account management
- `apps/web/src/components/swap/ui/SelectRecipientWalletDialog.tsx` - Recipient selection UI

## ParaSpell Documentation Reference

- RouterBuilder API: https://paraspell.github.io/docs/sdk/xcmRouter.html
- EVM Support: Requires both `.evmSigner()` + `.signer()` for cross-platform swaps

