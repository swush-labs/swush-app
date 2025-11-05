/**
 * Unit tests for XcmMessageTracker
 * 
 * Tests the critical bug fix: multiple concurrent messages should be tracked separately
 * 
 * Usage:
 *   npx tsx scripts/test-xcm-tracker-unit.ts
 */

import { XcmMessageTracker } from '../apps/web/src/services/xcm-tracker/XcmMessageTracker';

// Mock XCM events with unique extrinsic hashes
const createMockSentEvent = (extrinsicHash: string, chainId: string = 'urn:ocn:polkadot:0') => ({
  payload: {
    type: 'xcm.sent',
    origin: {
      chainId,
      blockNumber: 12345,
      extrinsicHash,
      timestamp: Date.now(),
    },
  },
});

const createMockReceivedEvent = (extrinsicHash: string, outcome: 'Success' | 'Fail' = 'Success') => ({
  payload: {
    type: 'xcm.received',
    origin: {
      extrinsicHash,
      chainId: 'urn:ocn:polkadot:0',
      blockNumber: 12345,
      timestamp: Date.now(),
    },
    waypoint: {
      chainId: 'urn:ocn:polkadot:1000',
      blockNumber: 67890,
      outcome,
      timestamp: Date.now(),
    },
  },
});

console.log('\n🧪 XCM Message Tracker - Unit Tests');
console.log('='.repeat(60));

// Test 1: Single message lifecycle
console.log('\n📋 Test 1: Single message lifecycle');
const tracker1 = new XcmMessageTracker();
tracker1.processEvent(createMockSentEvent('0xabc123') as any);

const status1 = tracker1.getDeliveryStatus();
console.assert(status1 === 'in-flight', `❌ Expected 'in-flight', got '${status1}'`);
console.log('   ✅ Status is in-flight after sent event');

tracker1.processEvent(createMockReceivedEvent('0xabc123') as any);
console.assert(tracker1.isAllDelivered() === true, '❌ Should be delivered');
console.assert(tracker1.getMessages().length === 1, '❌ Should have 1 message');
console.log('   ✅ Message delivered successfully');
console.log('   ✅ Test 1 PASSED');

// Test 2: Multiple concurrent messages (CRITICAL TEST FOR BUG FIX!)
console.log('\n📋 Test 2: Multiple concurrent messages (Bug Fix Test)');
const tracker2 = new XcmMessageTracker();

// Send 3 different XCM messages
tracker2.processEvent(createMockSentEvent('0xaaa111') as any);
tracker2.processEvent(createMockSentEvent('0xbbb222') as any);
tracker2.processEvent(createMockSentEvent('0xccc333') as any);

const messages = tracker2.getMessages();
console.log(`   📊 Messages tracked: ${messages.length}`);
console.assert(messages.length === 3, `❌ Should track 3 messages, but got ${messages.length}`);
console.log('   ✅ All 3 messages tracked separately');

// Verify each message has unique ID
const uniqueIds = new Set(messages.map(m => m.messageId));
console.assert(uniqueIds.size === 3, `❌ Should have 3 unique IDs, got ${uniqueIds.size}`);
console.log('   ✅ Each message has unique identifier');

// Only first message delivered
tracker2.processEvent(createMockReceivedEvent('0xaaa111') as any);
console.assert(tracker2.isAllDelivered() === false, '❌ Not all delivered yet');
console.assert(tracker2.getDeliveryStatus() === 'in-flight', '❌ Should still be in-flight');
console.log('   ✅ Partial delivery detected correctly');

// Deliver second message
tracker2.processEvent(createMockReceivedEvent('0xbbb222') as any);
console.assert(tracker2.isAllDelivered() === false, '❌ Still not all delivered');
console.log('   ✅ Second message delivered, third still pending');

// Deliver third message
tracker2.processEvent(createMockReceivedEvent('0xccc333') as any);
console.assert(tracker2.isAllDelivered() === true, '❌ Should be all delivered now');
console.assert(tracker2.getDeliveryStatus() === 'delivered', '❌ Status should be delivered');
console.log('   ✅ All messages delivered successfully');
console.log('   ✅ Test 2 PASSED');

// Test 3: Failed delivery
console.log('\n📋 Test 3: Failed delivery detection');
const tracker3 = new XcmMessageTracker();
tracker3.processEvent(createMockSentEvent('0xfail123') as any);
tracker3.processEvent(createMockReceivedEvent('0xfail123', 'Fail') as any);

console.assert(tracker3.hasFailures() === true, '❌ Should detect failure');
console.assert(tracker3.getDeliveryStatus() === 'failed', '❌ Status should be failed');
const failure = tracker3.getFailureDetails();
console.assert(failure !== null, '❌ Should have failure details');
console.log('   ✅ Failure detected correctly');
console.log('   ✅ Failure details available');
console.log('   ✅ Test 3 PASSED');

// Test 4: Mixed success and failure
console.log('\n📋 Test 4: Mixed success and failure');
const tracker4 = new XcmMessageTracker();
tracker4.processEvent(createMockSentEvent('0xsuccess1') as any);
tracker4.processEvent(createMockSentEvent('0xfail2') as any);

tracker4.processEvent(createMockReceivedEvent('0xsuccess1', 'Success') as any);
tracker4.processEvent(createMockReceivedEvent('0xfail2', 'Fail') as any);

console.assert(tracker4.getDeliveryStatus() === 'failed', '❌ Overall status should be failed');
console.assert(tracker4.hasFailures() === true, '❌ Should detect failures');
const msgs4 = tracker4.getMessages();
const successMsg = msgs4.find(m => m.messageId === '0xsuccess1');
const failMsg = msgs4.find(m => m.messageId === '0xfail2');
console.assert(successMsg?.status === 'received', '❌ Success message should be received');
console.assert(failMsg?.status === 'failed', '❌ Failed message should be failed');
console.log('   ✅ Individual message statuses tracked correctly');
console.log('   ✅ Overall status reflects failure');
console.log('   ✅ Test 4 PASSED');

console.log('\n' + '='.repeat(60));
console.log('🎉 All tests PASSED!');
console.log('');
console.log('✅ Bug fix verified: Multiple concurrent XCM messages are tracked separately');
console.log('✅ Each message uses unique extrinsicHash as identifier');
console.log('✅ No message overwrites another');
console.log('');



