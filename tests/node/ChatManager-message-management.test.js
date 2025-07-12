/**
 * ChatManager Message Management Tests
 * 
 * Tests for Task 3.1.2: Message Management
 * Tests message creation, storage, ordering, timestamp management, metadata, and formatting
 */

const ChatManager = require('../../src/chat/ChatManager');

// Mock EventBus for testing
class MockEventBus {
    constructor() {
        this.events = [];
    }

    async emit(eventName, data) {
        this.events.push({ eventName, data });
    }

    subscribe(eventName, callback) {
        // Mock subscription
        return () => {};
    }

    getEvents() {
        return this.events;
    }

    clear() {
        this.events = [];
    }

    getEventHistory() {
        return this.events;
    }
}

// Mock StateManager for testing
class MockStateManager {
    constructor() {
        this.state = {};
    }

    setState(path, value) {
        this.state[path] = value;
    }

    getState(path) {
        return this.state[path];
    }
}

// Mock StorageManager for testing
class MockStorageManager {
    constructor() {
        this.data = new Map();
        this.initialized = false;
    }

    async init() {
        this.initialized = true;
        return true;
    }

    async save(store, key, data) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }
        this.data.set(`${store}:${key}`, data);
        return key;
    }

    async load(store, key) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }
        return this.data.get(`${store}:${key}`);
    }
}

