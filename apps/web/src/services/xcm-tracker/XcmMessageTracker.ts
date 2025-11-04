/**
 * XCM Message Tracker
 * 
 * Tracks the lifecycle of XCM messages from sent → hop → received
 * Maintains state and determines overall delivery status
 */

import { type Message, xcm } from '@sodazone/ocelloids-client';
import type {
  TrackedXcmMessage,
  XcmMessageStatus,
  XcmDeliveryStatus
} from './types';

export class XcmMessageTracker {
  private messages: Map<string, TrackedXcmMessage> = new Map();
  private onStatusChange?: (status: XcmDeliveryStatus, messages: TrackedXcmMessage[]) => void;

  constructor(onStatusChange?: (status: XcmDeliveryStatus, messages: TrackedXcmMessage[]) => void) {
    this.onStatusChange = onStatusChange;
  }

  /**
   * Process an XCM event from Ocelloids
   */
  processEvent(event: Message<xcm.XcmMessagePayload>): void {
    // Use extrinsicHash as unique message identifier (each XCM transfer has unique hash)
    // Fallback to composite key if extrinsicHash not available
    const messageId = event.payload.origin?.extrinsicHash 
      || (event.payload.origin?.messageHash as string | undefined)
      || `${event.payload.origin?.chainId}-${event.payload.origin?.blockNumber}-${event.payload.origin?.timestamp}`
      || 'unknown';
    
    console.log(`🔍 Processing XCM event for message: ${messageId.substring(0, 12)}...`);
    
    // Get or create message tracker
    let message = this.messages.get(messageId);
    
    if (!message && event.payload?.origin) {
      message = {
        messageId,
        status: 'sent',
        origin: {
          chain: event.payload.origin.chainId || 'unknown',
          blockNumber: String(event.payload.origin.blockNumber || '0'),
          timestamp: event.payload.origin.timestamp || Date.now(),
        },
        hops: [],
      };
      this.messages.set(messageId, message);
      console.log(`📝 Created new message tracker: ${messageId.substring(0, 12)}... (Total: ${this.messages.size})`);
    }

    if (!message) {
      console.warn(`⚠️ Could not find or create message tracker for: ${messageId.substring(0, 12)}...`);
      return;
    }

    // Update message based on event type using SDK type guards
    if (xcm.isXcmSent(event)) {
      message.status = 'sent';
      console.log(`📤 XCM Message sent: ${messageId}`);
    } else if (xcm.isXcmHop(event)) {
      message.status = 'hopping';
      
      if (event.payload?.waypoint) {
        const outcome = (event.payload.waypoint as any)?.outcome || 'Success';
        // Add hop to tracking
        message.hops.push({
          chain: event.payload.waypoint.chainId || 'unknown',
          blockNumber: String(event.payload.waypoint.blockNumber || '0'),
          outcome: outcome,
          timestamp: event.payload.waypoint.timestamp || Date.now(),
          direction: event.payload.direction,
        });
        
        console.log(`🔀 XCM Hop: ${event.payload.waypoint.chainId} (${event.payload.direction || 'N/A'}) - ${outcome}`);
        
        // Check for failure at hop
        if (outcome === 'Fail') {
          message.status = 'failed';
          console.error(`❌ XCM failed at ${event.payload.waypoint.chainId}!`);
        }
      }
    } else if (xcm.isXcmReceived(event)) {
      if (event.payload?.waypoint) {
        const outcome = (event.payload.waypoint as any)?.outcome || 'Success';
        message.status = outcome === 'Success' ? 'received' : 'failed';
        message.destination = {
          chain: event.payload.waypoint.chainId || 'unknown',
          blockNumber: String(event.payload.waypoint.blockNumber || '0'),
          outcome: outcome,
          timestamp: event.payload.waypoint.timestamp || Date.now(),
        };
        
        if (outcome === 'Success') {
          console.log(`✅ XCM delivered successfully to ${event.payload.waypoint.chainId}`);
        } else {
          console.error(`❌ XCM failed at destination ${event.payload.waypoint.chainId}`);
        }
      }
    } else if (xcm.isXcmTimeout(event)) {
      message.status = 'timeout';
      console.error(`⏱️ XCM message timed out: ${messageId}`);
    }

    // Notify status change
    this.notifyStatusChange();
  }

