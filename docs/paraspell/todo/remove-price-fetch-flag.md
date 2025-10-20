I'll add a flag to disable price fetching so you can test the swap signing immediately. Let me modify the `useXcmRoute` hook to add a bypass option:

 I've added a `skipPriceFetch` flag that bypasses the price/fee fetching. Here's what I did:

## ✅ Changes Made:

### 1. **Added `skipPriceFetch` flag to `useXcmRoute`**
   - New optional parameter: `skipPriceFetch?: boolean`
   - Default is `false` (normal behavior)
   - When `true`, it returns mock data immediately

### 2. **Mock Data Behavior** (when `skipPriceFetch=true`):
   - **Output Amount**: Same as input amount
   - **Route DEX**: "HydrationDex (mock)"
   - **Estimated Fees**: "0.001 DOT (mock)"
   - **No API calls**: Instant response
   - **Console log**: Shows "⏭️ Skipping price fetch (skipPriceFetch=true)"

### 3. **Enabled in SwapContainer**:
   ```typescript
   skipPriceFetch: true, // 🔥 TEMPORARY: Skip price fetch for testing swap signing
   ```

## 🎯 Now You Can Test Swap Signing Immediately:

1. **Enter an amount** → Output appears instantly (mock data)
2. **Click "Swap"** → Confirmation dialog opens immediately
3. **Click "Confirm Swap"** → Wallet signature prompt appears
4. **Sign the transaction** → Real XCM swap execution starts

## 🔄 To Re-enable Price Fetching Later:

Simply change in `SwapContainer.tsx`:
```typescript
skipPriceFetch: false, // or remove the line entirely
```

The mock data will let you test the entire swap signing flow without waiting for ParaSpell API calls. The actual swap execution will still use real data from the RouterBuilder when you sign the transaction! 🚀