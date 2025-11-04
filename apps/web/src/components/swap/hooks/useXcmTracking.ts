/**
 * useXcmTracking Hook
 * 
 * React hook to manage Ocelloids connection and XCM message tracking
 * Provides simple interface for tracking cross-chain message delivery
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { type Message, xcm } from '@sodazone/ocelloids-client';
import { OcelloidsClient } from '@/services/xcm-tracker/OcelloidsClient';
import { XcmMessageTracker } from '@/services/xcm-tracker/XcmMessageTracker';
import { getOcelloidsUrn, isChainSupported } from '@/services/xcm-tracker/chain-mapping';
import type {
  XcmDeliveryStatus,
  TrackedXcmMessage,
} from '@/services/xcm-tracker/types';

interface UseXcmTrackingProps {
  /** Ocelloids API key */
  apiKey?: string;
  /** Enable/disable tracking */
  enabled?: boolean;
  /** Callback when delivery status changes */
  onStatusChange?: (status: XcmDeliveryStatus, messages: TrackedXcmMessage[]) => void;
  /** Dev mode: Use wildcards for origin/destination (tracks all network activity) */
  useWildcards?: boolean;
}

interface UseXcmTrackingReturn {
  /** Current overall delivery status */
  deliveryStatus: XcmDeliveryStatus;
  /** All tracked XCM messages */
  messages: TrackedXcmMessage[];
  /** Start tracking XCM messages for a route */
  trackRoute: (
    originChain: string,
    destinationChain: string,
    senderAddress: string
  ) => void;
  /** Stop tracking and cleanup */
  stopTracking: () => void;
  /** Check if all messages delivered successfully */
  isAllDelivered: boolean;
  /** Check if any message failed */
  hasFailures: boolean;
  /** Get human-readable status message */
  statusMessage: string;
  /** Reset tracker */
  reset: () => void;
}

export function useXcmTracking({
  apiKey,
  enabled = true,
  onStatusChange,
  useWildcards = false,
}: UseXcmTrackingProps = {}): UseXcmTrackingReturn {
  const [deliveryStatus, setDeliveryStatus] = useState<XcmDeliveryStatus>('idle');
  const [messages, setMessages] = useState<TrackedXcmMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('No XCM messages tracked');

  const clientRef = useRef<OcelloidsClient | null>(null);
  const trackerRef = useRef<XcmMessageTracker | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  /**
   * Initialize Ocelloids client and message tracker
   */
  const initialize = useCallback(async () => {
    if (!apiKey || !enabled) {
      console.log('⚠️ XCM tracking disabled: No API key or disabled');
      return false;
    }

    if (isInitializedRef.current) {
      console.log('✅ XCM tracking already initialized');
      return true;
    }

    try {
      console.log('🚀 Initializing XCM tracking...');

      // Create message tracker
      trackerRef.current = new XcmMessageTracker((status, msgs) => {
        setDeliveryStatus(status);
        setMessages(msgs);
        setStatusMessage(trackerRef.current?.getStatusSummary() || '');
        onStatusChange?.(status, msgs);
      });

      // Create Ocelloids client
      clientRef.current = new OcelloidsClient({
        apiKey,
        onEvent: (event: Message<xcm.XcmMessagePayload>) => {
          // Process event through tracker
          trackerRef.current?.processEvent(event);
        },
        onError: (error: Error) => {
          console.error('❌ Ocelloids error:', error);
        },
      });

      // Connect to Ocelloids
      await clientRef.current.connect();
      
      isInitializedRef.current = true;
      console.log('✅ XCM tracking initialized');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize XCM tracking:', error);
      isInitializedRef.current = false;
      return false;
    }
  }, [apiKey, enabled, onStatusChange]);

  /**
   * Track XCM messages for a specific route
   */
  const trackRoute = useCallback(
    async (originChain: string, destinationChain: string, senderAddress: string) => {
      // Initialize if needed
      const initialized = await initialize();
      if (!initialized || !clientRef.current || !trackerRef.current) {
        console.warn('⚠️ Cannot track route: Ocelloids not initialized');
        return;
      }

      // Check if chains are supported
      if (!isChainSupported(originChain)) {
        console.warn(`⚠️ Origin chain not supported: ${originChain}`);
      }
      
      if (!isChainSupported(destinationChain)) {
        console.warn(`⚠️ Destination chain not supported: ${destinationChain}`);
      }

      // Map chain names to URNs (or use wildcards in dev mode)
      let originUrn: string;
      let destinationUrn: string;

      if (useWildcards) {
        // Dev mode: Track all chains (only for debugging/testing)
        originUrn = '*';
        destinationUrn = '*';
        console.warn('⚠️ DEV MODE: Using wildcard tracking (all chains)');
      } else {
        // Production mode: Track specific chains
        originUrn = getOcelloidsUrn(originChain);
        destinationUrn = getOcelloidsUrn(destinationChain);

        // Skip if we couldn't map chains
        if (!originUrn || !destinationUrn) {
          console.warn('⚠️ Cannot track route: Chain mapping failed');
          return;
        }
      }

      // Unsubscribe from previous subscription if exists
      if (subscriptionIdRef.current) {
        clientRef.current.unsubscribe();
        subscriptionIdRef.current = null;
      }

      console.log('🔭 Starting XCM tracking:', {
        origin: useWildcards ? '*' : originChain,
        destination: useWildcards ? '*' : destinationChain,
        sender: senderAddress,
        wildcards: useWildcards,
      });

      // Subscribe to XCM events (still filtered by sender address)
      await clientRef.current.subscribe(
        originUrn,
        destinationUrn,
        [senderAddress]  // ✅ Still filters by user's wallet!
      );
      
      subscriptionIdRef.current = 'active';

      // Update status to pending
      setDeliveryStatus('pending');
      setStatusMessage('Waiting for XCM messages...');
    },
    [initialize]
  );

  /**
   * Stop tracking and cleanup
   */
  const stopTracking = useCallback(() => {
    if (subscriptionIdRef.current && clientRef.current) {
      clientRef.current.unsubscribe();
      subscriptionIdRef.current = null;
    }
  }, []);

  /**
   * Reset tracker
   */
  const reset = useCallback(() => {
    trackerRef.current?.reset();
    setDeliveryStatus('idle');
    setMessages([]);
    setStatusMessage('No XCM messages tracked');
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      
      trackerRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  return {
    deliveryStatus,
    messages,
    trackRoute,
    stopTracking,
    isAllDelivered: trackerRef.current?.isAllDelivered() || false,
    hasFailures: trackerRef.current?.hasFailures() || false,
    statusMessage,
    reset,
  };
}


