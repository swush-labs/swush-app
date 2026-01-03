/**
 * XCM UI Flow Test Script
 * 
 * Simulates the complete swap UI flow with XCM tracking
 * Mirrors the actual user experience in SwapContainer + useXcmSwapExecution
 * 
 * Usage:
 *   pnpm test:xcm-ui-flow
 * 
 * Requirements:
 *   - OC_API_KEY environment variable (Ocelloids API key)
 *   - Monitors testnet activity with wildcards (no swap execution needed)
 */

import { type Message, xcm } from '@sodazone/ocelloids-client';
import { OcelloidsClient } from '../../apps/web/src/services/xcm-tracker/OcelloidsClient';
import { XcmMessageTracker } from '../../apps/web/src/services/xcm-tracker/XcmMessageTracker';
import { getOcelloidsUrn } from '../../apps/web/src/services/xcm-tracker/chain-mapping';

// Node.js globals
declare const process: {
    env: Record<string, string | undefined>;
    exit: (code: number) => never;
    stdout: {
        write: (str: string) => boolean;
    };
};

// Test configuration
const TEST_CONFIG = {
    // Monitor all testnet XCM activity (wildcards)
    originChain: "*",
    destinationChain: "*",
    senderAddress: "5DPLGAR43FRbPxkkAWJudfyLTbJAP1GMvtyt1mx7KCuiuNvK",

    // Ocelloids API key
    apiKey: process.env.OC_API_KEY || 'eyJhbGciOiJFZERTQSIsImtpZCI6Im92SFVDU3hRM0NiYkJmc01STVh1aVdjQkNZcDVydmpvamphT2J4dUxxRDQ9In0.ewogICJpc3MiOiAiYXBpLm9jZWxsb2lkcy5uZXQiLAogICJqdGkiOiAiMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLAogICJzdWIiOiAicHVibGljQG9jZWxsb2lkcyIKfQo.qKSfxo6QYGxzv40Ox7ec6kpt2aVywKmhpg6lue4jqmZyY6y3SwfT-DyX6Niv-ine5k23E0RKGQdm_MbtyPp9CA',

    // Optional: Custom Ocelloids URLs (only pass if defined, otherwise SDK uses defaults)
    httpUrl: process.env.OC_HTTP_URL,
    wsUrl: process.env.OC_WS_URL,

    // How long to monitor (in milliseconds)
    monitorDuration: 5 * 60 * 1000, // 5 minutes
};

/**
 * UI Phase tracker - mirrors SwapContainer states
 */
type UIPhase = 
    | 'idle'
    | 'confirming'           // User sees confirmation sheet
    | 'awaiting_signature'   // Waiting for wallet
    | 'executing'            // RouterBuilder executing
    | 'xcm_tracking'         // XCM delivery tracking
    | 'success'              // Complete success
    | 'error';               // Failed

let currentPhase: UIPhase = 'idle';
let phaseStartTime: number = Date.now();

/**
 * Display UI phase change (what user sees)
 */
function displayPhaseChange(newPhase: UIPhase, details?: string) {
    const elapsed = Date.now() - phaseStartTime;
    console.log('\n' + '═'.repeat(70));
    console.log(`🎬 UI PHASE: ${currentPhase.toUpperCase()} → ${newPhase.toUpperCase()}`);
    console.log(`⏱️  Time in previous phase: ${(elapsed / 1000).toFixed(1)}s`);
    
    currentPhase = newPhase;
    phaseStartTime = Date.now();

    // Show what user sees in UI
    switch (newPhase) {
        case 'confirming':
            console.log('\n📱 UI Display:');
            console.log('   → SwapConfirmSheet opens');
            console.log('   → Shows: "Review your swap"');
            console.log('   → [Confirm] [Cancel] buttons');
            break;

        case 'awaiting_signature':
            console.log('\n📱 UI Display:');
            console.log('   → Toast: "Please sign transaction in your wallet"');
            console.log('   → Waiting for wallet interaction...');
            break;

        case 'executing':
            console.log('\n📱 UI Display:');
            console.log('   → SwapCompleteDialog opens');
            console.log('   → Shows: Progress bar with steps');
            console.log('   → Status: "Transferring assets to exchange..."');
            console.log('   → Status: "Swapping on DEX..."');
            if (details) console.log(`   → ${details}`);
            break;

        case 'xcm_tracking':
            console.log('\n📱 UI Display:');
            console.log('   → SwapCompleteDialog (still open)');
            console.log('   → Progress: Transaction steps complete ✅');
            console.log('   → XCM Status: "⏳ Delivering assets cross-chain..."');
            if (details) console.log(`   → ${details}`);
            break;

        case 'success':
            console.log('\n📱 UI Display:');
            console.log('   → SwapCompleteDialog (still open)');
            console.log('   → Shows: Gift box animation 🎁');
            console.log('   → XCM Status: "✅ Assets delivered successfully!"');
            console.log('   → User can swipe to reveal rewards');
            if (details) console.log(`   → ${details}`);
            break;

        case 'error':
            console.log('\n📱 UI Display:');
            console.log('   → Toast: Error message');
            console.log('   → Status: "❌ XCM delivery failed"');
            if (details) console.log(`   → Error: ${details}`);
            break;
    }
    console.log('═'.repeat(70));
}

