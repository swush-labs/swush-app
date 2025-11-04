/**
 * XCM Tracking Test Script
 * 
 * Tests Ocelloids XCM tracking integration with a simple testnet transfer
 * 
 * Usage:
 *   pnpm test:xcm-tracking
 * 
 * Requirements:
 *   - OCELLOIDS_API_KEY environment variable (optional, uses default public key)
 *   - TESTNET_WALLET_ADDRESS environment variable (optional, defaults to *)
 */

import { type Message, xcm } from '@sodazone/ocelloids-client';
import { OcelloidsClient } from '../apps/web/src/services/xcm-tracker/OcelloidsClient';
import { XcmMessageTracker } from '../apps/web/src/services/xcm-tracker/XcmMessageTracker';
import { getOcelloidsUrn, isChainSupported } from '../apps/web/src/services/xcm-tracker/chain-mapping';

// Node.js globals
declare const process: {
    env: Record<string, string | undefined>;
    exit: (code: number) => never;
};

// Test configuration
const TEST_CONFIG = {
    // Test on Paseo testnet (Polkadot's new community testnet)
    originChain: "*",
    destinationChain: "*",
    // Sender address - defaults to public test address
    senderAddress: process.env.TESTNET_WALLET_ADDRESS || '5DPLGAR43FRbPxkkAWJudfyLTbJAP1GMvtyt1mx7KCuiuNvK',

    // Ocelloids API key - use OC_API_KEY env var or fallback to public key
    apiKey: process.env.OC_API_KEY || 'eyJhbGciOiJFZERTQSIsImtpZCI6Im92SFVDU3hRM0NiYkJmc01STVh1aVdjQkNZcDVydmpvamphT2J4dUxxRDQ9In0.ewogICJpc3MiOiAiYXBpLm9jZWxsb2lkcy5uZXQiLAogICJqdGkiOiAiMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLAogICJzdWIiOiAicHVibGljQG9jZWxsb2lkcyIKfQo.qKSfxo6QYGxzv40Ox7ec6kpt2aVywKmhpg6lue4jqmZyY6y3SwfT-DyX6Niv-ine5k23E0RKGQdm_MbtyPp9CA',
    // Optional: Custom Ocelloids URLs (only pass if defined, otherwise SDK uses defaults)
    httpUrl: process.env.OC_HTTP_URL,
    wsUrl: process.env.OC_WS_URL,

    // How long to monitor (in milliseconds)
    monitorDuration: 5 * 60 * 1000, // 5 minutes
};

/**
 * Track message statistics
 */
interface MessageStats {
    sent: number;
    relayed: number;
    hop: number;
    received: number;
    timeout: number;
    total: number;
}

const stats: MessageStats = {
    sent: 0,
    relayed: 0,
    hop: 0,
    received: 0,
    timeout: 0,
    total: 0,
};

// Create tracker instance (will be initialized in main function)
let tracker: XcmMessageTracker | null = null;

/**
 * Handle XCM message
 */
function handleMessage(msg: Message<xcm.XcmMessagePayload>): void {
    stats.total++;

    // Process through tracker for live tracking
    if (tracker) {
        tracker.processEvent(msg);
    }

    // Log basic event info
    if (xcm.isXcmSent(msg)) {
        stats.sent++;
        console.log('\n🚀 XCM SENT');
        console.log(`   Extrinsic: ${msg.payload.origin?.extrinsicHash?.substring(0, 12)}...`);
    } else if (xcm.isXcmRelayed(msg)) {
        stats.relayed++;
        console.log('\n🔄 XCM RELAYED');
    } else if (xcm.isXcmHop(msg)) {
        stats.hop++;
        const outcome = (msg.payload.waypoint as any)?.outcome;
        if (outcome === 'Fail') {
            console.log(`\n🌉 XCM HOP (${msg.payload.direction}) - ❌ FAILED`);
        } else {
            console.log(`\n🌉 XCM HOP (${msg.payload.direction})`);
        }
    } else if (xcm.isXcmReceived(msg)) {
        stats.received++;
        const outcome = (msg.payload.waypoint as any)?.outcome;
        if (outcome === 'Success') {
            console.log('\n🎯 XCM RECEIVED - ✅ SUCCESS');
        } else {
            console.log('\n🎯 XCM RECEIVED');
        }
    } else if (xcm.isXcmTimeout(msg)) {
        stats.timeout++;
        console.log('\n⏰ XCM TIMEOUT');
    }
}

