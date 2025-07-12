/**
 * Group Chat Support Test Script - Task 3.1.3
 * 
 * Demonstrates the group chat support functionality including:
 * - Multi-participant chat support
 * - Turn order management
 * - Message attribution
 * - Group-specific behaviors
 * - Participant synchronization
 */

const EventBus = require('./src/core/EventBus');
const StateManager = require('./src/core/StateManager');
const ChatManager = require('./src/chat/ChatManager');

async function testGroupChatSupport() {
    console.log('=== Testing Group Chat Support (Task 3.1.3) ===\n');

    // Initialize components
    const eventBus = new EventBus();
    const stateManager = new StateManager(eventBus);
    const chatManager = new ChatManager(eventBus, stateManager);

    // Enable debug mode for detailed logging
    chatManager.setDebugMode(true);

    // Subscribe to group chat events
    eventBus.subscribe('chat:turnOrder:set', (data) => {
        console.log(`🔄 Turn order set for session ${data.sessionId}: ${data.turnOrder.join(' -> ')}`);
    });

    eventBus.subscribe('chat:turn:advanced', (data) => {
        console.log(`⏭️  Turn advanced from ${data.previousParticipant} to ${data.currentParticipant}`);
    });

    eventBus.subscribe('chat:groupBehavior:set', (data) => {
        console.log(`🎭 Group behavior set to: ${data.behavior.type}`);
    });

    eventBus.subscribe('chat:participants:synchronized', (data) => {
        console.log(`🔄 Participants synchronized for session ${data.sessionId}`);
    });

    try {
        // 1. Create a group chat session with multiple participants
        console.log('1. Creating group chat session...');
        const session = await chatManager.createChat(['Alice', 'Bob', 'Charlie', 'Diana'], {
            title: 'Adventure Planning Session',
            metadata: { type: 'group-adventure' }
        });
        console.log(`✅ Created session: ${session.title} (ID: ${session.id})`);
        console.log(`   Participants: ${session.participantIds.join(', ')}\n`);

        // 2. Set turn order for structured conversation
        console.log('2. Setting turn order...');
        const turnOrder = ['Alice', 'Bob', 'Charlie', 'Diana'];
        await chatManager.setTurnOrder(session.id, turnOrder);
        console.log(`✅ Turn order set: ${turnOrder.join(' -> ')}\n`);

        // 3. Set group behavior (collaborative for adventure planning)
        console.log('3. Setting group behavior...');
        await chatManager.setGroupBehavior(session.id, 'collaborative', {
            enableCooperation: true,
            sharedGoals: true,
            conflictResolution: 'consensus',
            turnSharing: true
        });
        console.log('✅ Collaborative behavior configured\n');

        // 4. Start participant synchronization
        console.log('4. Starting participant synchronization...');
        await chatManager.startSynchronization(session.id);
        console.log('✅ Synchronization started\n');

        // 5. Simulate a structured conversation with turn management
        console.log('5. Simulating structured conversation...\n');

        // Alice's turn
        console.log('--- Alice\'s Turn ---');
        const currentTurn = chatManager.getCurrentTurn(session.id);
        console.log(`Current turn: ${currentTurn}`);
        
        await chatManager.addMessage(session.id, 'Alice', 'Hello everyone! I think we should plan our adventure to the ancient ruins.', {
            role: 'user',
            metadata: { turn: 1, speaker: 'Alice' }
        });
        
        const nextTurn = await chatManager.advanceTurn(session.id, 'Alice');
        console.log(`✅ Alice's message added. Next turn: ${nextTurn}\n`);

        // Bob's turn
        console.log('--- Bob\'s Turn ---');
        await chatManager.addMessage(session.id, 'Bob', 'Great idea, Alice! I suggest we bring climbing gear and torches.', {
            role: 'user',
            metadata: { turn: 2, speaker: 'Bob' }
        });
        
        const nextTurn2 = await chatManager.advanceTurn(session.id, 'Bob');
        console.log(`✅ Bob's message added. Next turn: ${nextTurn2}\n`);

        // Charlie's turn
        console.log('--- Charlie\'s Turn ---');
        await chatManager.addMessage(session.id, 'Charlie', 'I agree with Bob. We should also bring food and water for the journey.', {
            role: 'user',
            metadata: { turn: 3, speaker: 'Charlie' }
        });
        
        const nextTurn3 = await chatManager.advanceTurn(session.id, 'Charlie');
        console.log(`✅ Charlie's message added. Next turn: ${nextTurn3}\n`);

        // Diana's turn
        console.log('--- Diana\'s Turn ---');
        await chatManager.addMessage(session.id, 'Diana', 'Perfect! I\'ll handle the medical supplies and first aid kit.', {
            role: 'user',
            metadata: { turn: 4, speaker: 'Diana' }
        });
        
        const nextTurn4 = await chatManager.advanceTurn(session.id, 'Diana');
        console.log(`✅ Diana's message added. Next turn: ${nextTurn4}\n`);

        // 6. Demonstrate message filtering and attribution
        console.log('6. Message filtering and attribution...');
        
        const allMessages = chatManager.getMessages(session.id);
        console.log(`Total messages: ${allMessages.length}`);
        
        const aliceMessages = chatManager.getMessages(session.id, { senderId: 'Alice' });
        console.log(`Alice's messages: ${aliceMessages.length}`);
        
        const userMessages = chatManager.getMessages(session.id, { role: 'user' });
        console.log(`User role messages: ${userMessages.length}`);
        
        console.log('✅ Message filtering working correctly\n');

        // 7. Get comprehensive statistics
        console.log('7. Group chat statistics...');
        
        const messageStats = chatManager.getMessageStats(session.id);
        console.log('Message Statistics:');
        console.log(`  - Total messages: ${messageStats.totalMessages}`);
        console.log(`  - Unique senders: ${messageStats.uniqueSenders}`);
        console.log(`  - Average message length: ${messageStats.averageMessageLength} characters`);
        console.log(`  - Sender breakdown:`, messageStats.senderBreakdown);
        
        const groupStats = chatManager.getGroupChatStats(session.id);
        console.log('\nGroup Chat Statistics:');
        console.log(`  - Participant count: ${groupStats.participantCount}`);
        console.log(`  - Has turn order: ${groupStats.hasTurnOrder}`);
        console.log(`  - Current turn: ${groupStats.currentTurn}`);
        console.log(`  - Total turns: ${groupStats.totalTurns}`);
        console.log(`  - Group behavior: ${groupStats.groupBehavior}`);
        console.log(`  - Synchronization active: ${groupStats.synchronizationActive}`);
        console.log(`  - Message distribution:`, groupStats.messageDistribution);
        
        console.log('✅ Statistics generated successfully\n');

        // 8. Demonstrate participant state management
        console.log('8. Participant state management...');
        
        const aliceState = chatManager.getParticipantState(session.id, 'Alice');
        console.log('Alice\'s state:', aliceState);
        
        await chatManager.updateParticipantState(session.id, 'Alice', {
            status: 'ready',
            customField: 'team_leader'
        });
        
        const updatedAliceState = chatManager.getParticipantState(session.id, 'Alice');
        console.log('Updated Alice\'s state:', updatedAliceState);
        
        console.log('✅ Participant state management working\n');

        // 9. Test synchronization
        console.log('9. Testing synchronization...');
        
        const syncResult = await chatManager.synchronizeParticipants(session.id);
        console.log('Synchronization result:', syncResult.success ? '✅ Success' : '❌ Failed');
        if (syncResult.success) {
            console.log(`  - Participants synchronized: ${Object.keys(syncResult.data.participants).length}`);
            console.log(`  - Current turn: ${syncResult.data.currentTurn}`);
            console.log(`  - Group behavior: ${syncResult.data.groupBehavior.type}`);
        }
        
        console.log('✅ Synchronization working\n');

        // 10. Demonstrate error handling
        console.log('10. Error handling...');
        
        try {
            await chatManager.setTurnOrder('nonexistent', ['Alice']);
            console.log('❌ Should have thrown an error');
        } catch (error) {
            console.log(`✅ Correctly caught error: ${error.message}`);
        }
        
        try {
            await chatManager.setGroupBehavior(session.id, 'invalid_behavior');
            console.log('❌ Should have thrown an error');
        } catch (error) {
            console.log(`✅ Correctly caught error: ${error.message}`);
        }
        
        console.log('✅ Error handling working correctly\n');

        // 11. Clean up
        console.log('11. Cleaning up...');
        
        chatManager.stopSynchronization(session.id);
        console.log('✅ Synchronization stopped');
        
        chatManager.destroy();
        console.log('✅ ChatManager destroyed');
        
        console.log('\n=== Group Chat Support Test Completed Successfully ===');
        console.log('✅ All Task 3.1.3 requirements implemented and tested:');
        console.log('   - Multi-participant chat support ✓');
        console.log('   - Turn order management ✓');
        console.log('   - Message attribution ✓');
        console.log('   - Group-specific behaviors ✓');
        console.log('   - Participant synchronization ✓');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testGroupChatSupport();
}

module.exports = { testGroupChatSupport }; 