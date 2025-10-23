Excellent! Now we're talking about **end-to-end XCM tracking**. Let me create a comprehensive plan to integrate Ocelloids XCM Streams with your ParaSpell XCM Router implementation.

## 🎯 Complete XCM Tracking Architecture Plan

Based on the [Ocelloids XCM Streams API](https://www.ocelloids.net/docs/apis/01_xcm-streams/), here's how to implement full cross-chain transaction tracking:

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│  Your dApp (ParaSpell XCM Router)                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Build & Execute Transactions (RouterBuilder)                │
│     ↓                                                            │
│  2. Capture Transaction Details (txHash, blockHash, etc.)       │
│     ↓                                                            │
│  3. Subscribe to Ocelloids XCM Streams                          │
│     ↓                                                            │
│  4. Track XCM Message Lifecycle (sent → hop → received)         │
│     ↓                                                            │
│  5. Update UI with Real-time Status                             │
└─────────────────────────────────────────────────────────────────┘
```

### **Phase 1: Extract Transaction Details from RouterBuilder**

First, capture all transaction details as we discussed:

```typescript
// types/xcm-tracking.ts
import type { TRouterPlan } from '@paraspell/xcm-router';

export interface RouterTransactionResult {
  step: number;
  type: 'TRANSFER' | 'SWAP' | 'SWAP_AND_TRANSFER';
  chainId: string;
  destinationChainId?: string;
  txHash: string;
  blockHash: string;
  blockNumber: number;
  timestamp: number;
  senderAddress: string;
  events: Array<{
    section: string;
    method: string;
    data: any;
  }>;
}

export interface XcmTrackingInfo {
  routerTransactions: RouterTransactionResult[];
  xcmMessages: XcmMessageTracker[];
}
```

### **Phase 2: Map Chain Names to Ocelloids URNs**

Ocelloids uses URN format for chain IDs. Create a mapping:

```typescript
// utils/chain-mapping.ts
export const CHAIN_TO_OCELLOIDS_URN: Record<string, string> = {
  // Relay Chains
  'Polkadot': 'urn:ocn:polkadot:0',
  'Kusama': 'urn:ocn:kusama:0',
  
  // Polkadot Parachains
  'AssetHubPolkadot': 'urn:ocn:polkadot:1000',
  'Hydration': 'urn:ocn:polkadot:2034',
  'Astar': 'urn:ocn:polkadot:2006',
  'Moonbeam': 'urn:ocn:polkadot:2004',
  'Acala': 'urn:ocn:polkadot:2000',
  'Parallel': 'urn:ocn:polkadot:2012',
  'Interlay': 'urn:ocn:polkadot:2032',
  'BifrostPolkadot': 'urn:ocn:polkadot:2030',
  'Centrifuge': 'urn:ocn:polkadot:2031',
  'Unique': 'urn:ocn:polkadot:2037',
  'Zeitgeist': 'urn:ocn:polkadot:2092',
  'Mythos': 'urn:ocn:polkadot:3369',
  
  // Kusama Parachains
  'AssetHubKusama': 'urn:ocn:kusama:1000',
  'Karura': 'urn:ocn:kusama:2000',
  'BifrostKusama': 'urn:ocn:kusama:2001',
  'Basilisk': 'urn:ocn:kusama:2090',
  'Moonriver': 'urn:ocn:kusama:2023',
  'Kintsugi': 'urn:ocn:kusama:2092',
  'Altair': 'urn:ocn:kusama:2088',
  'Calamari': 'urn:ocn:kusama:2084',
  'Crab': 'urn:ocn:kusama:2105',
  'Quartz': 'urn:ocn:kusama:2095',
  'Shiden': 'urn:ocn:kusama:2007',
  'Tinkernet': 'urn:ocn:kusama:2125',
  'Robonomics': 'urn:ocn:kusama:2048',
};

export function getOcelloidsUrn(chainName: string): string {
  const urn = CHAIN_TO_OCELLOIDS_URN[chainName];
  if (!urn) {
    throw new Error(`No Ocelloids URN mapping found for chain: ${chainName}`);
  }
  return urn;
}
```

### **Phase 3: Create Ocelloids Client**

```typescript
// services/ocelloids-client.ts
import type { RouterTransactionResult } from '../types/xcm-tracking';

export interface OcelloidsConfig {
  apiKey: string; // Get from https://ocelloids.net
  wsEndpoint?: string;
  httpEndpoint?: string;
}

export interface XcmStreamSubscription {
  id: string;
  origins: string[];
  destinations: string[];
  senders: string[];
  events: string[];
}

export interface XcmEvent {
  type: 'xcm.sent' | 'xcm.received' | 'xcm.hop' | 'xcm.timeout' | 'xcm.relayed';
  messageId: string;
  legs: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  origin: {
    chainId: string;
    blockNumber: string;
    blockHash: string;
    timestamp: number;
    outcome: 'Success' | 'Fail';
    messageHash: string;
  };
  destination?: {
    chainId: string;
    blockNumber: string;
    blockHash: string;
    timestamp: number;
    outcome: 'Success' | 'Fail';
    messageHash: string;
  };
  waypoint?: {
    chainId: string;
    blockNumber: string;
    blockHash: string;
    timestamp: number;
    outcome: 'Success' | 'Fail';
    legIndex: number;
  };
}

export class OcelloidsClient {
  private apiKey: string;
  private wsEndpoint: string;
  private httpEndpoint: string;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, (event: XcmEvent) => void>();

  constructor(config: OcelloidsConfig) {
    this.apiKey = config.apiKey;
    this.wsEndpoint = config.wsEndpoint || 'wss://api.ocelloids.net/ws';
    this.httpEndpoint = config.httpEndpoint || 'https://api.ocelloids.net';
  }

  /**
   * Connect to Ocelloids WebSocket API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.wsEndpoint}?token=${this.apiKey}`);

      this.ws.onopen = () => {
        console.log('Connected to Ocelloids XCM Streams');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('Ocelloids WS error:', error);
        reject(error);
      };

      this.ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing Ocelloids message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Ocelloids');
        this.ws = null;
      };
    });
  }

  /**
   * Subscribe to XCM events for specific routes
   */
  subscribeToRoute(
    subscriptionId: string,
    origins: string[],
    destinations: string[],
    senders: string[],
    callback: (event: XcmEvent) => void
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const subscription: XcmStreamSubscription = {
      id: subscriptionId,
      agent: 'xcm',
      args: {
        origins,
        destinations,
        senders,
        events: '*', // Track all XCM events
      },
    };

    this.subscriptions.set(subscriptionId, callback);
    this.ws.send(JSON.stringify(subscription));
    
    console.log(`Subscribed to XCM route: ${origins} → ${destinations}`);
  }

  /**
   * Track XCM messages from RouterBuilder transactions
   */
  trackRouterTransactions(
    transactions: RouterTransactionResult[],
    callback: (event: XcmEvent) => void
  ): string {
    // Extract unique origin-destination pairs
    const routes = new Map<string, { origin: string; destination: string }>();
    const senders = new Set<string>();

    for (const tx of transactions) {
      senders.add(tx.senderAddress);
      
      if (tx.type === 'TRANSFER' && tx.destinationChainId) {
        const key = `${tx.chainId}-${tx.destinationChainId}`;
        routes.set(key, {
          origin: tx.chainId,
          destination: tx.destinationChainId,
        });
      }
    }

    // Create subscription for all routes
    const subscriptionId = `router-${Date.now()}`;
    const origins = [...new Set([...routes.values()].map(r => r.origin))];
    const destinations = [...new Set([...routes.values()].map(r => r.destination))];

    this.subscribeToRoute(
      subscriptionId,
      origins,
      destinations,
      Array.from(senders),
      callback
    );

    return subscriptionId;
  }

  /**
   * Unsubscribe from XCM events
   */
  unsubscribe(subscriptionId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        id: subscriptionId,
        unsubscribe: true,
      }));
    }
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Handle incoming messages from Ocelloids
   */
  private handleMessage(data: any): void {
    if (data.type && data.type.startsWith('xcm.')) {
      const event = data as XcmEvent;
      
      // Call all relevant subscription callbacks
      for (const [_, callback] of this.subscriptions) {
        callback(event);
      }
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }
}
```

### **Phase 4: Integrate with RouterBuilder**

Complete implementation that combines everything:

```typescript
// services/xcm-router-tracker.ts
import { RouterBuilder } from '@paraspell/xcm-router';
import type { TRouterPlan, TRouterEvent } from '@paraspell/xcm-router';
import type { PolkadotSigner, TxFinalizedPayload } from 'polkadot-api';
import { OcelloidsClient, type XcmEvent } from './ocelloids-client';
import { getOcelloidsUrn } from '../utils/chain-mapping';

