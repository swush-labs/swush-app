/**
 * Ocelloids Client - XCM Tracking
 * 
 * Based on: https://github.com/sodazone/quickstart-ocelloids-services
 */

import { type Message, createXcmAgent, xcm } from '@sodazone/ocelloids-client';

export interface OcelloidsClientConfig {
  httpUrl?: string;
  wsUrl?: string;
  apiKey: string;
  onEvent?: (msg: Message<xcm.XcmMessagePayload>) => void;
  onError?: (error: Error) => void;
}

export class OcelloidsClient {
  private agent: any = null;
  private config: OcelloidsClientConfig;
  private activeSubscriptions = new Map<string, any>();

  constructor(config: OcelloidsClientConfig) {
    this.config = {
      httpUrl: config.httpUrl,
      wsUrl: config.wsUrl,
      apiKey: config.apiKey,
      onEvent: config.onEvent,
      onError: config.onError,
    };
  }

  /**
   * Connect to Ocelloids
   */
  async connect(): Promise<void> {
    if (this.agent) {
      console.log('🌐 Already connected to Ocelloids');
      return;
    }

    console.log('🔌 Connecting to Ocelloids...');
    
    this.agent = createXcmAgent({
      httpUrl: this.config.httpUrl,
      wsUrl: this.config.wsUrl,
      apiKey: this.config.apiKey,
    });

    // Check health
    try {
      const health = await this.agent.health();
      console.log('✅ Connected to Ocelloids:', health);
    } catch (error) {
      console.warn('⚠️ Could not check health, but agent created');
    }
  }

  /**
   * Subscribe to XCM events using on-demand subscription
   * This follows the pattern from ephemeral.ts example
   */
  async subscribe(
    origins: string | string[],
    destinations: string | string[],
    senders: string[],
    callback?: (msg: Message<xcm.XcmMessagePayload>) => void
  ): Promise<void> {
    if (!this.agent) {
      throw new Error('Not connected. Call connect() first.');
    }

    console.log(`📡 Creating on-demand subscription...`);
    
    try {
      // On-demand subscription (no persistent subscription creation)
      const ws = await this.agent.subscribe(
        {
          origins: origins,
          destinations: destinations,
          senders: senders.length > 0 ? senders : ['*'],
          events: '*',
        },
        // Stream handlers
        {
          onMessage: (msg: Message<xcm.XcmMessagePayload>) => {
            this.logXcmEvent(msg);
            this.config.onEvent?.(msg);
            callback?.(msg);
          },
          onAuthError: (error: any) => {
            console.error('❌ Auth error:', error);
            this.config.onError?.(error);
          },
          onError: (error: any) => {
            console.error('❌ Subscription error:', error);
            this.config.onError?.(error);
          },
          onClose: (event: any) => {
            console.log('🔌 Subscription closed:', event?.reason || 'Unknown reason');
          },
        },
        // On-demand subscription handlers (optional)
        {
          onSubscriptionError: (error: any) => {
            console.error('❌ Subscription creation error:', error);
            console.error('   Details:', JSON.stringify(error, null, 2));
          },
          onSubscriptionCreated: (sub: any) => {
            console.log('✅ On-demand subscription created:', sub?.id || 'N/A');
            console.log('   Subscription details:', JSON.stringify(sub, null, 2));
          },
          onError: (error: any) => {
            console.error('❌ Error in subscription handler:', error);
            console.error('   Error details:', JSON.stringify(error, null, 2));
          },
        }
      );

      this.activeSubscriptions.set('default', ws);
      console.log(`✅ Subscribed successfully`);
    } catch (error: any) {
      console.error(`❌ Failed to subscribe:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe
   */
  unsubscribe(): void {
    const ws = this.activeSubscriptions.get('default');
    if (ws?.close) {
      ws.close();
      this.activeSubscriptions.delete('default');
      console.log(`🔇 Unsubscribed`);
    }
  }

  /**
   * Log XCM event using SDK helpers
   */
  private logXcmEvent(msg: Message<xcm.XcmMessagePayload>): void {
    try {
      if (xcm.isXcmSent(msg)) {
        console.log(`\n🌐 XCM SENT`);
        console.log(`   Origin: ${msg.payload.origin?.chainId || 'N/A'}`);
        console.log(`   Block: ${msg.payload.origin?.blockNumber || 'N/A'}`);
        console.log(`   Extrinsic: ${msg.payload.origin?.extrinsicHash || 'N/A'}`);
      } else if (xcm.isXcmRelayed(msg)) {
        console.log(`\n🌐 XCM RELAYED`);
        console.log(`   Chain: ${msg.payload.waypoint?.chainId || 'N/A'}`);
        console.log(`   Block: ${msg.payload.waypoint?.blockNumber || 'N/A'}`);
      } else if (xcm.isXcmHop(msg)) {
        console.log(`\n🌐 XCM HOP (${msg.payload.direction || 'N/A'})`);
        console.log(`   Chain: ${msg.payload.waypoint?.chainId || 'N/A'}`);
        console.log(`   Block: ${msg.payload.waypoint?.blockNumber || 'N/A'}`);
        const outcome = (msg.payload.waypoint as any)?.outcome;
        if (outcome) {
          console.log(`   Outcome: ${outcome}`);
          if (outcome === 'Fail') {
            console.error(`   ❌ FAILED AT HOP`);
          }
        }
      } else if (xcm.isXcmReceived(msg)) {
        console.log(`\n🌐 XCM RECEIVED`);
        console.log(`   Chain: ${msg.payload.waypoint?.chainId || 'N/A'}`);
        console.log(`   Block: ${msg.payload.waypoint?.blockNumber || 'N/A'}`);
        const outcome = (msg.payload.waypoint as any)?.outcome;
        if (outcome) {
          console.log(`   Outcome: ${outcome}`);
          if (outcome === 'Success') {
            console.log(`   ✅ DELIVERED SUCCESSFULLY`);
          }
        }
      } else if (xcm.isXcmTimeout(msg)) {
        console.error(`\n🌐 XCM TIMEOUT`);
        console.error(`   Origin: ${msg.payload.origin?.chainId || 'N/A'}`);
        console.error(`   Destination: ${msg.payload.destination?.chainId || 'N/A'}`);
      } else {
        console.log(`\n🌐 XCM ${msg.payload.type}`);
        console.log(`   Waypoint: ${msg.payload.waypoint?.chainId || 'N/A'}`);
      }
    } catch (error) {
      console.error('Error logging XCM event:', error);
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.unsubscribe();
    this.agent = null;
    console.log('👋 Disconnected');
  }

  /**
   * Check connection
   */
  isConnected(): boolean {
    return this.agent !== null;
  }
}
