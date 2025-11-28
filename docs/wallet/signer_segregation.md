# Signer Segregation Implementation Guide

## Overview

This document explains how sender and recipient wallet signers are segregated and routed in the XCM swap execution flow, particularly for cross-platform swaps between EVM parachains and Substrate chains.

## Understanding Kheopskit Account Structure

Kheopskit provides a unified account interface that distinguishes between platforms:

```typescript
interface KheopskitAccount {
  id: string;
  address: string;
  name?: string;
  platform: "polkadot" | "ethereum";  // Platform identifier
  walletName: string;
  polkadotSigner?: any;  // Available for Polkadot platform accounts
  client?: any;          // Available for Ethereum platform accounts
}
```

### Key Insight: EVM Parachains Use Polkadot Signers

**Important:** EVM parachains (Moonbeam, Moonriver, Astar, Shiden) are Substrate chains with EVM compatibility:
- Users connect via **Polkadot wallets** (Talisman, SubWallet)
- Accounts have `platform: "polkadot"` with `polkadotSigner`
- These wallets provide `polkadotSigner`, which works for both Substrate and EVM operations
- **NOT** pure EVM wallets like MetaMask

## ParaSpell RouterBuilder Signer Requirements

ParaSpell's RouterBuilder uses **two** `PolkadotSigner` parameters:

```typescript
type TTransferOptions = {
  signer: PolkadotSigner;           // Main signer for XCM beneficiary construction
  evmSigner?: PolkadotSigner;       // EVM signer for EVM parachain transactions
  senderAddress: string;             // Sender's address
  evmSenderAddress?: string;         // Sender's EVM address (for EVM chains)
  recipientAddress: string;          // Recipient's address
}
```

**Critical:** Both `.signer()` and `.evmSigner()` expect `PolkadotSigner` type, NOT pure EVM clients!

## Signer Routing Strategy

### Swap Type Matrix

| Swap Type | Origin | Destination | `.evmSigner()` | `.signer()` | `.senderAddress()` |
|-----------|--------|-------------|----------------|-------------|--------------------|
| **Same Platform** | Substrate | Substrate | N/A | Sender's polkadotSigner | Sender's address |
| **Same Platform** | EVM Parachain | EVM Parachain | Sender's polkadotSigner | Sender's polkadotSigner | Recipient's address* |
| **Cross-Platform** | EVM Parachain | Substrate | Sender's polkadotSigner | **Recipient's** polkadotSigner | Recipient's address* |
| **Cross-Platform** | Substrate | EVM Parachain | N/A | Sender's polkadotSigner | Sender's address |

**Note:** For EVM origin chains, `.senderAddress()` is set to recipient's address for proper XCM routing.

## Implementation Details

### 1. SwapContainer.tsx - Signer Extraction

**Location:** `apps/web/src/components/swap/SwapContainer.tsx`

```typescript
// Extract sender's polkadotSigner
const senderPolkadotSigner = selectedAccount && 'polkadotSigner' in selectedAccount 
  ? selectedAccount.polkadotSigner 
  : undefined

// Extract recipient's polkadotSigner
const recipientPolkadotSigner = recipientAccount && 'polkadotSigner' in recipientAccount
  ? recipientAccount.polkadotSigner
  : undefined

// Pass BOTH signers separately to useXcmSwapExecution
const { executeSwap } = useXcmSwapExecution({
  // ... other props ...
  senderPolkadotSigner,     // Sender's signer (signs transactions)
  recipientPolkadotSigner,  // Recipient's signer (XCM beneficiary construction)
  // ... other props ...
});
```

**Key Principle:** Extract both signers separately and let the execution hook handle routing logic.

### 2. useXcmSwapExecution.ts - Signer Routing Logic

**Location:** `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts`

#### Step 1: Detect Cross-Platform Swaps

```typescript
const isOriginSubstrateEvm = isSubstrateEvmChain(inputToken.networkChain);
const isDestinationSubstrateEvm = isSubstrateEvmChain(outputToken.networkChain);
const isCrossPlatformSwap = isOriginSubstrateEvm !== isDestinationSubstrateEvm;
```

#### Step 2: Validate Signers

```typescript
// Sender's signer always required (commented out in current implementation)
// if (!senderPolkadotSigner) {
//   onError?.({
//     message: `${inputToken.networkChain} requires a Polkadot wallet`,
//     code: 'MISSING_SENDER_POLKADOT_SIGNER'
//   });
//   return;
// }

// Recipient's signer required for cross-platform swaps
if (isCrossPlatformSwap && !recipientPolkadotSigner) {
  onError?.({
    message: `Cross-chain swap requires a Polkadot wallet as recipient`,
    code: 'MISSING_RECIPIENT_POLKADOT_SIGNER_CROSS_PLATFORM'
  });
  return;
}
```

#### Step 3: Route Signers Based on Swap Type

```typescript
// Determine which signer to use for XCM beneficiary construction
const xcmBeneficiarySigner = isCrossPlatformSwap && recipientPolkadotSigner
  ? recipientPolkadotSigner  // Use recipient's for cross-platform
  : senderPolkadotSigner;     // Use sender's for same-platform
```

#### Step 4: Configure RouterBuilder

**For EVM Origin Chains:**

```typescript
if (isOriginEvm) {
  await RouterBuilder(routerConfig)
    .from(inputToken.networkChain as any)
    .to(outputToken.networkChain as any)
    .exchange(exchanges as any)
    .currencyFrom(determineCurrency(fromAsset))
    .currencyTo(determineCurrency(toAsset))
    .amount(inputAmount)
    .slippagePct(safeSlippage.toString())
    .senderAddress(recipientAddress)           // ⚠️ Recipient's address for XCM routing
    .recipientAddress(recipientAddress)        // Recipient's address
    .evmSenderAddress(walletAddress)           // Sender's EVM address
    .evmSigner(senderPolkadotSigner!)          // ✅ SENDER signs EVM transaction
    .signer(xcmBeneficiarySigner!)             // ✅ Appropriate signer for XCM beneficiary
    .onStatusChange(onStatusChange)
    .build();
}
```