  /**
   * Get overall delivery status
   */
  getDeliveryStatus(): XcmDeliveryStatus {
    if (this.messages.size === 0) {
      return 'idle';
    }

    const statuses = Array.from(this.messages.values()).map(m => m.status);
    
    // If any failed or timed out, overall status is failed
    if (statuses.some(s => s === 'failed' || s === 'timeout')) {
      return 'failed';
    }
    
    // If all received, status is delivered
    if (statuses.every(s => s === 'received')) {
      return 'delivered';
    }
    
    // If any in-flight, status is in-flight
    if (statuses.some(s => s === 'sent' || s === 'hopping')) {
      return 'in-flight';
    }
    
    return 'pending';
  }

  /**
   * Get all tracked messages
   */
  getMessages(): TrackedXcmMessage[] {
    return Array.from(this.messages.values());
  }

  /**
   * Get a specific message by ID
   */
  getMessage(messageId: string): TrackedXcmMessage | undefined {
    return this.messages.get(messageId);
  }

  /**
   * Check if all messages are delivered successfully
   */
  isAllDelivered(): boolean {
    if (this.messages.size === 0) return false;
    
    return Array.from(this.messages.values()).every(
      m => m.status === 'received' && m.destination?.outcome === 'Success'
    );
  }

  /**
   * Check if any message failed
   */
  hasFailures(): boolean {
    return Array.from(this.messages.values()).some(
      m => m.status === 'failed' || m.status === 'timeout'
    );
  }

  /**
   * Get failure details
   */
  getFailureDetails(): { chain: string; reason: string; blockNumber: string } | null {
    for (const message of this.messages.values()) {
      // Check for hop failures
      const failedHop = message.hops.find(hop => hop.outcome === 'Fail');
      if (failedHop) {
        return {
          chain: failedHop.chain,
          reason: 'XCM execution failed at intermediate chain',
          blockNumber: failedHop.blockNumber,
        };
      }
      
      // Check for destination failure
      if (message.destination && message.destination.outcome === 'Fail') {
        return {
          chain: message.destination.chain,
          reason: 'XCM execution failed at destination',
          blockNumber: message.destination.blockNumber,
        };
      }
      
      // Check for timeout
      if (message.status === 'timeout') {
        return {
          chain: message.origin.chain,
          reason: 'XCM message delivery timeout',
          blockNumber: message.origin.blockNumber,
        };
      }
    }
    
    return null;
  }

  /**
   * Reset tracker (clear all messages)
   */
  reset(): void {
    this.messages.clear();
    this.notifyStatusChange();
  }

  /**
   * Notify status change callback
   */
  private notifyStatusChange(): void {
    const status = this.getDeliveryStatus();
    const messages = this.getMessages();
    this.onStatusChange?.(status, messages);
  }

  /**
   * Get human-readable status summary
   */
  getStatusSummary(): string {
    const status = this.getDeliveryStatus();
    const messageCount = this.messages.size;
    
    switch (status) {
      case 'idle':
        return 'No XCM messages tracked';
      case 'pending':
        return 'Waiting for XCM messages...';
      case 'in-flight':
        return `${messageCount} XCM message(s) in transit`;
      case 'delivered':
        return `All ${messageCount} XCM message(s) delivered successfully!`;
      case 'failed':
        const failure = this.getFailureDetails();
        return failure 
          ? `XCM failed at ${failure.chain}: ${failure.reason}`
          : 'XCM delivery failed';
      default:
        return 'Unknown status';
    }
  }
}