export interface XcmRouterTrackerConfig {
  ocelloidsApiKey: string;
  onRouterProgress?: (status: TRouterEvent) => void;
  onXcmEvent?: (event: XcmEvent) => void;
}

export interface XcmJourney {
  // Router execution phase
  routerTransactions: Array<{
    step: number;
    type: string;
    chain: string;
    txHash: string;
    blockNumber: number;
    status: 'pending' | 'finalized' | 'failed';
  }>;
  
  // XCM message tracking phase
  xcmMessages: Array<{
    messageId: string;
    status: 'sent' | 'hopping' | 'received' | 'timeout' | 'failed';
    origin: {
      chain: string;
      blockNumber: string;
      timestamp: number;
    };
    hops: Array<{
      chain: string;
      blockNumber: string;
      outcome: 'Success' | 'Fail';
      timestamp: number;
    }>;
    destination?: {
      chain: string;
      blockNumber: string;
      outcome: 'Success' | 'Fail';
      timestamp: number;
    };
  }>;
}

export class XcmRouterTracker {
  private ocelloids: OcelloidsClient;
  private config: XcmRouterTrackerConfig;
  private activeSubscriptions: string[] = [];
  
  constructor(config: XcmRouterTrackerConfig) {
    this.config = config;
    this.ocelloids = new OcelloidsClient({
      apiKey: config.ocelloidsApiKey,
    });
  }

