# Chainflip API Fixes Applied

**Date**: 2025-12-31
**Status**: ✅ All critical API issues fixed

---

## Summary

Fixed all critical API compliance issues identified in the audit. The implementation now matches the official Chainflip BaaS API specification.

---

## Fixes Applied

### 1. ✅ Fixed POST /swap → GET /swap

**Issue**: Using POST with JSON body instead of GET with query parameters

**Files Changed**:
- [apps/web/src/services/chainflip/client.ts](apps/web/src/services/chainflip/client.ts#L143-L168)

**Changes**:
```typescript
// BEFORE (Wrong)
async requestSwapDepositAddress(request: ChainflipSwapRequest) {
  const body = { /* ... */ };
  return await this.post('/swap', body);
}

// AFTER (Correct)
async requestSwapDepositAddress(request: ChainflipSwapRequest) {
  const params = {
    sourceAsset: request.sourceAsset,
    destinationAsset: request.destinationAsset,
    destinationAddress: request.destinationAddress,
    minimumPrice: request.minimumPrice,
    refundAddress: request.refundAddress,
    retryDurationBlocks: request.retryDurationBlocks.toString(),
    boostFee: request.boostFee?.toString(),
    commissionBps: request.commissionBps?.toString(),
  };
  return await this.get('/swap', params);
}
```

---

### 2. ✅ Fixed Status Endpoint Path

**Issue**: Using `/swap/{id}` instead of `/status-by-id`

**Files Changed**:
- [apps/web/src/services/chainflip/client.ts](apps/web/src/services/chainflip/client.ts#L176-L184)

**Changes**:
```typescript
// BEFORE (Wrong)
async getSwapStatus(swapId: string) {
  return await this.get(`/swap/${swapId}`);
}

// AFTER (Correct)
async getSwapStatus(swapId: string | number) {
  const params = { swapId: swapId.toString() };
  return await this.get('/status-by-id', params);
}
```

---

### 3. ✅ Updated ChainflipSwapResponse Type

**Issue**: Field names and types didn't match API response

**Files Changed**:
- [apps/web/src/services/chainflip/types.ts](apps/web/src/services/chainflip/types.ts#L101-L111)

**Changes**:
```typescript
// BEFORE (Wrong)
export interface ChainflipSwapResponse {
  id: string;  // ❌ Should be number
  depositAddress: string;  // ❌ API returns 'address'
  depositChannel: ChainflipDepositChannel;  // ❌ Missing many fields
  estimatedEgressAmount: string;
  estimatedEgressAmountNative: string;
}

// AFTER (Correct)
export interface ChainflipSwapResponse {
  id: number;
  address: string;
  issuedBlock: number;
  network: string;
  channelId: number;
  sourceExpiryBlock: number;
  explorerUrl: string;
  channelOpeningFee: number;
  channelOpeningFeeNative: string;
}
```

---

### 4. ✅ Fixed Swap State Enum

**Issue**: State names didn't match API response values

**Files Changed**:
- [apps/web/src/services/chainflip/types.ts](apps/web/src/services/chainflip/types.ts#L117-L128)

**Changes**:
```typescript
// BEFORE (Wrong - uppercase with underscores)
export type ChainflipSwapState =
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_RECEIVED'
  | 'SWAP_EXECUTING'
  | 'EGRESS_SCHEDULED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

// AFTER (Correct - lowercase, matches API)
export type ChainflipSwapState =
  | 'waiting'      // Waiting for deposit
  | 'receiving'    // Deposit received, being confirmed
  | 'swapping'     // Executing the swap
  | 'sending'      // Preparing to send output
  | 'sent'         // Output transaction sent
  | 'completed'    // Swap completed successfully
  | 'failed';      // Swap failed
```

---

### 5. ✅ Expanded ChainflipSwapStatus Type

**Issue**: Missing many fields from API response

**Files Changed**:
- [apps/web/src/services/chainflip/types.ts](apps/web/src/services/chainflip/types.ts#L130-L174)

**Changes**:
```typescript
// BEFORE (Incomplete)
export interface ChainflipSwapStatus {
  state: ChainflipSwapState;
  sourceAsset: ChainflipAssetId;
  destinationAsset: ChainflipAssetId;
  depositAmount?: string;
  egressAmount?: string;
  txHash?: string;
  error?: string;
  refundTxHash?: string;
}

// AFTER (Comprehensive)
export interface ChainflipSwapStatus {
  // Core swap info
  id: number;
  state: ChainflipSwapState;
  sourceAsset: ChainflipAssetId;
  destinationAsset: ChainflipAssetId;
  destinationAddress: string;

  // Deposit channel info
  depositChannel?: {
    id: number;
    network: string;
    issuedBlock: number;
    channelId: number;
    depositAddress: string;
    expiryBlock: number;
    estimatedExpiryTime: string;
  };

  // Deposit transaction
  depositTransaction?: {
    hash: string;
    witnessedAt: string;
  };
  depositAmount?: string;
  depositAmountNative?: string;

  // Swap execution
  swapExecutedAt?: string;
  intermediateAmount?: string;

  // Egress info
  egressAmount?: string;
  egressAmountNative?: string;
  egressTransaction?: {
    hash: string;
  };

  // Fees
  fees?: ChainflipFee[];

  // Error handling
  error?: string;
  failureReason?: string;
}
```

---

### 6. ✅ Updated useChainflipExecution Hook

**Issue**: Using old response field names and state values

**Files Changed**:
- [apps/web/src/components/swap/hooks/useChainflipExecution.ts](apps/web/src/components/swap/hooks/useChainflipExecution.ts)

**Changes Made**:

#### Response Field Updates (Lines 362-371)
```typescript
// BEFORE
setDepositAddress(swapResponse.depositAddress);
setSwapId(swapResponse.id);

// AFTER
setDepositAddress(swapResponse.address);
setSwapId(swapResponse.id.toString());
```

#### Deposit Address Usage (Lines 400, 416, 434)
```typescript
// Updated all deposit function calls to use swapResponse.address
sendEvmNativeDeposit(evmSigner, swapResponse.address, ...)
sendEvmTokenDeposit(evmSigner, swapResponse.address, ...)
sendPolkadotDeposit(polkadotSigner, swapResponse.address, ...)
```

#### Status Polling State Mapping (Lines 211-262)
```typescript
// BEFORE (Wrong state names)
switch (status.state) {
  case 'AWAITING_DEPOSIT':
  case 'DEPOSIT_RECEIVED':
  case 'SWAP_EXECUTING':
  case 'EGRESS_SCHEDULED':
  case 'COMPLETED':
  case 'FAILED':
  case 'REFUNDED':
}

// AFTER (Correct state names)
switch (status.state) {
  case 'waiting':
  case 'receiving':
  case 'swapping':
  case 'sending':
  case 'sent':
  case 'completed':
  case 'failed':
}
```

#### Transaction Hash Retrieval
```typescript
// BEFORE
txHash: status.txHash

// AFTER
txHash: status.depositTransaction?.hash || status.egressTransaction?.hash
```

---

### 7. ✅ Added Optional Parameters Support

**Files Changed**:
- [apps/web/src/services/chainflip/types.ts](apps/web/src/services/chainflip/types.ts#L95-L98)
- [apps/web/src/services/chainflip/client.ts](apps/web/src/services/chainflip/client.ts#L160-L162)

**Changes**:
```typescript
// Added to ChainflipSwapRequest interface
export interface ChainflipSwapRequest {
  // ... existing fields
  boostFee?: number;
  commissionBps?: number;  // NEW
  numberOfChunks?: number;  // NEW (DCA)
  chunkIntervalBlocks?: number;  // NEW (DCA)
}

// Added to client
if (request.commissionBps !== undefined) {
  params.commissionBps = request.commissionBps.toString();
}
```

---

## Testing Checklist

Before testing with real funds, verify:

- [ ] GET /quotes returns valid quote data
- [ ] GET /swap returns channel info with `address` field
- [ ] Deposit address is valid for the source chain
- [ ] GET /status-by-id returns status with lowercase states
- [ ] Status polling recognizes all states: `waiting`, `receiving`, `swapping`, `sending`, `sent`, `completed`, `failed`
- [ ] Transaction hashes are correctly extracted from `depositTransaction.hash` and `egressTransaction.hash`
- [ ] Slippage protection parameters are sent correctly
- [ ] Channel expiry is calculated from `sourceExpiryBlock`

---

## Impact

### Before Fixes
- ❌ Swap initiation would fail (404 on POST /swap)
- ❌ Status polling would fail (404 on /swap/{id})
- ❌ State recognition would fail (uppercase vs lowercase mismatch)
- ❌ Response parsing would fail (missing/wrong field names)

### After Fixes
- ✅ All API calls use correct HTTP methods
- ✅ All endpoints use correct paths
- ✅ All parameters sent as query params (not body)
- ✅ All response types match API schema
- ✅ All state transitions recognized correctly
- ✅ Ready for production testing

---

## References

- [API Compliance Audit](./API_COMPLIANCE_AUDIT.md)
- [Chainflip BaaS API Documentation](https://docs.chainflip-broker.io/)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

---

## Next Steps

1. Test on **testnet** (Perseverance) with API URL: `https://perseverance.chainflip-broker.io`
2. Verify all swap flows:
   - ETH → USDC (Ethereum → Arbitrum)
   - DOT → USDC (AssetHub → Arbitrum)
   - USDC → ETH (Ethereum → Ethereum)
3. Monitor status transitions in console logs
4. Verify transaction hashes appear correctly
5. Test slippage protection by setting tight tolerance
6. Once testnet passes, switch to production URL: `https://chainflip-broker.io`
