# 📋 How to Know Which Transactions Will Require Signing (Before Execution)

Great question! Yes, you can **preview the transaction plan before execution** and know exactly which transactions will require signing.

## **✅ Method 1: Use `.buildTransactions()` to Preview the Plan**

The SDK provides a `.buildTransactions()` method that builds the router plan **without executing it**. This gives you the complete transaction plan upfront.

### **Example: Preview Transactions Before Signing**

```typescript
import { RouterBuilder } from '@paraspell/xcm-router';
import type { TRouterPlan, TTransaction } from '@paraspell/xcm-router';

// Step 1: Build the transaction plan WITHOUT executing
const routerPlan: TRouterPlan = await RouterBuilder()
  .from('Polkadot')
  .to('Astar')
  .currencyFrom({ symbol: 'DOT' })
  .currencyTo({ symbol: 'ASTR' })
  .amount('1000000000000')
  .slippagePct('1')
  .senderAddress(senderAddress)
  .recipientAddress(recipientAddress)
  .signer(signer)
  .buildTransactions(); // ← Returns TRouterPlan without executing

// Step 2: Analyze the plan to see what transactions will need signing
console.log(`Total transactions that will require signing: ${routerPlan.length}`);

routerPlan.forEach((transaction: TTransaction, index: number) => {
  console.log(`\nTransaction ${index + 1}:`);
  console.log(`  Type: ${transaction.type}`);
  console.log(`  Chain: ${transaction.chain}`);
  console.log(`  Destination: ${transaction.destinationChain || 'Same chain'}`);
  
  if (transaction.type === 'SWAP') {
    console.log(`  Expected output: ${transaction.amountOut.toString()}`);
  }
});

// Step 3: Show user a preview before execution
// ... display in your UI ...

// Step 4: Execute when user confirms
// (You'll need to call build() or buildAndSend() separately)
```

---

## **🎯 Understanding the Transaction Plan Structure**

### **What You Get from `buildTransactions()`**

```typescript
type TRouterPlan = TTransaction[];

type TTransaction = {
  api: TPapiApi;              // The API instance for the chain
  chain: TSubstrateChain;     // Origin chain for this transaction
  destinationChain?: TChain;  // Destination chain (if cross-chain)
  tx: TPapiTransaction;       // The actual transaction object
  type: TTransactionType;     // 'TRANSFER' | 'SWAP' | 'SWAP_AND_TRANSFER'
  amountOut?: bigint;         // Expected output amount (for SWAPs)
}
```

### **Transaction Types Explained**

1. **`TRANSFER`** - XCM cross-chain transfer
   - **Requires 1 signature** on the origin chain
   - Example: Send DOT from Polkadot to HydraDX

2. **`SWAP`** - Token swap on DEX
   - **Requires 1 signature** on the exchange chain
   - Example: Swap DOT for ASTR on HydraDX

3. **`SWAP_AND_TRANSFER`** - Combined swap + transfer
   - **Requires 1 signature** on the exchange chain
   - Batched transaction that swaps tokens then sends to destination
   - Example: Swap DOT to ASTR on HydraDX, then send ASTR to Astar

---

## **🔢 Predicting Number of Signatures**

### **Rule of Thumb:**
```typescript
Number of signatures = routerPlan.length
```

Each transaction in the plan requires one signature, because:
- Transactions execute **sequentially**
- Each transaction is signed and finalized before the next one starts
- The user must approve each transaction in their wallet

### **Common Scenarios:**

#### **Scenario 1: Simple Swap (Same Chain)**
```
Origin = HydraDX, Destination = HydraDX
DOT → ASTR on HydraDX

Plan:
├─ Transaction 1: SWAP (1 signature)
Total: 1 signature
```

#### **Scenario 2: Cross-Chain Swap (Standard)**
```
Origin = Polkadot, Destination = Astar, Exchange = HydraDX
DOT on Polkadot → ASTR on Astar

Plan:
├─ Transaction 1: TRANSFER (Polkadot → HydraDX) - 1 signature
├─ Transaction 2: SWAP (DOT → ASTR on HydraDX) - 1 signature
└─ Transaction 3: TRANSFER (HydraDX → Astar) - 1 signature
Total: 3 signatures
```

#### **Scenario 3: One-Click Cross-Chain Swap** (Hydration/AssetHub)
```
Origin = Polkadot, Destination = Astar, Exchange = HydraDX
With one-click support

Plan:
├─ Transaction 1: TRANSFER (Polkadot → HydraDX) - 1 signature
└─ Transaction 2: SWAP_AND_TRANSFER (batched) - 1 signature
Total: 2 signatures
```

---

## **💡 Complete dApp Implementation Example**

Here's a production-ready implementation for your dApp:

```typescript
import { RouterBuilder } from '@paraspell/xcm-router';
import type { TRouterPlan, TRouterEvent } from '@paraspell/xcm-router';

// Step 1: Preview the transaction plan
const previewTransferPlan = async () => {
  try {
    const plan: TRouterPlan = await RouterBuilder()
      .from('Polkadot')
      .to('Astar')
      .currencyFrom({ symbol: 'DOT' })
      .currencyTo({ symbol: 'ASTR' })
      .amount('1000000000000')
      .slippagePct('1')
      .senderAddress(senderAddress)
      .recipientAddress(recipientAddress)
      .signer(signer)
      .buildTransactions();

    return plan;
  } catch (error) {
    console.error('Failed to build transaction plan:', error);
    throw error;
  }
};

// Step 2: Display preview to user
const displayPlanPreview = (plan: TRouterPlan) => {
  return {
    totalSignatures: plan.length,
    steps: plan.map((tx, index) => ({
      stepNumber: index + 1,
      type: tx.type,
      chain: tx.chain,
      destinationChain: tx.destinationChain,
      description: getTransactionDescription(tx),
    })),
  };
};

const getTransactionDescription = (tx: TTransaction): string => {
  switch (tx.type) {
    case 'TRANSFER':
      return `Transfer from ${tx.chain} to ${tx.destinationChain}`;
    case 'SWAP':
      return `Swap tokens on ${tx.chain}`;
    case 'SWAP_AND_TRANSFER':
      return `Swap and transfer from ${tx.chain} to ${tx.destinationChain}`;
    default:
      return 'Unknown transaction';
  }
};

// Step 3: Execute with tracking
const executeTransferWithTracking = async () => {
  // State for UI
  const [currentSignatureStep, setCurrentSignatureStep] = useState(0);
  const [totalSignatures, setTotalSignatures] = useState(0);

  try {
    // Build and execute
    await RouterBuilder()
      .from('Polkadot')
      .to('Astar')
      .currencyFrom({ symbol: 'DOT' })
      .currencyTo({ symbol: 'ASTR' })
      .amount('1000000000000')
      .slippagePct('1')
      .senderAddress(senderAddress)
      .recipientAddress(recipientAddress)
      .signer(signer)
      .onStatusChange((status: TRouterEvent) => {
        // Track which signature we're on
        if (status.routerPlan) {
          setTotalSignatures(status.routerPlan.length);
        }

        switch (status.type) {
          case 'TRANSFER':
          case 'SWAP':
          case 'SWAP_AND_TRANSFER':
            // About to request signature
            setCurrentSignatureStep((status.currentStep ?? 0) + 1);
            
            toast.info(
              `Please sign transaction ${status.currentStep! + 1} of ${status.routerPlan?.length}`,
              {
                description: `${status.type} on ${status.chain}`,
                duration: 0, // Keep visible until signed
              }
            );
            break;

          case 'COMPLETED':
            toast.success('All transactions completed!');
            break;
        }
      })
      .buildAndSend();
  } catch (error) {
    toast.error(`Transaction failed: ${error.message}`);
  }
};

// Step 4: UI Component Example
const TransferPreviewComponent = () => {
  const [plan, setPlan] = useState<TRouterPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const transactionPlan = await previewTransferPlan();
      setPlan(transactionPlan);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    await executeTransferWithTracking();
  };

  return (
    <div>
      <button onClick={handlePreview} disabled={loading}>
        Preview Transaction Plan
      </button>

      {plan && (
        <div className="transaction-preview">
          <h3>Transaction Plan Preview</h3>
          <p className="highlight">
            ⚠️ You will need to sign {plan.length} transaction(s)
          </p>

          {plan.map((tx, index) => (
            <div key={index} className="transaction-card">
              <h4>Step {index + 1}: {tx.type}</h4>
              <p>Chain: {tx.chain}</p>
              {tx.destinationChain && (
                <p>Destination: {tx.destinationChain}</p>
              )}
              {tx.type === 'SWAP' && (
                <p>Expected output: {tx.amountOut.toString()}</p>
              )}
            </div>
          ))}

          <button onClick={handleExecute}>
            Proceed with {plan.length} signature(s)
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## **📚 Documentation References**

From the README (lines 111-117):
```typescript
.onStatusChange((status: TRouterEvent) => {
  console.log(status.type);          // Current transaction type
  console.log(status.routerPlan);    // Array of all transactions to execute
  console.log(status.chain);         // Current transaction origin chain
  console.log(status.destinationChain); // Current transaction destination chain
  console.log(status.currentStep);   // 0-based step index of current transaction
})
```

### **Key Points from Documentation:**
1. **One-click swaps** (lines 29-31): Hydration and AssetHubPolkadot support one-click, reducing signatures
2. **Two-click swaps** (lines 33-40): Most other DEXes require standard multi-step process
3. **`buildTransactions()`** method: Documented in `RouterBuilder.test.ts` (lines 55-70)

---

## **🎯 Summary**

**To know which transactions will require signing BEFORE execution:**

1. ✅ Use `.buildTransactions()` to get the complete plan
2. ✅ The plan length = number of signatures required
3. ✅ Each transaction in the plan requires one signature
4. ✅ Display the plan to users before asking them to proceed
5. ✅ Use `onStatusChange` to track progress during execution
6. ✅ The `routerPlan` is available in every status callback

This gives you complete transparency and allows you to build a great UX where users know exactly what to expect before signing anything!