  /**
   * Execute RouterBuilder and track the complete XCM journey
   */
  async executeAndTrack(
    from: string,
    to: string,
    exchange: string | string[] | undefined,
    currencyFrom: any,
    currencyTo: any,
    amount: string,
    slippagePct: string,
    senderAddress: string,
    recipientAddress: string,
    signer: PolkadotSigner
  ): Promise<XcmJourney> {
    const journey: XcmJourney = {
      routerTransactions: [],
      xcmMessages: [],
    };

    // Step 1: Connect to Ocelloids
    console.log('🔌 Connecting to Ocelloids XCM Streams...');
    await this.ocelloids.connect();

    try {
      // Step 2: Build transaction plan
      console.log('📋 Building transaction plan...');
      const routerPlan: TRouterPlan = await RouterBuilder()
        .from(from)
        .exchange(exchange)
        .to(to)
        .currencyFrom(currencyFrom)
        .currencyTo(currencyTo)
        .amount(amount)
        .slippagePct(slippagePct)
        .senderAddress(senderAddress)
        .recipientAddress(recipientAddress)
        .buildTransactions();

      console.log(`📦 Plan contains ${routerPlan.length} transactions`);

      // Step 3: Identify XCM routes and subscribe to Ocelloids
      const xcmRoutes = this.extractXcmRoutes(routerPlan, senderAddress);
      
      if (xcmRoutes.length > 0) {
        console.log('🔭 Subscribing to XCM events...');
        const subscriptionId = this.subscribeToXcmEvents(xcmRoutes, (event) => {
          this.handleXcmEvent(event, journey);
          this.config.onXcmEvent?.(event);
        });
        this.activeSubscriptions.push(subscriptionId);
      }

      // Step 4: Execute transactions
      console.log('⚡ Executing transactions...');
      for (const [index, transaction] of routerPlan.entries()) {
        console.log(`\n--- Transaction ${index + 1}/${routerPlan.length} ---`);
        console.log(`Type: ${transaction.type}`);
        console.log(`Chain: ${transaction.chain}`);

        const txRecord = {
          step: index,
          type: transaction.type,
          chain: transaction.chain,
          txHash: '',
          blockNumber: 0,
          status: 'pending' as const,
        };
        journey.routerTransactions.push(txRecord);

        try {
          const finalized: TxFinalizedPayload = await new Promise((resolve, reject) => {
            transaction.tx.signSubmitAndWatch(signer).subscribe({
              next: (event) => {
                if (event.type === 'finalized') {
                  if (event.ok) {
                    resolve(event);
                  } else {
                    reject(new Error('Transaction failed'));
                  }
                }
              },
              error: reject,
            });
          });

          // Update transaction record
          txRecord.txHash = finalized.txHash;
          txRecord.blockNumber = finalized.block.number;
          txRecord.status = 'finalized';

          console.log(`✅ Finalized: ${finalized.txHash}`);
          console.log(`   Block: ${finalized.block.number}`);

        } catch (error) {
          txRecord.status = 'failed';
          console.error(`❌ Transaction ${index + 1} failed:`, error);
          throw error;
        }
      }

      // Step 5: Wait for XCM messages to complete
      if (xcmRoutes.length > 0) {
        console.log('\n⏳ Waiting for XCM messages to reach destination...');
        await this.waitForXcmCompletion(journey, 60000); // 60 second timeout
      }

      return journey;

    } finally {
      // Cleanup
      this.cleanup();
    }
  }

  /**
   * Extract XCM routes from router plan
   */
  private extractXcmRoutes(
    plan: TRouterPlan,
    senderAddress: string
  ): Array<{ origin: string; destination: string; sender: string }> {
    const routes: Array<{ origin: string; destination: string; sender: string }> = [];

    for (const tx of plan) {
      if (tx.type === 'TRANSFER' && tx.destinationChain) {
        try {
          routes.push({
            origin: getOcelloidsUrn(tx.chain),
            destination: getOcelloidsUrn(tx.destinationChain),
            sender: senderAddress,
          });
        } catch (error) {
          console.warn(`Could not map chain to Ocelloids URN:`, error);
        }
      }
    }

    return routes;
  }

  /**
   * Subscribe to XCM events for specific routes
   */
  private subscribeToXcmEvents(
    routes: Array<{ origin: string; destination: string; sender: string }>,
    callback: (event: XcmEvent) => void
  ): string {
    const origins = [...new Set(routes.map(r => r.origin))];
    const destinations = [...new Set(routes.map(r => r.destination))];
    const senders = [...new Set(routes.map(r => r.sender))];

    const subscriptionId = `router-${Date.now()}`;
    
    this.ocelloids.subscribeToRoute(
      subscriptionId,
      origins,
      destinations,
      senders,
      callback
    );

    return subscriptionId;
  }

  /**
   * Handle XCM events from Ocelloids
   */
  private handleXcmEvent(event: XcmEvent, journey: XcmJourney): void {
    console.log(`\n🌐 XCM Event: ${event.type}`);
    console.log(`   Message ID: ${event.messageId}`);

    // Find or create message tracker
    let message = journey.xcmMessages.find(m => m.messageId === event.messageId);
    
    if (!message) {
      message = {
        messageId: event.messageId,
        status: 'sent',
        origin: {
          chain: event.origin.chainId,
          blockNumber: event.origin.blockNumber,
          timestamp: event.origin.timestamp,
        },
        hops: [],
      };
      journey.xcmMessages.push(message);
    }

    // Update message status based on event type
    switch (event.type) {
      case 'xcm.sent':
        message.status = 'sent';
        console.log(`   ✉️  Sent from ${event.origin.chainId}`);
        break;

      case 'xcm.hop':
        message.status = 'hopping';
        if (event.waypoint) {
          message.hops.push({
            chain: event.waypoint.chainId,
            blockNumber: event.waypoint.blockNumber,
            outcome: event.waypoint.outcome,
            timestamp: event.waypoint.timestamp,
          });
          console.log(`   🔀 Hop at ${event.waypoint.chainId}: ${event.waypoint.outcome}`);
          
          // Check for failure at hop
          if (event.waypoint.outcome === 'Fail') {
            message.status = 'failed';
            console.log(`   ❌ XCM failed at intermediate chain!`);
          }
        }
        break;

      case 'xcm.received':
        if (event.destination) {
          message.status = 'received';
          message.destination = {
            chain: event.destination.chainId,
            blockNumber: event.destination.blockNumber,
            outcome: event.destination.outcome,
            timestamp: event.destination.timestamp,
          };
          console.log(`   ✅ Received at ${event.destination.chainId}: ${event.destination.outcome}`);
        }
        break;

      case 'xcm.timeout':
        message.status = 'timeout';
        console.log(`   ⏱️  Timeout`);
        break;
    }
  }