**For Substrate Origin Chains:**

```typescript
else {
  await RouterBuilder(routerConfig)
    .from(inputToken.networkChain as any)
    .to(outputToken.networkChain as any)
    .exchange(exchanges as any)
    .currencyFrom(determineCurrency(fromAsset))
    .currencyTo(determineCurrency(toAsset))
    .amount(inputAmount)
    .slippagePct(safeSlippage.toString())
    .senderAddress(walletAddress)              // Sender's address
    .recipientAddress(recipientAddress)        // Recipient's address
    .signer(senderPolkadotSigner!)             // ✅ SENDER signs Substrate transaction
    .onStatusChange(onStatusChange)
    .build();
}
```

## Practical Examples

### Example 1: Cross-Platform Swap (Moonbeam → AssetHub)

**Scenario:**
- Sender: Talisman wallet on Moonbeam
- Recipient: SubWallet on AssetHub

**Signer Routing:**
```typescript
.evmSigner(senderPolkadotSigner)      // Talisman signs Moonbeam EVM transaction
.signer(recipientPolkadotSigner)      // SubWallet constructs AssetHub beneficiary
.senderAddress(recipientAddress)      // Recipient's address for XCM routing
.evmSenderAddress(walletAddress)      // Sender's Moonbeam address
```

### Example 2: Same-Platform Swap (AssetHub → Hydration)

**Scenario:**
- Sender: Talisman wallet on AssetHub
- Recipient: Same or different Substrate address

**Signer Routing:**
```typescript
.signer(senderPolkadotSigner)         // Talisman signs AssetHub transaction
.senderAddress(walletAddress)         // Sender's AssetHub address
.recipientAddress(recipientAddress)   // Recipient's Hydration address
```

### Example 3: Same-Platform EVM Swap (Moonbeam → Moonriver)

**Scenario:**
- Sender: Talisman wallet on Moonbeam
- Recipient: Same or different address on Moonriver

**Signer Routing:**
```typescript
.evmSigner(senderPolkadotSigner)      // Talisman signs Moonbeam transaction
.signer(senderPolkadotSigner)         // Talisman constructs beneficiary
.senderAddress(recipientAddress)      // Recipient's address for XCM routing
.evmSenderAddress(walletAddress)      // Sender's Moonbeam address
```

## Key Principles

### 1. Always Segregate Signers

❌ **Don't merge signers in parent component:**
```typescript
// BAD: Merging logic in SwapContainer
const polkadotSigner = isCrossPlatformSwap 
  ? recipientPolkadotSigner 
  : senderPolkadotSigner;
```

✅ **Pass both separately:**
```typescript
// GOOD: Let execution hook handle routing
useXcmSwapExecution({
  senderPolkadotSigner,
  recipientPolkadotSigner,
  // ...
});
```

### 2. Understand Signer Roles

| Signer Parameter | Purpose | Used For |
|-----------------|---------|----------|
| `.evmSigner()` | Signs EVM transactions | Sender's transaction on EVM parachains |
| `.signer()` | Constructs XCM beneficiary | Cross-platform: Recipient's wallet<br>Same-platform: Sender's wallet |

### 3. Address Routing for EVM Origins

For EVM origin chains, `.senderAddress()` is set to **recipient's address** for proper XCM routing:

```typescript
.senderAddress(recipientAddress)      // ⚠️ Recipient's address, not sender's
.evmSenderAddress(walletAddress)      // Sender's actual EVM address
```

This is a ParaSpell requirement for EVM → Substrate XCM routing.

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `MISSING_SENDER_POLKADOT_SIGNER` | Sender's Polkadot signer required | Connect Polkadot wallet (Talisman/SubWallet) |
| `MISSING_RECIPIENT_POLKADOT_SIGNER_CROSS_PLATFORM` | Cross-platform swap needs recipient's Polkadot signer | Select connected Polkadot wallet as recipient |

## Testing Scenarios

- [ ] **Moonbeam → AssetHub** with Talisman sender + SubWallet recipient
- [ ] **Moonbeam → Hydration** with Talisman sender + Talisman recipient (same wallet)
- [ ] **AssetHub → Moonbeam** with SubWallet sender + Talisman recipient
- [ ] **AssetHub → Hydration** with Talisman sender (same-platform)
- [ ] **Moonbeam → Moonriver** with Talisman sender (EVM-to-EVM)
- [ ] Cross-platform swap with missing recipient signer (should show error)
- [ ] Same-platform swap with only sender signer (should work)

## Related Files

- `apps/web/src/components/swap/SwapContainer.tsx` - Signer extraction
- `apps/web/src/components/swap/hooks/useXcmSwapExecution.ts` - Signer routing logic
- `apps/web/src/services/xcm-router/substrateEvmChains.ts` - Substrate EVM chain detection
- `apps/web/src/components/wallet/use-selected-account.ts` - Sender account management
- `apps/web/src/components/wallet/use-recipient-account.ts` - Recipient account management
- `docs/wallet/cross-platform-swap-implementation.md` - Cross-platform swap overview

## References

- [ParaSpell RouterBuilder API](https://paraspell.github.io/docs/sdk/xcmRouter.html)
- [Kheopskit Documentation](https://github.com/Kheopskit/kheopskit)
- [Polkadot.js API](https://polkadot.js.org/docs/)
