/**
 * XCM Tracking Types
 * Based on Ocelloids XCM Streams API
 * Reference: https://www.ocelloids.net/docs/apis/01_xcm-streams/
 */

/**
 * XCM Event types from Ocelloids
 */
export type XcmEventType = 
  | 'xcm.sent'      // XCM message sent from origin
  | 'xcm.received'  // XCM message received at destination
  | 'xcm.hop'       // XCM at intermediate chain (relay/bridge)
  | 'xcm.timeout'   // XCM delivery timeout
  | 'xcm.relayed'   // XCM relayed through intermediate
  | 'xcm.bridge';   // XCM crossed bridge

/**
 * XCM message outcome
 */
export type XcmOutcome = 'Success' | 'Fail';

/**
 * XCM message direction (for hop events)
 */
export type XcmDirection = 'in' | 'out';

/**
 * Leg of XCM journey (origin → intermediate → destination)
 */
export interface XcmLeg {
  from: string;     // Origin chain URN
  to: string;       // Destination chain URN
  type: 'hop' | 'hrmp' | 'ump' | 'dmp';
  relay?: string;   // Relay chain URN (for HRMP)
  partialMessage?: string;
}

/**
 * Chain event details
 */
export interface ChainEventDetails {
  chainId: string;
  blockNumber: string;
  blockHash: string;
  timestamp: number;
  outcome: XcmOutcome;
  error?: string | null;
  messageData?: string;
  messageHash?: string;
  instructions?: any;
  event?: any;
}

/**
 * Waypoint details (for hop events)
 */
export interface WaypointDetails extends ChainEventDetails {
  legIndex: number;
}

/**
 * Complete XCM Event from Ocelloids
 */
export interface XcmEvent {
  type: XcmEventType;
  messageId: string;
  legs: XcmLeg[];
  
  // Origin details (always present)
  origin: ChainEventDetails;
  
  // Destination details (present in xcm.sent, xcm.received)
  destination?: Partial<ChainEventDetails>;
  
  // Waypoint details (present in xcm.hop)
  waypoint?: WaypointDetails;
  
  // Direction (present in xcm.hop)
  direction?: XcmDirection;
}

/**
 * Tracked XCM Message Status
 */
export type XcmMessageStatus = 
  | 'sent'      // Message sent from origin
  | 'hopping'   // Message at intermediate chain
  | 'received'  // Message received at destination
  | 'failed'    // Message failed
  | 'timeout';  // Message timed out

/**
 * Simplified XCM Message Tracker
 */
export interface TrackedXcmMessage {
  messageId: string;
  status: XcmMessageStatus;
  
  origin: {
    chain: string;
    blockNumber: string;
    timestamp: number;
  };
  
  hops: Array<{
    chain: string;
    blockNumber: string;
    outcome: XcmOutcome;
    timestamp: number;
    direction?: XcmDirection;
  }>;
  
  destination?: {
    chain: string;
    blockNumber: string;
    outcome: XcmOutcome;
    timestamp: number;
  };
}

/**
 * Ocelloids WebSocket Subscription
 */
export interface OcelloidsSubscription {
  id: string;
  agent: 'xcm';
  args: {
    origins: string[];
    destinations: string[];
    senders: string[];
    events: string | string[];
  };
}

/**
 * XCM Tracking Configuration
 */
export interface XcmTrackingConfig {
  apiKey: string;
  wsEndpoint?: string;
  onEvent?: (event: XcmEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * Overall XCM delivery status
 */
export type XcmDeliveryStatus = 
  | 'idle'        // Not tracking
  | 'pending'     // Waiting for XCM to be sent
  | 'in-flight'   // XCM messages in transit
  | 'delivered'   // All XCM messages delivered successfully
  | 'failed';     // One or more XCM messages failed


