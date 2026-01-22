Let me walk you through the complete flow of how `xcmDeliveryStatus` is handled from Ocelloids to your UI:

[3 tools called]

Perfect! Now let me create a complete flow diagram:

## 🔄 Complete Flow: Ocelloids → UI

### **Step-by-Step Breakdown:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION: Swap Button Clicked                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. useXcmSwapExecution.executeSwap()                               │
│    - Executes ParaSpell RouterBuilder                              │
│    - Transactions get finalized                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Router Status: "COMPLETED"                                      │
│    📍 useXcmSwapExecution.ts:357-367                               │
│                                                                     │
│    if (status.type === 'COMPLETED') {                              │
│      trackRoute(originChain, destinationChain, walletAddress)      │
│    }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. useXcmTracking.trackRoute()                                     │
│    📍 useXcmTracking.ts:118-176                                    │
│                                                                     │
│    - Maps chains to URNs                                           │
│    - Calls OcelloidsClient.subscribe()                             │
│    - Filters by: originUrn, destinationUrn, senderAddress          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. OcelloidsClient Subscribes                                      │
│    📍 OcelloidsClient.ts:62-130                                    │
│                                                                     │
│    await agent.subscribe({                                         │
│      origins: originUrn,                                           │
│      destinations: destinationUrn,                                 │
│      senders: [walletAddress],                                     │
│      events: '*'                                                   │
│    })                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Ocelloids WebSocket Connection                                  │
│    🌐 Listening for XCM events from that specific wallet           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. XCM Event Received: "xcm.sent"                                  │
│    📍 OcelloidsClient.ts:92-95                                     │
│                                                                     │
│    onMessage: (msg) => {                                           │
│      this.logXcmEvent(msg);  // Logs to console                   │
│      this.config.onEvent?.(msg);  // Calls useXcmTracking callback │
│      callback(msg);                                                │
│    }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. useXcmTracking Receives Event                                   │
│    📍 useXcmTracking.ts:92-95                                      │
│                                                                     │
│    onEvent: (event) => {                                           │
│      trackerRef.current?.processEvent(event);                      │
│    }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. XcmMessageTracker.processEvent()                                │
│    📍 XcmMessageTracker.ts:26-108                                  │
│                                                                     │
│    // Extract unique messageId from extrinsicHash                  │
│    const messageId = event.payload.origin?.extrinsicHash           │
│                                                                     │
│    // Create or update message tracker                             │
│    message = {                                                     │
│      messageId: '0x91226fb532...',                                 │
│      status: 'sent',  // ← Status set here                         │
│      origin: { chain, blockNumber, timestamp },                    │
│      hops: [],                                                     │
│    }                                                                │
│                                                                     │
│    // Notify status change                                         │
│    this.notifyStatusChange();  // ← Triggers callback              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 10. XcmMessageTracker.notifyStatusChange()                         │
│     📍 XcmMessageTracker.ts:220-224                                │
│                                                                     │
│     private notifyStatusChange(): void {                           │
│       const status = this.getDeliveryStatus();  // ← Calculates    │
│       const messages = this.getMessages();                         │
│       this.onStatusChange?.(status, messages);  // ← Fires callback│
│     }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 11. XcmMessageTracker.getDeliveryStatus()                          │
│     📍 XcmMessageTracker.ts:114-137                                │
│                                                                     │
│     // Logic to determine overall status:                          │
│     if (messages.size === 0) return 'idle';                        │
│     if (any failed/timeout) return 'failed';                       │
│     if (all received) return 'delivered';  ← Final state           │
│     if (any sent/hopping) return 'in-flight';  ← Current state     │
│     return 'pending';                                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 12. useXcmTracking Callback                                        │
│     📍 useXcmTracking.ts:82-87                                     │
│                                                                     │
│     new XcmMessageTracker((status, msgs) => {                      │
│       setDeliveryStatus(status);  // ← React state update!         │
│       setMessages(msgs);                                           │
│       setStatusMessage(tracker.getStatusSummary());                │
│       onStatusChange?.(status, msgs);  // ← Passes to parent       │
│     })                                                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 13. useXcmSwapExecution Receives Update                            │
│     📍 useXcmSwapExecution.ts:190-198                              │
│                                                                     │
│     onStatusChange: (status, messages) => {                        │
│       onExecutionUpdate?.({                                        │
│         xcmDeliveryStatus: status,  // ← Passed to UI!             │
│         xcmStatusMessage: xcmStatusMessage,                        │
│       });                                                           │
│     }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 14. SwapContainer Receives Update                                  │
│     (via onExecutionUpdate prop)                                   │
│                                                                     │
│     executionDetails = {                                           │
│       xcmDeliveryStatus: 'in-flight',  // ← State updated!         │
│       xcmStatusMessage: '1 XCM message(s) in transit'              │
│     }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 15. SwapCompleteDialog Renders                                     │
│     📍 SwapCompleteDialog.tsx                                      │
│                                                                     │
│     {xcmDeliveryStatus === 'in-flight' && (                        │
│       <p className="text-xs text-white/50">                        │
│         ⏳ Delivering assets cross-chain...                         │
│       </p>                                                          │
│     )}                                                              │
│                                                                     │
│     {xcmDeliveryStatus === 'delivered' && (                        │
│       <p className="text-xs text-tealish-green">                   │
│         ✅ Assets delivered successfully!                          │
│       </p>                                                          │
│     )}                                                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 16. XCM Event Received: "xcm.received"                             │
│     (Same flow 7-15 repeats)                                       │
│                                                                     │
│     - processEvent() updates message status to 'received'          │
│     - getDeliveryStatus() returns 'delivered'                      │
│     - Callbacks fire again                                         │
│     - UI updates to show success ✅                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key State Transitions

### **xcmDeliveryStatus Values:**

```typescript
type XcmDeliveryStatus = 
  | 'idle'        // Not tracking yet
  | 'pending'     // Waiting for XCM to be sent
  | 'in-flight'   // XCM sent, waiting for delivery
  | 'delivered'   // Successfully received ✅
  | 'failed';     // Failed at any stage ❌
```

### **Flow Through States:**

```
User clicks swap
   ↓
'idle' (initial)
   ↓
trackRoute() called
   ↓
'pending' (subscription active, waiting for events)
   ↓
xcm.sent event received
   ↓
'in-flight' (message in transit)
   ↓
xcm.received event with outcome:'Success'
   ↓
'delivered' (complete!) → triggers onSuccess()
```

---

## 📝 Summary

**The magic happens in 3 places:**

1. **XcmMessageTracker.getDeliveryStatus()** - Calculates overall status from all tracked messages
2. **XcmMessageTracker.notifyStatusChange()** - Fires callback whenever status changes
3. **React state updates** - Propagates through hooks to UI

**Every XCM event from Ocelloids triggers:**
```
WebSocket → processEvent() → getDeliveryStatus() → callback → setState() → UI update
```

This is why your UI updates in **real-time** as XCM messages move through the system! 🚀