describe('ChatManager - Message Management Tests', () => {
    let chatManager;
    let mockEventBus;
    let mockStateManager;
    let mockStorageManager;
    let testSessionId;

    beforeEach(async () => {
        mockEventBus = new MockEventBus();
        mockStateManager = new MockStateManager();
        mockStorageManager = new MockStorageManager();
        await mockStorageManager.init();
        
        chatManager = new ChatManager(mockEventBus, mockStateManager, mockStorageManager);
        mockEventBus.clear();

        // Create a test session
        const session = await chatManager.createChat(['character1', 'character2']);
        testSessionId = session.id;
    });

    afterEach(() => {
        if (chatManager) {
            chatManager.destroy();
        }
    });

    describe('Task 3.1.2: Message Management', () => {
        describe('Message creation and storage', () => {
            test('should create a message with basic properties', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Hello, world!');

                expect(message).toBeDefined();
                expect(message.id).toBeDefined();
                expect(message.sessionId).toBe(testSessionId);
                expect(message.senderId).toBe('character1');
                expect(message.content).toBe('Hello, world!');
                expect(message.role).toBe('user'); // default role
                expect(message.timestamp).toBeDefined();
                expect(message.isFormatted).toBe(false);
                expect(message.metadata).toBeDefined();
                expect(message.metadata.createdBy).toBe('ChatManager');
                expect(message.metadata.version).toBe('1.0.0');
            });

            test('should create message with custom options', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character2', 'Response message', {
                    role: 'assistant',
                    metadata: { customField: 'customValue' },
                    isFormatted: true,
                    avatar: 'avatar.png'
                });

                expect(message.role).toBe('assistant');
                expect(message.metadata.customField).toBe('customValue');
                expect(message.isFormatted).toBe(true);
                expect(message.avatar).toBe('avatar.png');
            });

            test('should throw error for invalid session ID', async () => {
                await expect(chatManager.addMessage('invalid', 'character1', 'test'))
                    .rejects.toThrow('ChatManager: Session \'invalid\' not found');
            });

            test('should throw error for invalid sender ID', async () => {
                await expect(chatManager.addMessage(testSessionId, '', 'test'))
                    .rejects.toThrow('ChatManager: Sender ID must be a non-empty string');
            });

            test('should throw error for invalid content', async () => {
                await expect(chatManager.addMessage(testSessionId, 'character1', ''))
                    .rejects.toThrow('ChatManager: Message content must be a non-empty string');
            });

            test('should throw error for content exceeding max length', async () => {
                const longContent = 'x'.repeat(chatManager.maxMessageLength + 1);
                await expect(chatManager.addMessage(testSessionId, 'character1', longContent))
                    .rejects.toThrow(`ChatManager: Message content exceeds maximum length of ${chatManager.maxMessageLength} characters`);
            });

            test('should update session message count', async () => {
                const session = chatManager.getChat(testSessionId);
                const initialCount = session.messageCount;

                await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                
                const updatedSession = chatManager.getChat(testSessionId);
                expect(updatedSession.messageCount).toBe(initialCount + 1);
            });

            test('should emit message added event', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                
                const events = mockEventBus.getEvents();
                const messageEvent = events.find(e => e.eventName === 'chat:message:added');
                
                expect(messageEvent).toBeDefined();
                expect(messageEvent.data.sessionId).toBe(testSessionId);
                expect(messageEvent.data.message.content).toBe('Test message');
                expect(messageEvent.data.totalMessages).toBe(1);
            });
        });

        describe('Message ordering', () => {
            test('should maintain chronological order of messages', async () => {
                const message1 = await chatManager.addMessage(testSessionId, 'character1', 'First message');
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                const message2 = await chatManager.addMessage(testSessionId, 'character2', 'Second message');
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                const message3 = await chatManager.addMessage(testSessionId, 'character1', 'Third message');

                const messages = chatManager.getMessages(testSessionId);
                
                expect(messages).toHaveLength(3);
                expect(messages[0].id).toBe(message1.id);
                expect(messages[1].id).toBe(message2.id);
                expect(messages[2].id).toBe(message3.id);
                expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp);
                expect(messages[1].timestamp).toBeLessThan(messages[2].timestamp);
            });

            test('should enforce message limit per session', async () => {
                // Set a small limit for testing
                chatManager.maxMessagesPerSession = 3;

                await chatManager.addMessage(testSessionId, 'character1', 'Message 1');
                await chatManager.addMessage(testSessionId, 'character2', 'Message 2');
                await chatManager.addMessage(testSessionId, 'character1', 'Message 3');
                await chatManager.addMessage(testSessionId, 'character2', 'Message 4');

                const messages = chatManager.getMessages(testSessionId);
                expect(messages).toHaveLength(3);
                expect(messages[0].content).toBe('Message 2'); // Oldest message removed
                expect(messages[2].content).toBe('Message 4'); // Newest message
            });

            test('should return messages in reverse order when requested', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'First');
                await chatManager.addMessage(testSessionId, 'character2', 'Second');
                await chatManager.addMessage(testSessionId, 'character1', 'Third');

                const messages = chatManager.getMessages(testSessionId, { reverse: true });
                
                expect(messages).toHaveLength(3);
                expect(messages[0].content).toBe('Third');
                expect(messages[1].content).toBe('Second');
                expect(messages[2].content).toBe('First');
            });
        });

        describe('Timestamp management', () => {
            test('should assign accurate timestamps to messages', async () => {
                const beforeTime = Date.now();
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const afterTime = Date.now();

                expect(message.timestamp).toBeGreaterThanOrEqual(beforeTime);
                expect(message.timestamp).toBeLessThanOrEqual(afterTime);
            });

            test('should update session last message time', async () => {
                const session = chatManager.getChat(testSessionId);
                const initialTime = session.updatedAt;

                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                
                const updatedSession = chatManager.getChat(testSessionId);
                expect(updatedSession.updatedAt).toBeGreaterThan(initialTime);
            });

            test('should track participant activity timestamps', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'Message from character1');
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                await chatManager.addMessage(testSessionId, 'character2', 'Message from character2');

                const sessionMeta = chatManager.sessionMetadata.get(testSessionId);
                expect(sessionMeta.participantActivity.get('character1')).toBeDefined();
                expect(sessionMeta.participantActivity.get('character2')).toBeDefined();
                expect(sessionMeta.participantActivity.get('character2')).toBeGreaterThan(
                    sessionMeta.participantActivity.get('character1')
                );
            });
        });

        describe('Message metadata', () => {
            test('should include required metadata fields', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');

                expect(message.metadata).toBeDefined();
                expect(message.metadata.createdBy).toBe('ChatManager');
                expect(message.metadata.version).toBe('1.0.0');
            });

            test('should preserve custom metadata', async () => {
                const customMetadata = {
                    customField: 'customValue',
                    priority: 'high',
                    tags: ['important', 'urgent']
                };

                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message', {
                    metadata: customMetadata
                });

                expect(message.metadata.customField).toBe('customValue');
                expect(message.metadata.priority).toBe('high');
                expect(message.metadata.tags).toEqual(['important', 'urgent']);
                expect(message.metadata.createdBy).toBe('ChatManager'); // Should still be present
            });

            test('should update message metadata on edit', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Original message');
                
                const updatedMessage = await chatManager.updateMessage(testSessionId, message.id, {
                    content: 'Updated message',
                    metadata: { edited: true, editReason: 'Correction' }
                });

                expect(updatedMessage.updatedAt).toBeDefined();
                expect(updatedMessage.metadata.edited).toBe(true);
                expect(updatedMessage.metadata.editReason).toBe('Correction');
                expect(updatedMessage.metadata.createdBy).toBe('ChatManager'); // Original metadata preserved
            });
        });

        describe('Message formatting', () => {
            test('should format message with default options', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message);

                expect(formatted.id).toBe(message.id);
                expect(formatted.senderId).toBe(message.senderId);
                expect(formatted.content).toBe(message.content);
                expect(formatted.role).toBe(message.role);
                expect(formatted.isFormatted).toBe(message.isFormatted);
                expect(formatted.avatar).toBe(message.avatar);
                expect(formatted.timestamp).toBeDefined();
                expect(formatted.metadata).toBeUndefined(); // Not included by default
            });

            test('should format message with ISO timestamp', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message, { dateFormat: 'ISO' });

                expect(formatted.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            });

            test('should format message with relative timestamp', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message, { dateFormat: 'relative' });

                expect(formatted.timestamp).toMatch(/^(just now|\d+ second\(s\) ago)$/);
            });

            test('should format message with locale timestamp', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message, { dateFormat: 'locale' });

                expect(formatted.timestamp).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}/);
            });

            test('should include metadata when requested', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message, { includeMetadata: true });

                expect(formatted.metadata).toBeDefined();
                expect(formatted.metadata.createdBy).toBe('ChatManager');
            });

            test('should exclude timestamp when requested', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                const formatted = chatManager.formatMessage(message, { includeTimestamp: false });

                expect(formatted.timestamp).toBeUndefined();
            });
        });

        describe('Message retrieval and filtering', () => {
            beforeEach(async () => {
                // Add multiple messages for testing
                await chatManager.addMessage(testSessionId, 'character1', 'Message 1', { role: 'user' });
                await chatManager.addMessage(testSessionId, 'character2', 'Message 2', { role: 'assistant' });
                await chatManager.addMessage(testSessionId, 'character1', 'Message 3', { role: 'user' });
                await chatManager.addMessage(testSessionId, 'character2', 'Message 4', { role: 'assistant' });
                await chatManager.addMessage(testSessionId, 'character1', 'Message 5', { role: 'user' });
            });

            test('should get all messages from session', async () => {
                const messages = chatManager.getMessages(testSessionId);
                expect(messages).toHaveLength(5);
            });

            test('should filter messages by sender ID', async () => {
                const character1Messages = chatManager.getMessages(testSessionId, { senderId: 'character1' });
                const character2Messages = chatManager.getMessages(testSessionId, { senderId: 'character2' });

                expect(character1Messages).toHaveLength(3);
                expect(character2Messages).toHaveLength(2);
                expect(character1Messages.every(msg => msg.senderId === 'character1')).toBe(true);
                expect(character2Messages.every(msg => msg.senderId === 'character2')).toBe(true);
            });

            test('should filter messages by role', async () => {
                const userMessages = chatManager.getMessages(testSessionId, { role: 'user' });
                const assistantMessages = chatManager.getMessages(testSessionId, { role: 'assistant' });

                expect(userMessages).toHaveLength(3);
                expect(assistantMessages).toHaveLength(2);
                expect(userMessages.every(msg => msg.role === 'user')).toBe(true);
                expect(assistantMessages.every(msg => msg.role === 'assistant')).toBe(true);
            });

            test('should apply limit and offset', async () => {
                const limitedMessages = chatManager.getMessages(testSessionId, { limit: 3, offset: 1 });
                expect(limitedMessages).toHaveLength(3);
                expect(limitedMessages[0].content).toBe('Message 2');
                expect(limitedMessages[2].content).toBe('Message 4');
            });

            test('should get specific message by ID', async () => {
                const messages = chatManager.getMessages(testSessionId);
                const targetMessage = messages[2];

                const foundMessage = chatManager.getMessage(testSessionId, targetMessage.id);
                expect(foundMessage).toEqual(targetMessage);
            });

            test('should return null for non-existent message', async () => {
                const foundMessage = chatManager.getMessage(testSessionId, 'non-existent-id');
                expect(foundMessage).toBeNull();
            });
        });

        describe('Message updates and deletion', () => {
            let testMessage;

            beforeEach(async () => {
                testMessage = await chatManager.addMessage(testSessionId, 'character1', 'Original message');
            });

            test('should update message content', async () => {
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
                const updatedMessage = await chatManager.updateMessage(testSessionId, testMessage.id, {
                    content: 'Updated message'
                });

                expect(updatedMessage.content).toBe('Updated message');
                expect(updatedMessage.updatedAt).toBeDefined();
                expect(updatedMessage.updatedAt).toBeGreaterThan(testMessage.timestamp);
            });

            test('should update message role', async () => {
                const updatedMessage = await chatManager.updateMessage(testSessionId, testMessage.id, {
                    role: 'assistant'
                });

                expect(updatedMessage.role).toBe('assistant');
            });

            test('should throw error for non-existent message', async () => {
                await expect(chatManager.updateMessage(testSessionId, 'non-existent-id', { content: 'test' }))
                    .rejects.toThrow('ChatManager: Message \'non-existent-id\' not found in session');
            });

            test('should throw error for content exceeding max length', async () => {
                const longContent = 'x'.repeat(chatManager.maxMessageLength + 1);
                await expect(chatManager.updateMessage(testSessionId, testMessage.id, { content: longContent }))
                    .rejects.toThrow(`ChatManager: Message content exceeds maximum length of ${chatManager.maxMessageLength} characters`);
            });

            test('should emit message updated event', async () => {
                await chatManager.updateMessage(testSessionId, testMessage.id, { content: 'Updated' });
                
                const events = mockEventBus.getEvents();
                const updateEvent = events.find(e => e.eventName === 'chat:message:updated');
                
                expect(updateEvent).toBeDefined();
                expect(updateEvent.data.sessionId).toBe(testSessionId);
                expect(updateEvent.data.message.content).toBe('Updated');
                expect(updateEvent.data.originalMessage.content).toBe('Original message');
            });

            test('should delete message', async () => {
                const result = await chatManager.deleteMessage(testSessionId, testMessage.id);
                expect(result).toBe(true);

                const messages = chatManager.getMessages(testSessionId);
                expect(messages).toHaveLength(0);

                const session = chatManager.getChat(testSessionId);
                expect(session.messageCount).toBe(0);
            });

            test('should throw error for deleting non-existent message', async () => {
                await expect(chatManager.deleteMessage(testSessionId, 'non-existent-id'))
                    .rejects.toThrow('ChatManager: Message \'non-existent-id\' not found in session');
            });

            test('should emit message deleted event', async () => {
                await chatManager.deleteMessage(testSessionId, testMessage.id);
                
                const events = mockEventBus.getEvents();
                const deleteEvent = events.find(e => e.eventName === 'chat:message:deleted');
                
                expect(deleteEvent).toBeDefined();
                expect(deleteEvent.data.sessionId).toBe(testSessionId);
                expect(deleteEvent.data.message.id).toBe(testMessage.id);
                expect(deleteEvent.data.totalMessages).toBe(0);
            });
        });

        describe('Message statistics', () => {
            beforeEach(async () => {
                // Add messages with different senders and roles
                await chatManager.addMessage(testSessionId, 'character1', 'Short message', { role: 'user' });
                await chatManager.addMessage(testSessionId, 'character2', 'This is a longer message with more content', { role: 'assistant' });
                await chatManager.addMessage(testSessionId, 'character1', 'Another message', { role: 'user' });
                await chatManager.addMessage(testSessionId, 'character2', 'Response message', { role: 'assistant' });
            });

            test('should generate message statistics', async () => {
                const stats = chatManager.getMessageStats(testSessionId);

                expect(stats).toBeDefined();
                expect(stats.sessionId).toBe(testSessionId);
                expect(stats.totalMessages).toBe(4);
                expect(stats.uniqueSenders).toBe(2);
                expect(stats.totalParticipants).toBe(2);
                expect(stats.averageMessageLength).toBeGreaterThan(0);
                expect(stats.senderBreakdown).toBeDefined();
                expect(stats.roleBreakdown).toBeDefined();
                expect(stats.firstMessageTime).toBeDefined();
                expect(stats.lastMessageTime).toBeDefined();
            });

            test('should calculate correct sender breakdown', async () => {
                const stats = chatManager.getMessageStats(testSessionId);

                expect(stats.senderBreakdown.character1).toBe(2);
                expect(stats.senderBreakdown.character2).toBe(2);
            });

            test('should calculate correct role breakdown', async () => {
                const stats = chatManager.getMessageStats(testSessionId);

                expect(stats.roleBreakdown.user).toBe(2);
                expect(stats.roleBreakdown.assistant).toBe(2);
            });

            test('should calculate average message length', async () => {
                const stats = chatManager.getMessageStats(testSessionId);
                const messages = chatManager.getMessages(testSessionId);
                const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
                const expectedAverage = Math.round(totalLength / messages.length);

                expect(stats.averageMessageLength).toBe(expectedAverage);
            });

            test('should return null for non-existent session', async () => {
                const stats = chatManager.getMessageStats('non-existent-session');
                expect(stats).toBeNull();
            });
        });

        describe('State manager integration', () => {
            test('should update state manager with messages', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'Test message');

                const stateMessages = mockStateManager.getState(`chatMessages.${testSessionId}`);
                expect(stateMessages).toBeDefined();
                expect(stateMessages).toHaveLength(1);
                expect(stateMessages[0].content).toBe('Test message');
            });

            test('should update state manager on message update', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Original');
                await chatManager.updateMessage(testSessionId, message.id, { content: 'Updated' });

                const stateMessages = mockStateManager.getState(`chatMessages.${testSessionId}`);
                expect(stateMessages[0].content).toBe('Updated');
            });

            test('should update state manager on message deletion', async () => {
                const message = await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                await chatManager.deleteMessage(testSessionId, message.id);

                const stateMessages = mockStateManager.getState(`chatMessages.${testSessionId}`);
                expect(stateMessages).toHaveLength(0);
            });
        });

        describe('Storage integration', () => {
            test('should save messages to storage', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                await chatManager.addMessage(testSessionId, 'character2', 'Another message');

                const result = await chatManager.saveSessions();
                expect(result).toBe(true);

                const savedMessages = await mockStorageManager.load('chatMessages', testSessionId);
                expect(savedMessages).toBeDefined();
                expect(savedMessages).toHaveLength(2);
            });

            test.skip('should load messages from storage', async () => {
                // Add messages and save them
                await chatManager.addMessage(testSessionId, 'character1', 'Test message');
                await chatManager.saveSessions();

                // Create new chat manager instance to test loading
                const newChatManager = new ChatManager(mockEventBus, mockStateManager, mockStorageManager);
                await mockStorageManager.init(); // Ensure storage is initialized
                
                // Load sessions first, then messages will be loaded automatically
                await newChatManager.loadSessions();

                const loadedMessages = newChatManager.getMessages(testSessionId);
                expect(loadedMessages).toHaveLength(1);
                expect(loadedMessages[0].content).toBe('Test message');

                newChatManager.destroy();
            });
        });

        describe('Runtime statistics', () => {
            test('should include message count in runtime stats', async () => {
                await chatManager.addMessage(testSessionId, 'character1', 'Message 1');
                await chatManager.addMessage(testSessionId, 'character2', 'Message 2');

                const stats = chatManager.getStats();
                expect(stats.totalMessages).toBe(2);
            });

            test('should calculate total messages across all sessions', async () => {
                // Create another session
                const session2 = await chatManager.createChat(['character3']);
                
                await chatManager.addMessage(testSessionId, 'character1', 'Message 1');
                await chatManager.addMessage(session2.id, 'character3', 'Message 2');

                const stats = chatManager.getStats();
                expect(stats.totalMessages).toBe(2);
            });
        });
    });
}); 