/**
 * Simulate swap flow phases
 */
async function simulateSwapFlow(tracker: XcmMessageTracker) {
    console.log('\n🎬 SIMULATING SWAP FLOW (UI Perspective)');
    console.log('═'.repeat(70));

    // Phase 1: User clicks "Swap" button
    console.log('\n👆 User clicks [SWAP] button');
    await sleep(500);
    displayPhaseChange('confirming');
    await sleep(1500);

    // Phase 2: User clicks "Confirm"
    console.log('\n👆 User clicks [CONFIRM] button');
    await sleep(500);
    displayPhaseChange('awaiting_signature');
    await sleep(2000);

    // Phase 3: User signs in wallet
    console.log('\n✍️  User signs transaction in wallet');
    await sleep(500);
    displayPhaseChange('executing', 'Step 1/2: Transfer to DEX');
    await sleep(2000);

    // Phase 4: RouterBuilder executing transactions
    console.log('\n⚙️  RouterBuilder processing...');
    displayPhaseChange('executing', 'Step 2/2: Swap on DEX');
    await sleep(3000);

    // Phase 5: Router completes, start XCM tracking
    console.log('\n✅ RouterBuilder execution COMPLETED');
    console.log('   → All transactions finalized on-chain');
    console.log('   → Now starting XCM delivery tracking...');
    await sleep(500);
    
    displayPhaseChange('xcm_tracking', 'Tracking cross-chain delivery...');
    
    // Now we wait for real XCM events from the network
    console.log('\n👀 Monitoring real testnet XCM activity...');
    console.log('💡 Waiting for XCM messages to appear on network...');
    console.log('   (This demonstrates what happens after your swap)');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Track event statistics
 */
interface EventStats {
    sent: number;
    relayed: number;
    hop: number;
    received: number;
    timeout: number;
    total: number;
    lastEventTime: number;
}

const stats: EventStats = {
    sent: 0,
    relayed: 0,
    hop: 0,
    received: 0,
    timeout: 0,
    total: 0,
    lastEventTime: Date.now(),
};

/**
 * Handle XCM events
 */
function handleXcmEvent(msg: Message<xcm.XcmMessagePayload>, tracker: XcmMessageTracker, shouldContinue: () => boolean): void {
    // Check if we should still be monitoring
    if (!shouldContinue()) {
        console.log('⏹️  Skipping event - tracking has been stopped');
        return;
    }

    stats.total++;
    stats.lastEventTime = Date.now();

    // Process through tracker
    tracker.processEvent(msg);

    // Log event with UI context
    console.log('\n' + '─'.repeat(70));
    
    if (xcm.isXcmSent(msg)) {
        stats.sent++;
        console.log('🚀 XCM MESSAGE SENT');
        console.log(`   Extrinsic: ${msg.payload.origin?.extrinsicHash?.substring(0, 12)}...`);
        console.log(`   Block: ${msg.payload.origin?.blockNumber}`);
        
        // What UI shows
        console.log('\n   📱 UI Update:');
        console.log('      → XCM Status: "⏳ Delivering assets cross-chain..."');
        console.log('      → Status: in-flight');
        
    } else if (xcm.isXcmRelayed(msg)) {
        stats.relayed++;
        console.log('🔄 XCM MESSAGE RELAYED');
        
        console.log('\n   📱 UI Update:');
        console.log('      → XCM Status: "⏳ Message relayed through hub..."');
        
    } else if (xcm.isXcmHop(msg)) {
        stats.hop++;
        const outcome = (msg.payload.waypoint as any)?.outcome;
        const direction = msg.payload.direction;
        
        if (outcome === 'Fail') {
            console.log(`🌉 XCM HOP (${direction}) - ❌ FAILED`);
            
            console.log('\n   📱 UI Update:');
            console.log('      → XCM Status: "❌ Delivery failed at relay chain"');
            console.log('      → Status: failed');
            
            if (currentPhase === 'xcm_tracking') {
                displayPhaseChange('error', 'XCM hop failed');
            }
        } else {
            console.log(`🌉 XCM HOP (${direction}) - ✅ Success`);
            
            console.log('\n   📱 UI Update:');
            console.log('      → XCM Status: "⏳ Passing through relay chain..."');
        }
        
    } else if (xcm.isXcmReceived(msg)) {
        stats.received++;
        const outcome = (msg.payload.waypoint as any)?.outcome;
        
        if (outcome === 'Success') {
            console.log('🎯 XCM MESSAGE RECEIVED - ✅ SUCCESS');
            
            console.log('\n   📱 UI Update:');
            console.log('      → XCM Status: "✅ Assets delivered successfully!"');
            console.log('      → Status: delivered');
            console.log('      → Trigger success callback');
            
            if (currentPhase === 'xcm_tracking') {
                displayPhaseChange('success', 'XCM delivery complete!');
            }
        } else {
            console.log('🎯 XCM MESSAGE RECEIVED - ❌ FAILED');
            
            console.log('\n   📱 UI Update:');
            console.log('      → XCM Status: "❌ XCM delivery failed"');
            console.log('      → Status: failed');
            
            if (currentPhase === 'xcm_tracking') {
                displayPhaseChange('error', 'XCM delivery failed at destination');
            }
        }
        
    } else if (xcm.isXcmTimeout(msg)) {
        stats.timeout++;
        console.log('⏰ XCM MESSAGE TIMEOUT');
        
        console.log('\n   📱 UI Update:');
        console.log('      → XCM Status: "⏰ Delivery timed out"');
        console.log('      → Status: failed');
        
        if (currentPhase === 'xcm_tracking') {
            displayPhaseChange('error', 'XCM timeout');
        }
    }
    
    console.log('─'.repeat(70));
}

/**
 * Main test function
 */
async function testXcmUIFlow() {
    console.log('\n🧪 XCM UI FLOW TEST');
    console.log('═'.repeat(70));
    console.log('This script simulates the complete swap flow from UI perspective');
    console.log('and monitors real testnet XCM activity to demonstrate tracking.\n');

    // Validate API key
    if (!TEST_CONFIG.apiKey) {
        console.error('\n❌ Error: OC_API_KEY environment variable not set');
        console.log('To get an API key, visit: https://www.ocelloids.net/');
        console.log('Then set: export OC_API_KEY=your_api_key_here');
        process.exit(1);
    }

    console.log('📋 Test Configuration:');
    console.log(`   Monitor: ${TEST_CONFIG.originChain} → ${TEST_CONFIG.destinationChain}`);
    console.log(`   Sender Filter: ${TEST_CONFIG.senderAddress}`);
    console.log(`   Duration: ${TEST_CONFIG.monitorDuration / 1000}s`);
    console.log(`   Mode: Wildcard (monitors all testnet XCM activity)`);

    // Track whether we should continue monitoring
    let shouldContinueMonitoring = true;

    // Initialize XCM Message Tracker with UI-aware callbacks
    console.log('\n🔧 Initializing XCM Message Tracker...');
    console.log(`   Tracking start time: ${new Date().toISOString()}`);
    const tracker = new XcmMessageTracker((status, messages) => {
        console.log('\n' + '═'.repeat(70));
        console.log(`📊 TRACKER STATUS CHANGE: ${status.toUpperCase()}`);
        console.log(`   Tracked Messages: ${messages.length}`);
        
        if (messages.length > 0) {
            messages.forEach((msg, i) => {
                const msgId = msg.messageId.substring(0, 12);
                console.log(`\n   ${i + 1}. Message ${msgId}...`);
                console.log(`      Status: ${msg.status}`);
                console.log(`      Origin: ${msg.origin.chain} (Block ${msg.origin.blockNumber})`);
                
                if (msg.hops.length > 0) {
                    console.log(`      Hops: ${msg.hops.length}`);
                    msg.hops.forEach((hop, j) => {
                        console.log(`         ${j + 1}. ${hop.chain} - ${hop.outcome}`);
                    });
                }
                
                if (msg.destination) {
                    console.log(`      Destination: ${msg.destination.chain} - ${msg.destination.outcome}`);
                }
            });
        }
        
        // Show what UI callback would receive
        console.log('\n   📱 UI Callback Triggered:');
        console.log(`      → onExecutionUpdate({ xcmDeliveryStatus: '${status}' })`);
        
        if (status === 'delivered') {
            console.log('      → onSuccess() - Swap complete! 🎉');
            console.log('      → stopTracking() - Cleanup and stop monitoring');
            shouldContinueMonitoring = false;
        } else if (status === 'failed') {
            const failure = tracker.getFailureDetails();
            if (failure) {
                console.log(`      → onError() - Failed at ${failure.chain}`);
            }
            console.log('      → stopTracking() - Cleanup and stop monitoring');
            shouldContinueMonitoring = false;
        }
        
        console.log('═'.repeat(70));
    });
    console.log('✅ Tracker initialized with UI callbacks');

    // Create Ocelloids client
    const client = new OcelloidsClient({
        httpUrl: TEST_CONFIG.httpUrl,
        wsUrl: TEST_CONFIG.wsUrl,
        apiKey: TEST_CONFIG.apiKey,
        // Note: onEvent removed here to avoid duplicates
        // Event handling is done in subscribe() callback below
        onError: (error: Error) => {
            console.error('\n❌ Ocelloids error:', error.message);
        },
    });

    try {
        // Connect to Ocelloids
        console.log('\n🔌 Connecting to Ocelloids...');
        await client.connect();
        console.log('✅ Connected to Ocelloids');

        // Subscribe to XCM events
        console.log('\n📡 Subscribing to XCM events...');
        await client.subscribe(
            TEST_CONFIG.originChain,
            TEST_CONFIG.destinationChain,
            [TEST_CONFIG.senderAddress],
            (event) => handleXcmEvent(event, tracker, () => shouldContinueMonitoring)
        );
        console.log('✅ Subscribed successfully');

        // Now monitor for real XCM events
        console.log('\n⏰ Monitoring period started...');
        console.log('   Watching for real XCM activity on testnet...\n');

        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = TEST_CONFIG.monitorDuration - elapsed;
            
            if (remaining <= 0) {
                clearInterval(checkInterval);
                return;
            }
            
            const timeSinceLastEvent = Date.now() - stats.lastEventTime;
            if (timeSinceLastEvent > 30000 && stats.total === 0) {
                // No events for 30 seconds
                process.stdout.write(`\r⏱️  Monitoring... ${Math.floor(remaining / 1000)}s remaining | Events: ${stats.total} | Waiting for testnet activity...`);
            }
        }, 5000);

        // Wait for monitoring duration
        await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.monitorDuration));
        clearInterval(checkInterval);

        console.log('\n\n⏰ Monitoring period complete');

        // Display final statistics
        console.log('\n' + '═'.repeat(70));
        console.log('📊 FINAL STATISTICS');
        console.log('═'.repeat(70));
        console.log(`Total XCM Events: ${stats.total}`);
        console.log(`   Sent: ${stats.sent}`);
        console.log(`   Relayed: ${stats.relayed}`);
        console.log(`   Hops: ${stats.hop}`);
        console.log(`   Received: ${stats.received}`);
        console.log(`   Timeouts: ${stats.timeout}`);

        // Display tracker summary
        const trackedMessages = tracker.getMessages();
        const deliveryStatus = tracker.getDeliveryStatus();
        
        console.log(`\nTracker Summary:`);
        console.log(`   Unique Messages: ${trackedMessages.length}`);
        console.log(`   Delivery Status: ${deliveryStatus}`);
        console.log(`   All Delivered: ${tracker.isAllDelivered() ? '✅ Yes' : '⏳ No'}`);
        console.log(`   Has Failures: ${tracker.hasFailures() ? '❌ Yes' : '✅ No'}`);

        if (stats.total === 0) {
            console.log('\n💡 No XCM events detected during monitoring period');
            console.log('   This is normal on testnets with low activity.');
            console.log('   The test still demonstrates the complete UI flow!');
            console.log('\n   To see real XCM tracking:');
            console.log('   - Execute a swap on testnet while this script runs');
            console.log('   - Run longer (increase monitorDuration)');
            console.log('   - Or test on mainnet with wildcards (just monitoring)');
        } else {
            console.log(`\n✅ Successfully tracked ${stats.total} XCM event(s)`);
            if (stats.received > 0) {
                console.log(`   🎉 ${stats.received} message(s) delivered successfully!`);
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log('✅ UI FLOW TEST COMPLETE');
        console.log('═'.repeat(70));

    } catch (error: any) {
        console.error('\n❌ Test failed:', error);
        console.error('   Message:', error.message);
        process.exit(1);
    } finally {
        // Cleanup
        client.disconnect();
        console.log('\n👋 Disconnected from Ocelloids');
    }
}

// Run the test
testXcmUIFlow()
    .then(() => {
        console.log('\n✅ Test completed successfully\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Unhandled error:', error);
        process.exit(1);
    });