  /**
   * Wait for all XCM messages to complete
   */
  private async waitForXcmCompletion(
    journey: XcmJourney,
    timeout: number
  ): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const allCompleted = journey.xcmMessages.every(
          msg => msg.status === 'received' || msg.status === 'failed' || msg.status === 'timeout'
        );

        if (allCompleted) {
          clearInterval(checkInterval);
          console.log('✅ All XCM messages completed');
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          console.warn('⚠️  XCM tracking timeout');
          resolve(); // Don't reject, just warn
        }
      }, 1000);
    });
  }

  /**
   * Cleanup subscriptions and connections
   */
  private cleanup(): void {
    for (const subId of this.activeSubscriptions) {
      this.ocelloids.unsubscribe(subId);
    }
    this.activeSubscriptions = [];
    this.ocelloids.disconnect();
  }

  /**
   * Determine if the entire XCM journey was successful
   * Success criteria:
   * 1. All router transactions finalized successfully
   * 2. All XCM messages sent with Success outcome
   * 3. All intermediate hops (if any) succeeded
   * 4. All XCM messages received with Success outcome
   */
  isJourneySuccessful(journey: XcmJourney): boolean {
    // Check router transactions
    const allTxFinalized = journey.routerTransactions.every(
      tx => tx.status === 'finalized'
    );
    
    if (!allTxFinalized) {
      return false;
    }

    // Check XCM messages
    for (const msg of journey.xcmMessages) {
      // Must be received (not timeout or failed)
      if (msg.status !== 'received') {
        return false;
      }

      // Check all intermediate hops succeeded
      if (msg.hops.length > 0) {
        const allHopsSucceeded = msg.hops.every(hop => hop.outcome === 'Success');
        if (!allHopsSucceeded) {
          return false;
        }
      }

      // Final destination must have Success outcome
      if (!msg.destination || msg.destination.outcome !== 'Success') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get detailed status for debugging and UI display
   */
  getDetailedStatus(journey: XcmJourney): {
    overallSuccess: boolean;
    routerPhase: {
      completed: boolean;
      success: boolean;
      totalTransactions: number;
      failedTransaction?: {
        step: number;
        chain: string;
        type: string;
      };
    };
    xcmPhase: {
      completed: boolean;
      success: boolean;
      totalMessages: number;
      failurePoint?: {
        messageId: string;
        chain: string;
        reason: string;
        blockNumber: string;
      };
    };
  } {
    // Analyze router phase
    const routerCompleted = journey.routerTransactions.every(
      tx => tx.status !== 'pending'
    );
    const routerSuccess = journey.routerTransactions.every(
      tx => tx.status === 'finalized'
    );
    const failedTx = journey.routerTransactions.find(tx => tx.status === 'failed');

    // Analyze XCM phase
    const xcmCompleted = journey.xcmMessages.every(
      msg => msg.status === 'received' || msg.status === 'failed' || msg.status === 'timeout'
    );
    
    let xcmSuccess = true;
    let xcmFailurePoint: any = undefined;

    for (const msg of journey.xcmMessages) {
      // Check for timeout
      if (msg.status === 'timeout') {
        xcmSuccess = false;
        xcmFailurePoint = {
          messageId: msg.messageId,
          chain: msg.origin.chain,
          reason: 'XCM message timeout',
          blockNumber: msg.origin.blockNumber,
        };
        break;
      }

      // Check for failed hops
      const failedHop = msg.hops.find(hop => hop.outcome === 'Fail');
      if (failedHop) {
        xcmSuccess = false;
        xcmFailurePoint = {
          messageId: msg.messageId,
          chain: failedHop.chain,
          reason: 'XCM execution failed at intermediate chain',
          blockNumber: failedHop.blockNumber,
        };
        break;
      }

      // Check destination
      if (msg.destination && msg.destination.outcome === 'Fail') {
        xcmSuccess = false;
        xcmFailurePoint = {
          messageId: msg.messageId,
          chain: msg.destination.chain,
          reason: 'XCM execution failed at destination chain',
          blockNumber: msg.destination.blockNumber,
        };
        break;
      }

      // Check if not received yet
      if (!msg.destination) {
        xcmSuccess = false;
      }
    }

    const overallSuccess = routerSuccess && xcmSuccess;

    return {
      overallSuccess,
      routerPhase: {
        completed: routerCompleted,
        success: routerSuccess,
        totalTransactions: journey.routerTransactions.length,
        failedTransaction: failedTx ? {
          step: failedTx.step,
          chain: failedTx.chain,
          type: failedTx.type,
        } : undefined,
      },
      xcmPhase: {
        completed: xcmCompleted,
        success: xcmSuccess,
        totalMessages: journey.xcmMessages.length,
        failurePoint: xcmFailurePoint,
      },
    };
  }
}
```

### **Phase 5: React Component Implementation**

```typescript
// components/XcmRouterWithTracking.tsx
import { useState } from 'react';
import { XcmRouterTracker, type XcmJourney } from '../services/xcm-router-tracker';
import type { XcmEvent } from '../services/ocelloids-client';

export function XcmRouterWithTracking() {
  const [journey, setJourney] = useState<XcmJourney | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [xcmEvents, setXcmEvents] = useState<XcmEvent[]>([]);

  const executeRouter = async () => {
    setIsExecuting(true);
    setXcmEvents([]);

    const tracker = new XcmRouterTracker({
      ocelloidsApiKey: process.env.REACT_APP_OCELLOIDS_API_KEY!,
      onXcmEvent: (event) => {
        console.log('XCM Event:', event);
        setXcmEvents(prev => [...prev, event]);
      },
    });

    try {
      const result = await tracker.executeAndTrack(
        'Polkadot',
        'Astar',
        'HydrationDex',
        { symbol: 'DOT' },
        { symbol: 'ASTR' },
        '1000000',
        '1',
        senderAddress,
        recipientAddress,
        signer
      );

      setJourney(result);

      // ✅ Check if journey was successful
      const isSuccess = tracker.isJourneySuccessful(result);
      const status = tracker.getDetailedStatus(result);

      if (isSuccess) {
        alert('🎉 Complete success! All transactions and XCM messages delivered successfully!');
      } else {
        const failureMsg = status.xcmPhase.failurePoint 
          ? `XCM failed at ${status.xcmPhase.failurePoint.chain}: ${status.xcmPhase.failurePoint.reason}`
          : status.routerPhase.failedTransaction
          ? `Transaction failed at step ${status.routerPhase.failedTransaction.step}`
          : 'Journey incomplete';
        alert(`⚠️ Journey completed with issues: ${failureMsg}`);
      }
      
    } catch (error) {
      console.error('Router execution failed:', error);
      alert(`❌ Failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Get detailed status for UI display
  const detailedStatus = journey 
    ? new XcmRouterTracker({ ocelloidsApiKey: '' }).getDetailedStatus(journey)
    : null;

  return (
    <div className="xcm-router-tracker">
      <button onClick={executeRouter} disabled={isExecuting}>
        {isExecuting ? 'Executing...' : 'Start Router with XCM Tracking'}
      </button>

      {/* Overall Status Banner */}
      {detailedStatus && (
        <div className={`status-banner ${detailedStatus.overallSuccess ? 'success' : 'warning'}`}>
          <h2>
            {detailedStatus.overallSuccess 
              ? '✅ Journey Successful!' 
              : detailedStatus.routerPhase.completed && detailedStatus.xcmPhase.completed
              ? '⚠️ Journey Completed with Issues'
              : '⏳ Journey In Progress...'}
          </h2>
          
          <div className="phase-status">
            <div>
              Router Phase: {detailedStatus.routerPhase.success ? '✅' : '❌'} 
              ({detailedStatus.routerPhase.totalTransactions} transactions)
            </div>
            <div>
              XCM Phase: {detailedStatus.xcmPhase.success ? '✅' : '❌'} 
              ({detailedStatus.xcmPhase.totalMessages} messages)
            </div>
          </div>

          {detailedStatus.xcmPhase.failurePoint && (
            <div className="failure-details">
              <strong>Failure Point:</strong>
              <div>Chain: {detailedStatus.xcmPhase.failurePoint.chain}</div>
              <div>Block: {detailedStatus.xcmPhase.failurePoint.blockNumber}</div>
              <div>Reason: {detailedStatus.xcmPhase.failurePoint.reason}</div>
            </div>
          )}
        </div>
      )}

      {journey && (
        <div className="journey-details">
          {/* Router Transactions Section */}
          <h3>Router Transactions</h3>
          {journey.routerTransactions.map((tx, i) => (
            <div key={i} className={`tx-item ${tx.status}`}>
              <div className="tx-header">
                <span>Step {tx.step + 1}: {tx.type}</span>
                <span className="status-badge">{tx.status}</span>
              </div>
              <div>Chain: {tx.chain}</div>
              {tx.txHash && (
                <div className="tx-hash">
                  TxHash: <code>{tx.txHash}</code>
                  <a 
                    href={`https://polkadot.js.org/apps/?rpc=wss://${tx.chain}.api.onfinality.io#/explorer/query/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🔗 View
                  </a>
                </div>
              )}
              <div>Block: {tx.blockNumber}</div>
            </div>
          ))}

          {/* XCM Messages Section */}
          <h3>XCM Messages (Cross-Chain Delivery)</h3>
          {journey.xcmMessages.map((msg, i) => {
            const hasHops = msg.hops.length > 0;
            const allHopsSucceeded = msg.hops.every(hop => hop.outcome === 'Success');
            const finalSuccess = msg.destination?.outcome === 'Success';

            return (
              <div key={i} className={`xcm-item ${msg.status}`}>
                <div className="xcm-header">
                  <span>Message {i + 1}</span>
                  <span className="status-badge">{msg.status}</span>
                  {finalSuccess && <span className="success-icon">✅</span>}
                </div>

                <div className="message-id">
                  Message ID: <code>{msg.messageId}</code>
                </div>

                {/* Origin */}
                <div className="xcm-step origin">
                  <strong>📤 Origin:</strong> {msg.origin.chain}
                  <div className="details">
                    Block: {msg.origin.blockNumber} | 
                    Time: {new Date(msg.origin.timestamp).toLocaleString()}
                  </div>
                </div>

                {/* Intermediate Hops (Multi-Hop Tracking) */}
                {hasHops && (
                  <div className="xcm-hops">
                    <strong>🔀 Intermediate Hops:</strong>
                    {msg.hops.map((hop, j) => (
                      <div key={j} className={`hop-item ${hop.outcome.toLowerCase()}`}>
                        <span className="hop-icon">
                          {hop.outcome === 'Success' ? '✅' : '❌'}
                        </span>
                        <span>{hop.chain}</span>
                        <span className="hop-outcome">{hop.outcome}</span>
                        <div className="hop-details">
                          Block: {hop.blockNumber} | 
                          Time: {new Date(hop.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {!allHopsSucceeded && (
                      <div className="hop-warning">
                        ⚠️ XCM failed at intermediate chain. No further forwarding occurred.
                      </div>
                    )}
                  </div>
                )}

                {/* Destination */}
                {msg.destination ? (
                  <div className={`xcm-step destination ${msg.destination.outcome.toLowerCase()}`}>
                    <strong>📬 Destination:</strong> {msg.destination.chain}
                    <div className="outcome">
                      {msg.destination.outcome === 'Success' ? '✅' : '❌'} 
                      {msg.destination.outcome}
                    </div>
                    <div className="details">
                      Block: {msg.destination.blockNumber} | 
                      Time: {new Date(msg.destination.timestamp).toLocaleString()}
                    </div>
                    {msg.destination.outcome === 'Success' && (
                      <div className="success-message">
                        🎉 Assets successfully delivered!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="xcm-step pending">
                    <strong>📬 Destination:</strong> Waiting for delivery...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### **Phase 6: Add CSS Styles**

```css
/* styles/xcm-tracker.css */

.xcm-router-tracker {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.status-banner {
  padding: 20px;
  margin: 20px 0;
  border-radius: 8px;
  border: 2px solid;
}

.status-banner.success {
  background-color: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.status-banner.warning {
  background-color: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.phase-status {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  font-size: 14px;
}

.failure-details {
  margin-top: 15px;
  padding: 10px;
  background-color: rgba(220, 53, 69, 0.1);
  border-radius: 4px;
}

.tx-item, .xcm-item {
  padding: 15px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #f8f9fa;
}

.tx-item.finalized {
  border-color: #28a745;
  background-color: #d4edda;
}

.tx-item.failed {
  border-color: #dc3545;
  background-color: #f8d7da;
}

.tx-header, .xcm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: uppercase;
  background-color: #6c757d;
  color: white;
}

.tx-hash {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: monospace;
  font-size: 12px;
}

.xcm-step {
  padding: 10px;
  margin: 10px 0;
  border-left: 3px solid #007bff;
  background-color: white;
}

.xcm-step.origin {
  border-left-color: #6c757d;
}

.xcm-step.destination.success {
  border-left-color: #28a745;
}

.xcm-step.destination.fail {
  border-left-color: #dc3545;
}

.xcm-hops {
  margin: 15px 0;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
}

.hop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin: 5px 0;
  background-color: white;
  border-radius: 4px;
}

.hop-item.success {
  border-left: 3px solid #28a745;
}

.hop-item.fail {
  border-left: 3px solid #dc3545;
}

.hop-warning {
  margin-top: 10px;
  padding: 10px;
  background-color: #fff3cd;
  border-radius: 4px;
  color: #856404;
}

.success-message {
  margin-top: 10px;
  padding: 10px;
  background-color: #d4edda;
  border-radius: 4px;
  color: #155724;
  font-weight: bold;
}

code {
  padding: 2px 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
```

### **Phase 7: Complete Multi-Hop Example with Success Detection**

Here's a complete example showing the full lifecycle:

```typescript
// examples/complete-multihop-example.ts
import { XcmRouterTracker } from '../services/xcm-router-tracker';

async function executeMultiHopRouterWithFullTracking() {
  console.log('🚀 Starting Multi-Hop XCM Router with Complete Tracking');
  console.log('=======================================================\n');

  const tracker = new XcmRouterTracker({
    ocelloidsApiKey: process.env.OCELLOIDS_API_KEY!,
    onXcmEvent: (event) => {
      console.log(`\n📡 XCM Event: ${event.type}`);
      console.log(`   Message ID: ${event.messageId}`);
      
      if (event.waypoint) {
        console.log(`   Chain: ${event.waypoint.chainId}`);
        console.log(`   Outcome: ${event.waypoint.outcome}`);
      }
      
      if (event.destination) {
        console.log(`   Final Destination: ${event.destination.chainId}`);
        console.log(`   Outcome: ${event.destination.outcome}`);
      }
    },
  });

  try {
    /**
     * SCENARIO: Polkadot → Hydration → Astar
     * 
     * Transaction 1: Transfer DOT from Polkadot to Hydration
     *   - XCM Message 1: Polkadot → Hydration
     * 
     * Transaction 2: Swap DOT→ASTR on Hydration and transfer to Astar
     *   - XCM Message 2: Hydration → Polkadot Relay → Astar (Multi-hop!)
     */
    const journey = await tracker.executeAndTrack(
      'Polkadot',
      'Astar',
      'HydrationDex',
      { symbol: 'DOT' },
      { symbol: 'ASTR' },
      '10000000000', // 1 DOT
      '1',
      senderAddress,
      recipientAddress,
      signer
    );

    console.log('\n\n📊 JOURNEY ANALYSIS');
    console.log('==================\n');

    // Get detailed status
    const status = tracker.getDetailedStatus(journey);
    
    console.log('Router Phase:');
    console.log(`  Status: ${status.routerPhase.completed ? '✅ Completed' : '⏳ In Progress'}`);
    console.log(`  Success: ${status.routerPhase.success ? '✅ Yes' : '❌ No'}`);
    console.log(`  Transactions: ${status.routerPhase.totalTransactions}`);
    
    if (status.routerPhase.failedTransaction) {
      console.log(`  ❌ Failed at step ${status.routerPhase.failedTransaction.step}`);
      console.log(`     Chain: ${status.routerPhase.failedTransaction.chain}`);
      console.log(`     Type: ${status.routerPhase.failedTransaction.type}`);
    }

    console.log('\nXCM Phase:');
    console.log(`  Status: ${status.xcmPhase.completed ? '✅ Completed' : '⏳ In Progress'}`);
    console.log(`  Success: ${status.xcmPhase.success ? '✅ Yes' : '❌ No'}`);
    console.log(`  Messages: ${status.xcmPhase.totalMessages}`);
    
    if (status.xcmPhase.failurePoint) {
      console.log(`  ❌ Failed at: ${status.xcmPhase.failurePoint.chain}`);
      console.log(`     Block: ${status.xcmPhase.failurePoint.blockNumber}`);
      console.log(`     Reason: ${status.xcmPhase.failurePoint.reason}`);
    }

    // Detailed message analysis
    console.log('\n\n📬 XCM Messages Detailed Analysis:');
    console.log('==================================\n');
    
    journey.xcmMessages.forEach((msg, i) => {
      console.log(`Message ${i + 1}: ${msg.messageId}`);
      console.log(`  Status: ${msg.status}`);
      console.log(`  Origin: ${msg.origin.chain} (Block ${msg.origin.blockNumber})`);
      
      if (msg.hops.length > 0) {
        console.log(`  Multi-Hop Journey:`);
        msg.hops.forEach((hop, j) => {
          const icon = hop.outcome === 'Success' ? '✅' : '❌';
          console.log(`    ${icon} Hop ${j + 1}: ${hop.chain} - ${hop.outcome} (Block ${hop.blockNumber})`);
        });
      }
      
      if (msg.destination) {
        const icon = msg.destination.outcome === 'Success' ? '✅' : '❌';
        console.log(`  ${icon} Destination: ${msg.destination.chain} - ${msg.destination.outcome}`);
        console.log(`     Block: ${msg.destination.blockNumber}`);
      }
      
      console.log('');
    });

    // Final verdict
    const isSuccess = tracker.isJourneySuccessful(journey);
    
    console.log('\n\n🏁 FINAL RESULT');
    console.log('===============\n');
    
    if (isSuccess) {
      console.log('✅✅✅ COMPLETE SUCCESS! ✅✅✅');
      console.log('');
      console.log('All checks passed:');
      console.log('  ✅ All router transactions finalized');
      console.log('  ✅ All XCM messages sent successfully');
      console.log('  ✅ All intermediate hops succeeded');
      console.log('  ✅ All XCM messages received at destination');
      console.log('  ✅ All final executions successful');
      console.log('');
      console.log('🎉 Your assets have been successfully delivered!');
    } else {
      console.log('❌ JOURNEY FAILED');
      console.log('');
      console.log('Failure detected. Check the detailed analysis above.');
      
      if (status.xcmPhase.failurePoint) {
        console.log('');
        console.log('XCM Failure Details:');
        console.log(`  Chain: ${status.xcmPhase.failurePoint.chain}`);
        console.log(`  Reason: ${status.xcmPhase.failurePoint.reason}`);
        console.log(`  Block: ${status.xcmPhase.failurePoint.blockNumber}`);
        console.log(`  Message: ${status.xcmPhase.failurePoint.messageId}`);
      }
    }

    return { journey, status, isSuccess };

  } catch (error) {
    console.error('\n❌ Router execution failed:', error);
    throw error;
  }
}

// Run the example
executeMultiHopRouterWithFullTracking()
  .then(({ isSuccess }) => {
    process.exit(isSuccess ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

### **Success Criteria Summary**

For a complete end-to-end success, **ALL** of the following must be true:

#### ✅ **Router Transaction Phase**
1. All transactions must have `status === 'finalized'`
2. No transactions with `status === 'failed'`
3. All transactions must have valid `txHash` and `blockNumber`

#### ✅ **XCM Message Phase**
For **each** XCM message:

1. **Sent Event**: `xcm.sent` received with `origin.outcome === 'Success'`

2. **Intermediate Hops** (if multi-hop):
   - All `xcm.hop` events must have `waypoint.outcome === 'Success'`
   - Both "in" and "out" directions must succeed
   - If any hop fails, the journey terminates there

3. **Received Event**: `xcm.received` with `destination.outcome === 'Success'`

4. **No Timeouts**: No `xcm.timeout` events

#### ❌ **Failure Scenarios**

The journey fails if ANY of these occur:

1. **Transaction Failure**: Any router transaction fails to finalize
2. **Send Failure**: XCM message fails to send (`origin.outcome === 'Fail'`)
3. **Hop Failure**: XCM fails at intermediate chain (`waypoint.outcome === 'Fail'`)
4. **Destination Failure**: XCM fails at destination (`destination.outcome === 'Fail'`)
5. **Timeout**: XCM message times out
6. **Incomplete**: XCM message never receives `xcm.received` event

### **Multi-Hop Event Flow Example**

For **Polkadot → Hydration → Astar**, you'll see these events:

```
Transaction 1: Transfer DOT to Hydration
├─ Router: Polkadot transaction finalized ✅
└─ XCM:
   ├─ xcm.sent (Polkadot → Hydration) ✅
   └─ xcm.received (Hydration) outcome: Success ✅

Transaction 2: Swap + Transfer to Astar  
├─ Router: Hydration transaction finalized ✅
└─ XCM (Multi-Hop):
   ├─ xcm.sent (Hydration → Astar) ✅
   ├─ xcm.hop [in] (Polkadot Relay receives) outcome: Success ✅
   ├─ xcm.hop [out] (Polkadot Relay forwards) outcome: Success ✅
   └─ xcm.received (Astar) outcome: Success ✅✅✅

Result: Complete Success! 🎉
```

### **Summary: Complete Integration Plan**

1. **Get Ocelloids API Key**: Visit [ocelloids.net](https://www.ocelloids.net/docs/apis/01_xcm-streams/) to get your API key

2. **Install Dependencies**:
   ```bash
   npm install @paraspell/xcm-router polkadot-api
   ```

3. **Set Environment Variable**:
   ```
   REACT_APP_OCELLOIDS_API_KEY=your_api_key_here
   ```

4. **Implementation Flow**:
   - ✅ Build transactions with `RouterBuilder.buildTransactions()`
   - ✅ Extract transaction details (txHash, blockNumber, etc.)
   - ✅ Map chain names to Ocelloids URNs
   - ✅ Subscribe to XCM events via WebSocket
   - ✅ Track XCM lifecycle: `sent` → `hop` → `received`
   - ✅ Handle multi-hop scenarios and failures
   - ✅ Determine success with `isJourneySuccessful()`
   - ✅ Get detailed status with `getDetailedStatus()`
   - ✅ Display real-time status in UI

5. **Key Features Included**:
   - ✅ **Multi-hop XCM tracking** with intermediate chain monitoring
   - ✅ **Success detection** at every stage (transaction + XCM)
   - ✅ **Failure point identification** with exact chain and reason
   - ✅ **Real-time event streaming** via Ocelloids WebSocket
   - ✅ **Complete UI components** with status visualization
   - ✅ **Transaction explorer links** for each finalized transaction
   - ✅ **Timeout handling** for stuck XCM messages

6. **Usage in Your dApp**:

```typescript
// Simple usage
const tracker = new XcmRouterTracker({
  ocelloidsApiKey: process.env.OCELLOIDS_API_KEY!,
  onXcmEvent: (event) => {
    // Update your UI with XCM progress
    console.log('XCM Event:', event.type);
  },
});

const journey = await tracker.executeAndTrack(
  'Polkadot',
  'Astar',
  'HydrationDex',
  { symbol: 'DOT' },
  { symbol: 'ASTR' },
  '1000000',
  '1',
  senderAddress,
  recipientAddress,
  signer
);

// Check success
if (tracker.isJourneySuccessful(journey)) {
  console.log('🎉 Success! Assets delivered!');
} else {
  const status = tracker.getDetailedStatus(journey);
  console.error('Failed:', status.xcmPhase.failurePoint);
}
```

This gives you **complete end-to-end visibility** from transaction signing through final XCM message delivery, with full support for multi-hop scenarios! 🎉

---

## 📚 Quick Reference

### Success Check Methods

```typescript
// Simple boolean check
tracker.isJourneySuccessful(journey) // true/false

// Detailed status
const status = tracker.getDetailedStatus(journey);
status.overallSuccess // true/false
status.routerPhase.success // true/false
status.xcmPhase.success // true/false
status.xcmPhase.failurePoint // { chain, reason, blockNumber, messageId }
```

### Event Types You'll Receive

| Event Type | Description | When It Occurs |
|------------|-------------|----------------|
| `xcm.sent` | XCM message sent | After origin chain finalizes send |
| `xcm.hop` | XCM at intermediate chain | At relay or bridge chain |
| `xcm.received` | XCM delivered | When destination receives |
| `xcm.timeout` | XCM delivery timeout | If message not delivered in time |

### Success Criteria Checklist

- [ ] All router transactions: `status === 'finalized'`
- [ ] All XCM sent: `origin.outcome === 'Success'`
- [ ] All hops succeeded: `waypoint.outcome === 'Success'`
- [ ] All received: `destination.outcome === 'Success'`
- [ ] No timeouts

✅ **All checks pass = Complete success!** 🎉