/**
 * Test XCM tracking on testnet
 */
async function testXcmTracking() {
    console.log('\n🧪 XCM Tracking Test Script');
    console.log('='.repeat(60));

    // Validate configuration
    if (!TEST_CONFIG.apiKey) {
        console.error('\n❌ Error: OCELLOIDS_API_KEY environment variable not set');
        console.log('To get an API key, visit: https://www.ocelloids.net/');
        console.log('Then set: export OCELLOIDS_API_KEY=your_api_key_here');
        process.exit(1);
    }

    // Check chain support
    console.log('\n📋 Configuration:');
    console.log(`   Origin: ${TEST_CONFIG.originChain}`);
    console.log(`   Destination: ${TEST_CONFIG.destinationChain}`);
    console.log(`   Sender: ${TEST_CONFIG.senderAddress}`);
    console.log(`   Duration: ${TEST_CONFIG.monitorDuration / 1000}s`);

    // Map chains to URNs (or use wildcards)
    const originUrn = TEST_CONFIG.originChain === '*' ? '*' : getOcelloidsUrn(TEST_CONFIG.originChain);
    const destinationUrn = TEST_CONFIG.destinationChain === '*' ? '*' : getOcelloidsUrn(TEST_CONFIG.destinationChain);

    // Validate only if not using wildcards
    if (TEST_CONFIG.originChain !== '*' && !isChainSupported(TEST_CONFIG.originChain)) {
        console.error(`\n❌ Error: Origin chain "${TEST_CONFIG.originChain}" not supported`);
        process.exit(1);
    }

    if (TEST_CONFIG.destinationChain !== '*' && !isChainSupported(TEST_CONFIG.destinationChain)) {
        console.error(`\n❌ Error: Destination chain "${TEST_CONFIG.destinationChain}" not supported`);
        process.exit(1);
    }

    console.log('\n🔗 Chain URNs:');
    console.log(`   Origin: ${originUrn}`);
    console.log(`   Destination: ${destinationUrn}`);

    // Initialize XCM Message Tracker with status change callback
    console.log('\n🔧 Initializing XCM Message Tracker...');
    tracker = new XcmMessageTracker((status, messages) => {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 TRACKER STATUS UPDATE: ${status.toUpperCase()}`);
        console.log(`   Unique Messages Tracked: ${messages.length}`);
        
        messages.forEach((msg, i) => {
            const msgId = msg.messageId.substring(0, 12);
            console.log(`   ${i + 1}. ${msgId}... - ${msg.status}`);
            console.log(`      Origin: ${msg.origin.chain} (Block ${msg.origin.blockNumber})`);
            
            if (msg.hops.length > 0) {
                console.log(`      Hops: ${msg.hops.length}`);
                msg.hops.forEach((hop, j) => {
                    console.log(`         ${j + 1}. ${hop.chain} - ${hop.outcome}`);
                });
            }
            
            if (msg.destination) {
                console.log(`      Destination: ${msg.destination.chain} - ${msg.destination.outcome}`);
            } else {
                console.log(`      Destination: Pending...`);
            }
        });
        
        const statusMsg = tracker?.getStatusSummary() || '';
        console.log(`\n   📝 Summary: ${statusMsg}`);
        
        if (status === 'delivered') {
            console.log('\n   🎉🎉🎉 ALL XCM MESSAGES DELIVERED SUCCESSFULLY! 🎉🎉🎉');
        } else if (status === 'failed') {
            const failure = tracker?.getFailureDetails();
            if (failure) {
                console.log(`\n   ❌ FAILURE at ${failure.chain}: ${failure.reason}`);
            }
        }
        console.log('='.repeat(60));
    });
    console.log('✅ Tracker initialized');

    // Create Ocelloids client
    const client = new OcelloidsClient({
        httpUrl: TEST_CONFIG.httpUrl,
        wsUrl: TEST_CONFIG.wsUrl,
        apiKey: TEST_CONFIG.apiKey,
        onEvent: handleMessage,
        onError: (error) => {
            console.error('\n❌ Error:', error.message);
        },
    });

    try {
        // Connect to Ocelloids
        console.log('\n🔌 Connecting to Ocelloids...');
        await client.connect();

        // Subscribe to XCM events
        console.log('\n📡 Subscribing to XCM events...');
        
        await client.subscribe(
            originUrn,
            destinationUrn,
            TEST_CONFIG.senderAddress === '*' ? ['*'] : [TEST_CONFIG.senderAddress],
            handleMessage
        );

        console.log('\n👀 Monitoring XCM events...');

        if (TEST_CONFIG.senderAddress === '*') {
            console.log('💡 Monitoring all senders on this route');
            console.log('   To filter: export TESTNET_WALLET_ADDRESS=your_address');
        } else {
            console.log(`🔍 Filtering by sender: ${TEST_CONFIG.senderAddress}`);
        }

        // Wait for specified duration
        await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.monitorDuration));

        console.log('\n⏰ Monitoring period ended');

        // Display event statistics summary
        console.log('\n📊 Event Statistics:');
        console.log(`   Total events: ${stats.total}`);
        console.log(`   Sent: ${stats.sent}`);
        console.log(`   Relayed: ${stats.relayed}`);
        console.log(`   Hops: ${stats.hop}`);
        console.log(`   Received: ${stats.received}`);
        console.log(`   Timeouts: ${stats.timeout}`);

        // Display tracker summary
        if (tracker) {
            const trackedMessages = tracker.getMessages();
            const deliveryStatus = tracker.getDeliveryStatus();
            
            console.log('\n📦 Tracker Summary:');
            console.log(`   Unique Messages: ${trackedMessages.length}`);
            console.log(`   Delivery Status: ${deliveryStatus}`);
            console.log(`   All Delivered: ${tracker.isAllDelivered() ? '✅ Yes' : '⏳ No'}`);
            console.log(`   Has Failures: ${tracker.hasFailures() ? '❌ Yes' : '✅ No'}`);
            
            if (trackedMessages.length > 0) {
                console.log('\n   Messages:');
                trackedMessages.forEach((msg, i) => {
                    const msgId = msg.messageId.substring(0, 12);
                    console.log(`   ${i + 1}. ${msgId}... - ${msg.status}`);
                });
            }
            
            const statusSummary = tracker.getStatusSummary();
            console.log(`\n   ${statusSummary}`);
        }

        if (stats.total === 0) {
            console.log('\nℹ️  No XCM messages detected during monitoring period');
            console.log('   This could mean:');
            console.log('   - No transfers occurred');
            console.log('   - Transfers occurred on different routes');
            console.log('   - Sender filter was too restrictive');
        } else {
            console.log(`\n✅ Detected ${stats.total} XCM event(s)`);
            if (stats.received > 0) {
                console.log(`   ${stats.received} message(s) successfully delivered!`);
            }
        }

    } catch (error: any) {
        console.error('\n❌ Test failed:', error);
        console.error('   Message:', error.message);
        if (error.stack) {
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    } finally {
        // Cleanup
        client.disconnect();
        console.log('\n👋 Disconnected from Ocelloids');
    }
}

// Run the test
testXcmTracking()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Unhandled error:', error);
        process.exit(1);
    });

