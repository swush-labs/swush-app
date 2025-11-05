# 🔄 High-Level Overview: Tracking Cross-Chain Swap Transactions in Your dApp

## **Transaction Lifecycle Flow**

Here's how the entire cross-chain swap process works from start to finish:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PLANNING PHASE                                                │
│    - User initiates transfer()                                   │
│    - System validates parameters                                 │
│    - Selects best exchange (if not specified)                    │
│      └─> onStatusChange: type='SELECTING_EXCHANGE'              │
│    - Builds transaction plan (routerPlan)                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. EXECUTION PHASE (Loop through each transaction)              │
│                                                                   │
│    For each transaction in the plan:                             │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ a) Pre-Transaction Signal                             │    │
│    │    └─> onStatusChange: {                              │    │
│    │         type: 'TRANSFER' | 'SWAP' | 'SWAP_AND_TRANSFER',│  │
│    │         chain, destinationChain, currentStep           │    │
│    │       }                                                │    │
│    └──────────────────────────────────────────────────────┘    │
│                            ↓                                      │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ b) Balance & Fee Check (for Bifrost transfers)        │    │
│    │    - Calculates transaction fee                       │    │
│    │    - Verifies sufficient balance                      │    │
│    │    - Throws error if insufficient                     │    │
│    └──────────────────────────────────────────────────────┘    │
│                            ↓                                      │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ c) Transaction Submission (await submitTransaction)   │    │
│    │    - Triggers wallet signing popup                    │    │
│    │    - User signs transaction                           │    │
│    │    - Transaction submitted to chain                   │    │
│    │    - Waits for FINALIZATION (not just inclusion)      │    │
│    │    - Validates transaction success (event.ok)         │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                   │
│    Repeat for next transaction in plan...                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. COMPLETION PHASE                                              │
│    - All transactions finalized successfully                     │
│    - onStatusChange: type='COMPLETED'                           │
│    - Promise resolves                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## **🔑 Key Implementation Details**

### **1. Transaction Finalization is Guaranteed**
The current implementation **already ensures success** because:

- Each `submitTransaction()` call **waits for finalization** (not just inclusion in a block)
- Transactions are processed **sequentially** - next transaction only starts after previous one is finalized
- If any transaction fails (`event.ok === false`), the entire promise chain **rejects** and execution stops
- Cross-chain messages are handled by the underlying Polkadot XCM protocol

### **2. What Gets Tracked**

```typescript
// Transaction-level events
type: 'TRANSFER'           // XCM transfer between chains
type: 'SWAP'              // Token swap on DEX
type: 'SWAP_AND_TRANSFER' // Combined operation

// System-level events
type: 'SELECTING_EXCHANGE' // Finding best exchange
type: 'COMPLETED'          // All operations done
```

### **3. Typical Cross-Chain Swap Sequence**

A typical cross-chain swap might involve **2-3 transactions**:

```
Example: DOT on Polkadot → ASTR on Astar (via HydraDX)

Transaction 1: TRANSFER
  - Origin: Polkadot
  - Destination: HydraDX
  - Action: Send DOT to HydraDX
  - Status: onStatusChange(type='TRANSFER', chain='Polkadot', destinationChain='HydraDX', currentStep=0)
  - Waits for finalization on Polkadot
  - Waits for XCM message delivery to HydraDX

Transaction 2: SWAP
  - Origin: HydraDX
  - Destination: HydraDX
  - Action: Swap DOT for ASTR
  - Status: onStatusChange(type='SWAP', chain='HydraDX', currentStep=1)
  - Waits for finalization on HydraDX

Transaction 3: TRANSFER
  - Origin: HydraDX
  - Destination: Astar
  - Action: Send ASTR to Astar
  - Status: onStatusChange(type='TRANSFER', chain='HydraDX', destinationChain='Astar', currentStep=2)
  - Waits for finalization on HydraDX
  - Waits for XCM message delivery to Astar

Final: COMPLETED
  - Status: onStatusChange(type='COMPLETED', currentStep=2)
```

---

## **💡 Recommended dApp Implementation**

Here's a production-ready tracking pattern for your dApp:

```typescript
// State management for UI
interface TransactionState {
  status: 'idle' | 'planning' | 'executing' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  currentTransaction?: {
    type: string;
    chain?: string;
    destinationChain?: string;
  };
  error?: string;
  txHashes?: string[]; // If you need to track individual tx hashes
}

const [txState, setTxState] = useState<TransactionState>({
  status: 'idle',
  currentStep: 0,
  totalSteps: 0,
});

// Execute transfer with comprehensive tracking
try {
  setTxState({ ...txState, status: 'planning' });

  await RouterBuilder()
    .from('Polkadot')
    .to('Astar')
    .currencyFrom({ symbol: 'DOT' })
    .currencyTo({ symbol: 'ASTR' })
    .amount('1000000000000') // 1 DOT
    .slippagePct('1')
    .senderAddress(senderAddress)
    .recipientAddress(recipientAddress)
    .signer(signer)
    .onStatusChange((status) => {
      console.log('Status Update:', status);

      switch (status.type) {
        case 'SELECTING_EXCHANGE':
          setTxState({
            status: 'planning',
            currentStep: 0,
            totalSteps: 0,
          });
          break;

        case 'TRANSFER':
        case 'SWAP':
        case 'SWAP_AND_TRANSFER':
          setTxState({
            status: 'executing',
            currentStep: status.currentStep ?? 0,
            totalSteps: status.routerPlan?.length ?? 0,
            currentTransaction: {
              type: status.type,
              chain: status.chain,
              destinationChain: status.destinationChain,
            },
          });
          break;

        case 'COMPLETED':
          setTxState({
            status: 'completed',
            currentStep: status.currentStep ?? 0,
            totalSteps: status.routerPlan?.length ?? 0,
          });
          // Show success message
          toast.success('Transfer completed successfully!');
          break;
      }
    })
    .buildAndSend();

} catch (error) {
  console.error('Transfer failed:', error);
  setTxState({
    ...txState,
    status: 'error',
    error: error.message,
  });
  toast.error(`Transfer failed: ${error.message}`);
}
```

---

## **✅ How to Verify Success**

### **Built-in Success Verification**
The SDK **already handles success verification**:

1. **Each transaction waits for finalization**: Not just block inclusion
2. **Validates transaction success**: Checks `event.ok === true`
3. **Sequential execution**: Next tx only starts after previous succeeds
4. **Error propagation**: Any failure throws and stops execution
5. **`COMPLETED` status**: Only fires when all transactions succeed

### **Additional Verification (Optional)**

If you want extra confirmation, you can:

```typescript
// After COMPLETED status
const verifyFinalBalance = async () => {
  // Query destination chain balance
  const balance = await api.query.assets.balance(
    recipientAddress,
    assetId
  );
  
  // Verify expected amount received (accounting for fees/slippage)
  return balance >= expectedMinimumAmount;
};
```

---

## **⚠️ Important Considerations**

### **1. User Experience**
- **Each transaction requires a signature** - inform users they'll need to sign 2-3 times
- **Cross-chain transfers take time** - XCM messages can take 12-60 seconds between chains
- **Show progress clearly** - display current step and total steps

### **2. Error Handling**
```typescript
// Transaction can fail at multiple points:
// - Insufficient balance
// - User rejects signature
// - Network issues
// - Slippage exceeded
// - XCM delivery failure
```

### **3. Edge Cases**
- **Network disconnection**: Transaction might be submitted but confirmation lost
- **Partial completion**: If step 2 fails, step 1 has already executed (non-atomic)
- **Stuck XCM messages**: Rare, but cross-chain messages can occasionally fail

---

## **📊 UI Display Example**

```typescript
// Display in your UI
{txState.status === 'executing' && (
  <div>
    <p>Processing transaction {txState.currentStep + 1} of {txState.totalSteps}</p>
    <p>Type: {txState.currentTransaction?.type}</p>
    <p>Chain: {txState.currentTransaction?.chain} 
       {txState.currentTransaction?.destinationChain && 
        ` → ${txState.currentTransaction.destinationChain}`}
    </p>
    <ProgressBar 
      value={txState.currentStep} 
      max={txState.totalSteps} 
    />
  </div>
)}
```

---

## **🎯 Summary**

**The SDK already provides robust tracking and success verification**:
- ✅ Each transaction waits for finalization
- ✅ Success is validated automatically
- ✅ Sequential execution ensures proper ordering
- ✅ `onStatusChange` gives you real-time progress
- ✅ `COMPLETED` status guarantees all transactions succeeded
- ✅ Any failure throws an error and stops execution

You just need to **hook into `onStatusChange`** and update your UI accordingly. The underlying system handles all the complex verification for you!