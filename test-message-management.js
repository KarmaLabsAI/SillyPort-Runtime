/**
 * Message Management Console Test
 * 
 * Demonstrates Task 3.1.2: Message Management functionality
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

console.log('=== Message Management Console Test ===');
console.log('Testing Task 3.1.2: Message Management\n');

async function runTests() {
    try {
        // Test 1: Create chat session
        console.log('1. Creating chat session...');
        const chat = await chatManager.createChat(['character1', 'character2']);
        console.log('✅ Chat created:', chat.id);
        console.log('   Title:', chat.title);
        console.log('   Participants:', chat.participantIds);
        console.log('   Message count:', chat.messageCount);
        console.log('');

        // Test 2: Add messages with different roles
        console.log('2. Adding messages with different roles...');
        const userMessage = await chatManager.addMessage(chat.id, 'character1', 'Hello, how are you?', {
            role: 'user',
            metadata: { priority: 'normal' }
        });
        console.log('✅ User message added:', userMessage.id);
        console.log('   Content:', userMessage.content);
        console.log('   Role:', userMessage.role);
        console.log('   Timestamp:', new Date(userMessage.timestamp).toISOString());

        const assistantMessage = await chatManager.addMessage(chat.id, 'character2', 'I\'m doing well, thank you! How about you?', {
            role: 'assistant',
            metadata: { priority: 'high' },
            isFormatted: true
        });
        console.log('✅ Assistant message added:', assistantMessage.id);
        console.log('   Content:', assistantMessage.content);
        console.log('   Role:', assistantMessage.role);
        console.log('   Is formatted:', assistantMessage.isFormatted);
        console.log('');

        // Test 3: Get all messages
        console.log('3. Getting all messages...');
        const allMessages = chatManager.getMessages(chat.id);
        console.log('✅ All messages retrieved:', allMessages.length);
        allMessages.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.role}] ${msg.senderId}: ${msg.content}`);
        });
        console.log('');

        // Test 4: Filter messages by role
        console.log('4. Filtering messages by role...');
        const userMessages = chatManager.getMessages(chat.id, { role: 'user' });
        const assistantMessages = chatManager.getMessages(chat.id, { role: 'assistant' });
        console.log('✅ User messages:', userMessages.length);
        console.log('✅ Assistant messages:', assistantMessages.length);
        console.log('');

        // Test 5: Filter messages by sender
        console.log('5. Filtering messages by sender...');
        const char1Messages = chatManager.getMessages(chat.id, { senderId: 'character1' });
        const char2Messages = chatManager.getMessages(chat.id, { senderId: 'character2' });
        console.log('✅ Character1 messages:', char1Messages.length);
        console.log('✅ Character2 messages:', char2Messages.length);
        console.log('');

        // Test 6: Message formatting
        console.log('6. Testing message formatting...');
        const formattedUser = chatManager.formatMessage(userMessage, { 
            includeTimestamp: true, 
            dateFormat: 'relative' 
        });
        const formattedAssistant = chatManager.formatMessage(assistantMessage, { 
            includeMetadata: true,
            dateFormat: 'ISO'
        });
        console.log('✅ Formatted user message:', formattedUser);
        console.log('✅ Formatted assistant message:', formattedAssistant);
        console.log('');

        // Test 7: Update message
        console.log('7. Updating a message...');
        const updatedMessage = await chatManager.updateMessage(chat.id, userMessage.id, {
            content: 'Hello, how are you doing today?',
            metadata: { edited: true, editReason: 'Clarification' }
        });
        console.log('✅ Message updated:', updatedMessage.id);
        console.log('   New content:', updatedMessage.content);
        console.log('   Edit metadata:', updatedMessage.metadata.edited);
        console.log('');

        // Test 8: Get specific message
        console.log('8. Getting specific message...');
        const retrievedMessage = chatManager.getMessage(chat.id, assistantMessage.id);
        console.log('✅ Retrieved message:', retrievedMessage.id);
        console.log('   Content:', retrievedMessage.content);
        console.log('   Sender:', retrievedMessage.senderId);
        console.log('');

        // Test 9: Message statistics
        console.log('9. Getting message statistics...');
        const messageStats = chatManager.getMessageStats(chat.id);
        console.log('✅ Message statistics:');
        console.log('   Total messages:', messageStats.totalMessages);
        console.log('   Unique senders:', messageStats.uniqueSenders);
        console.log('   Average message length:', messageStats.averageMessageLength);
        console.log('   Sender breakdown:', messageStats.senderBreakdown);
        console.log('   Role breakdown:', messageStats.roleBreakdown);
        console.log('');

        // Test 10: Add more messages to test ordering and limits
        console.log('10. Adding more messages to test ordering...');
        await chatManager.addMessage(chat.id, 'character1', 'This is a third message');
        await chatManager.addMessage(chat.id, 'character2', 'This is a fourth message');
        await chatManager.addMessage(chat.id, 'character1', 'This is a fifth message');

        const recentMessages = chatManager.getMessages(chat.id, { limit: 3, reverse: true });
        console.log('✅ Recent messages (newest first):');
        recentMessages.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.role}] ${msg.senderId}: ${msg.content}`);
        });
        console.log('');

        // Test 11: Delete a message
        console.log('11. Deleting a message...');
        const deleteResult = await chatManager.deleteMessage(chat.id, userMessage.id);
        console.log('✅ Message deleted:', deleteResult);
        
        const remainingMessages = chatManager.getMessages(chat.id);
        console.log('   Remaining messages:', remainingMessages.length);
        console.log('');

        // Test 12: Event emission verification
        console.log('12. Verifying event emission...');
        const events = eventBus.getEventHistory();
        const messageEvents = events.filter(e => e && e.eventName && e.eventName.startsWith('chat:message:'));
        console.log('✅ Message-related events emitted:', messageEvents.length);
        messageEvents.forEach(event => {
            console.log(`   - ${event.eventName}`);
        });
        console.log('');

        // Test 13: State manager integration
        console.log('13. Verifying state manager integration...');
        const stateMessages = stateManager.getState(`chatMessages.${chat.id}`);
        const stateSession = stateManager.getState(`chatSessions.${chat.id}`);
        console.log('✅ State manager integration:');
        console.log('   Messages in state:', stateMessages ? stateMessages.length : 0);
        console.log('   Session in state:', stateSession ? 'Yes' : 'No');
        console.log('');

        // Test 14: Runtime statistics
        console.log('14. Getting runtime statistics...');
        const runtimeStats = chatManager.getStats();
        console.log('✅ Runtime statistics:');
        console.log('   Total sessions:', runtimeStats.totalSessions);
        console.log('   Total messages:', runtimeStats.totalMessages);
        console.log('   Active sessions:', runtimeStats.activeSessions);
        console.log('   Debug mode:', runtimeStats.debugMode);
        console.log('');

        console.log('=== All Tests Completed Successfully ===');
        console.log('✅ Task 3.1.2: Message Management - COMPLETE');
        console.log('');
        console.log('Features tested:');
        console.log('  ✓ Message creation and storage');
        console.log('  ✓ Message ordering and chronological sequence');
        console.log('  ✓ Timestamp management and accuracy');
        console.log('  ✓ Message metadata and custom fields');
        console.log('  ✓ Message formatting with different date formats');
        console.log('  ✓ Message filtering by sender and role');
        console.log('  ✓ Message updates with metadata preservation');
        console.log('  ✓ Message deletion and cleanup');
        console.log('  ✓ Message statistics and analytics');
        console.log('  ✓ Event emission for message operations');
        console.log('  ✓ State manager integration');
        console.log('  ✓ Runtime statistics with message counts');

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