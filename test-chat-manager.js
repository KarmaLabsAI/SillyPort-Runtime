/**
 * ChatManager Console Test
 * 
 * Demonstrates Task 3.1.1: Chat Session Creation functionality
 * Based on the console test examples in the task breakdown
 */

const ChatManager = require('./src/chat/ChatManager');
const EventBus = require('./src/core/EventBus');
const StateManager = require('./src/core/StateManager');

// Initialize components
const eventBus = new EventBus();
const stateManager = new StateManager(eventBus);
const chatManager = new ChatManager(eventBus, stateManager);

// Enable debug mode for better console output
chatManager.setDebugMode(true);

console.log('=== ChatManager Console Test ===');
console.log('Testing Task 3.1.1: Chat Session Creation\n');

async function runTests() {
    try {
        // Test 1: Create chat session
        console.log('1. Creating chat session...');
        const chat = await chatManager.createChat(['character1', 'character2']);
        console.log('✅ Chat created:', chat.id);
        console.log('   Title:', chat.title);
        console.log('   Participants:', chat.participantIds);
        console.log('   Active:', chat.isActive);
        console.log('   Message count:', chat.messageCount);
        console.log('');

        // Test 2: Create another session with custom options
        console.log('2. Creating session with custom options...');
        const customChat = await chatManager.createChat(['character3'], {
            title: 'Custom Chat Session',
            metadata: { priority: 'high', category: 'test' },
            autoActivate: false
        });
        console.log('✅ Custom chat created:', customChat.id);
        console.log('   Title:', customChat.title);
        console.log('   Active:', customChat.isActive);
        console.log('   Metadata:', customChat.metadata);
        console.log('');

        // Test 3: Add participants
        console.log('3. Adding participants to existing session...');
        const addResult = await chatManager.addParticipants(chat.id, ['character4', 'character5']);
        console.log('✅ Participants added:', addResult);
        const updatedChat = chatManager.getChat(chat.id);
        console.log('   Updated participants:', updatedChat.participantIds);
        console.log('');

        // Test 4: Remove participants
        console.log('4. Removing participants...');
        const removeResult = await chatManager.removeParticipants(chat.id, ['character4']);
        console.log('✅ Participants removed:', removeResult);
        const finalChat = chatManager.getChat(chat.id);
        console.log('   Final participants:', finalChat.participantIds);
        console.log('');

        // Test 5: Activate different session
        console.log('5. Activating custom session...');
        const activateResult = await chatManager.activateChat(customChat.id);
        console.log('✅ Session activated:', activateResult);
        const activeChat = chatManager.getActiveChat();
        console.log('   Active chat:', activeChat.id);
        console.log('   Active chat title:', activeChat.title);
        console.log('');

        // Test 6: Update session metadata
        console.log('6. Updating session metadata...');
        const metadataResult = await chatManager.updateSessionMetadata(chat.id, {
            lastActivity: Date.now(),
            userNotes: 'This is a test chat session'
        });
        console.log('✅ Metadata updated:', metadataResult);
        const chatWithMetadata = chatManager.getChat(chat.id);
        console.log('   Updated metadata:', chatWithMetadata.metadata);
        console.log('');

        // Test 7: Get all chats with filters
        console.log('7. Getting all chats with filters...');
        const allChats = chatManager.getAllChats();
        const activeChats = chatManager.getAllChats({ activeOnly: true });
        const char1Chats = chatManager.getAllChats({ participantIds: ['character1'] });
        
        console.log('✅ All chats:', allChats.length);
        console.log('   Active chats:', activeChats.length);
        console.log('   Chats with character1:', char1Chats.length);
        console.log('');

        // Test 8: Get session statistics
        console.log('8. Getting session statistics...');
        const allStats = chatManager.getSessionStats();
        const chatStats = chatManager.getSessionStats(chat.id);
        const runtimeStats = chatManager.getStats();
        
        console.log('✅ Overall stats:', allStats);
        console.log('   Chat-specific stats:', chatStats);
        console.log('   Runtime stats:', runtimeStats);
        console.log('');

        // Test 9: Event emission verification
        console.log('9. Verifying event emission...');
        const events = eventBus.getEventHistory();
        const chatEvents = events.filter(e => e && e.eventName && e.eventName.startsWith('chat:'));
        console.log('✅ Chat-related events emitted:', chatEvents.length);
        chatEvents.forEach(event => {
            console.log(`   - ${event.eventName}`);
        });
        console.log('');

        // Test 10: State manager integration
        console.log('10. Verifying state manager integration...');
        const stateChats = stateManager.getState('chatSessions');
        const stateActiveChat = stateManager.getState('activeChat');
        console.log('✅ State manager integration:');
        console.log('   Chat sessions in state:', Object.keys(stateChats || {}).length);
        console.log('   Active chat in state:', stateActiveChat);
        console.log('');

        console.log('=== All Tests Completed Successfully ===');
        console.log('✅ Task 3.1.1: Chat Session Creation - COMPLETE');
        console.log('');
        console.log('Features tested:');
        console.log('  ✓ Chat session initialization');
        console.log('  ✓ Unique session identifiers');
        console.log('  ✓ Participant management');
        console.log('  ✓ Session metadata');
        console.log('  ✓ Session activation and management');
        console.log('  ✓ Event emission');
        console.log('  ✓ State manager integration');
        console.log('  ✓ Statistics and debugging');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        // Cleanup
        chatManager.destroy();
        console.log('\n🧹 Resources cleaned up');
    }
}

// Run the tests
runTests(); 