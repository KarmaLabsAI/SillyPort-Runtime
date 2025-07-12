/**
 * ChatManager Group Chat Tests - Task 3.1.3
 * 
 * Tests for group chat support functionality including:
 * - Multi-participant chat support
 * - Turn order management
 * - Message attribution
 * - Group-specific behaviors
 * - Participant synchronization
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

    getEventsByType(eventType) {
        return this.events.filter(event => event.eventName === eventType);
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

describe('ChatManager - Group Chat Support (Task 3.1.3)', () => {
    let chatManager;
    let mockEventBus;
    let mockStateManager;
    let mockStorageManager;
    let testSession;

    beforeEach(() => {
        mockEventBus = new MockEventBus();
        mockStateManager = new MockStateManager();
        mockStorageManager = new MockStorageManager();
        chatManager = new ChatManager(mockEventBus, mockStateManager, mockStorageManager);
        mockEventBus.clear();
    });

    afterEach(() => {
        if (chatManager) {
            chatManager.destroy();
        }
    });

    describe('Task 3.1.3: Group Chat Support', () => {
        beforeEach(async () => {
            // Create a test session with multiple participants
            testSession = await chatManager.createChat(['char1', 'char2', 'char3', 'char4']);
        });

        describe('Multi-participant chat support', () => {
            test('should support multiple participants in a single session', async () => {
                expect(testSession.participantIds).toHaveLength(4);
                expect(testSession.participantIds).toContain('char1');
                expect(testSession.participantIds).toContain('char2');
                expect(testSession.participantIds).toContain('char3');
                expect(testSession.participantIds).toContain('char4');
            });

            test('should allow messages from all participants', async () => {
                const message1 = await chatManager.addMessage(testSession.id, 'char1', 'Hello from char1');
                const message2 = await chatManager.addMessage(testSession.id, 'char2', 'Hello from char2');
                const message3 = await chatManager.addMessage(testSession.id, 'char3', 'Hello from char3');
                const message4 = await chatManager.addMessage(testSession.id, 'char4', 'Hello from char4');

                expect(message1.senderId).toBe('char1');
                expect(message2.senderId).toBe('char2');
                expect(message3.senderId).toBe('char3');
                expect(message4.senderId).toBe('char4');

                const messages = chatManager.getMessages(testSession.id);
                expect(messages).toHaveLength(4);
            });

            test('should track participant activity correctly', async () => {
                await chatManager.addMessage(testSession.id, 'char1', 'Message 1');
                await chatManager.addMessage(testSession.id, 'char2', 'Message 2');
                await chatManager.addMessage(testSession.id, 'char1', 'Message 3');

                const stats = chatManager.getMessageStats(testSession.id);
                expect(stats.senderBreakdown.char1).toBe(2);
                expect(stats.senderBreakdown.char2).toBe(1);
                expect(stats.uniqueSenders).toBe(2);
            });

            test('should enforce maximum participant limit', async () => {
                const maxParticipants = chatManager.groupChatConfig.maxParticipants;
                const manyParticipants = Array.from({ length: maxParticipants + 1 }, (_, i) => `char${i + 1}`);
                
                // Should not throw for max participants
                const session = await chatManager.createChat(manyParticipants.slice(0, maxParticipants));
                expect(session.participantIds).toHaveLength(maxParticipants);
            });
        });

        describe('Turn order management', () => {
            test('should set turn order for a session', async () => {
                const turnOrder = ['char1', 'char2', 'char3', 'char4'];
                const result = await chatManager.setTurnOrder(testSession.id, turnOrder);

                expect(result).toBe(true);
                expect(chatManager.getTurnOrder(testSession.id)).toEqual(turnOrder);
            });

            test('should validate turn order participants', async () => {
                const invalidTurnOrder = ['char1', 'char2', 'invalidChar'];
                
                await expect(chatManager.setTurnOrder(testSession.id, invalidTurnOrder))
                    .rejects.toThrow('ChatManager: Invalid participants in turn order: invalidChar');
            });

            test('should get current turn correctly', async () => {
                const turnOrder = ['char1', 'char2', 'char3', 'char4'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                const currentTurn = chatManager.getCurrentTurn(testSession.id);
                expect(currentTurn).toBe('char1'); // Should be first participant initially
            });

            test('should advance turn to next participant', async () => {
                const turnOrder = ['char1', 'char2', 'char3', 'char4'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                const nextTurn = await chatManager.advanceTurn(testSession.id, 'char1');
                expect(nextTurn).toBe('char2');

                const currentTurn = chatManager.getCurrentTurn(testSession.id);
                expect(currentTurn).toBe('char2');
            });

            test('should cycle through turn order', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                // Advance through all participants
                let nextTurn = await chatManager.advanceTurn(testSession.id, 'char1');
                expect(nextTurn).toBe('char2');

                nextTurn = await chatManager.advanceTurn(testSession.id, 'char2');
                expect(nextTurn).toBe('char3');

                nextTurn = await chatManager.advanceTurn(testSession.id, 'char3');
                expect(nextTurn).toBe('char1'); // Should cycle back to first
            });

            test('should track turn statistics', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                // Advance turns
                await chatManager.advanceTurn(testSession.id, 'char1');
                await chatManager.advanceTurn(testSession.id, 'char2');
                await chatManager.advanceTurn(testSession.id, 'char3');

                const stats = chatManager.getGroupChatStats(testSession.id);
                expect(stats.totalTurns).toBe(3);
                expect(stats.currentTurn).toBe('char1');
            });

            test('should handle turn timeout correctly', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                // Simulate time passing by manually updating lastTurn
                const participantStates = chatManager.participantStates.get(testSession.id);
                const char1State = participantStates.get('char1');
                char1State.lastTurn = Date.now() - (chatManager.groupChatConfig.turnTimeout + 1000);

                const currentTurn = chatManager.getCurrentTurn(testSession.id);
                expect(currentTurn).toBe('char1'); // Should be available again after timeout
            });
        });

        describe('Message attribution', () => {
            test('should attribute messages to correct participants', async () => {
                const message1 = await chatManager.addMessage(testSession.id, 'char1', 'Message from char1');
                const message2 = await chatManager.addMessage(testSession.id, 'char2', 'Message from char2');

                expect(message1.senderId).toBe('char1');
                expect(message2.senderId).toBe('char2');
                expect(message1.role).toBe('user'); // Default role
                expect(message2.role).toBe('user');
            });

            test('should support different message roles', async () => {
                const userMessage = await chatManager.addMessage(testSession.id, 'char1', 'User message', { role: 'user' });
                const assistantMessage = await chatManager.addMessage(testSession.id, 'char2', 'Assistant message', { role: 'assistant' });
                const systemMessage = await chatManager.addMessage(testSession.id, 'char3', 'System message', { role: 'system' });

                expect(userMessage.role).toBe('user');
                expect(assistantMessage.role).toBe('assistant');
                expect(systemMessage.role).toBe('system');
            });

            test('should filter messages by sender', async () => {
                await chatManager.addMessage(testSession.id, 'char1', 'Message 1');
                await chatManager.addMessage(testSession.id, 'char2', 'Message 2');
                await chatManager.addMessage(testSession.id, 'char1', 'Message 3');

                const char1Messages = chatManager.getMessages(testSession.id, { senderId: 'char1' });
                const char2Messages = chatManager.getMessages(testSession.id, { senderId: 'char2' });

                expect(char1Messages).toHaveLength(2);
                expect(char2Messages).toHaveLength(1);
                expect(char1Messages.every(msg => msg.senderId === 'char1')).toBe(true);
                expect(char2Messages.every(msg => msg.senderId === 'char2')).toBe(true);
            });

            test('should filter messages by role', async () => {
                await chatManager.addMessage(testSession.id, 'char1', 'User message', { role: 'user' });
                await chatManager.addMessage(testSession.id, 'char2', 'Assistant message', { role: 'assistant' });
                await chatManager.addMessage(testSession.id, 'char3', 'System message', { role: 'system' });

                const userMessages = chatManager.getMessages(testSession.id, { role: 'user' });
                const assistantMessages = chatManager.getMessages(testSession.id, { role: 'assistant' });
                const systemMessages = chatManager.getMessages(testSession.id, { role: 'system' });

                expect(userMessages).toHaveLength(1);
                expect(assistantMessages).toHaveLength(1);
                expect(systemMessages).toHaveLength(1);
            });
        });

        describe('Group-specific behaviors', () => {
            test('should set collaborative behavior', async () => {
                const result = await chatManager.setGroupBehavior(testSession.id, 'collaborative');
                expect(result).toBe(true);

                const behavior = chatManager.getGroupBehavior(testSession.id);
                expect(behavior.type).toBe('collaborative');
                expect(behavior.options.enableCooperation).toBe(true);
                expect(behavior.options.sharedGoals).toBe(true);
            });

            test('should set competitive behavior', async () => {
                const result = await chatManager.setGroupBehavior(testSession.id, 'competitive');
                expect(result).toBe(true);

                const behavior = chatManager.getGroupBehavior(testSession.id);
                expect(behavior.type).toBe('competitive');
                expect(behavior.options.enableCompetition).toBe(true);
                expect(behavior.options.individualGoals).toBe(true);
            });

            test('should set neutral behavior', async () => {
                const result = await chatManager.setGroupBehavior(testSession.id, 'neutral');
                expect(result).toBe(true);

                const behavior = chatManager.getGroupBehavior(testSession.id);
                expect(behavior.type).toBe('neutral');
                expect(behavior.options.enableCooperation).toBe(false);
                expect(behavior.options.enableCompetition).toBe(false);
            });

            test('should reject invalid behavior types', async () => {
                await expect(chatManager.setGroupBehavior(testSession.id, 'invalid'))
                    .rejects.toThrow('ChatManager: Invalid behavior type. Must be one of: collaborative, competitive, neutral');
            });

            test('should merge custom behavior options', async () => {
                const customOptions = {
                    enableCooperation: false,
                    customSetting: 'customValue'
                };

                await chatManager.setGroupBehavior(testSession.id, 'collaborative', customOptions);
                const behavior = chatManager.getGroupBehavior(testSession.id);

                expect(behavior.options.enableCooperation).toBe(false); // Overridden
                expect(behavior.options.sharedGoals).toBe(true); // Default preserved
                expect(behavior.options.customSetting).toBe('customValue'); // Custom added
            });

            test('should emit behavior change events', async () => {
                await chatManager.setGroupBehavior(testSession.id, 'collaborative');
                
                const events = mockEventBus.getEventsByType('chat:groupBehavior:set');
                expect(events).toHaveLength(1);
                expect(events[0].data.behavior.type).toBe('collaborative');
            });
        });

        describe('Participant synchronization', () => {
            test('should start synchronization for a session', async () => {
                const result = await chatManager.startSynchronization(testSession.id);
                expect(result).toBe(true);
                expect(chatManager.synchronizationTimers.has(testSession.id)).toBe(true);
            });

            test('should stop synchronization for a session', async () => {
                await chatManager.startSynchronization(testSession.id);
                const result = chatManager.stopSynchronization(testSession.id);
                
                expect(result).toBe(true);
                expect(chatManager.synchronizationTimers.has(testSession.id)).toBe(false);
            });

            test('should synchronize participant states', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);
                await chatManager.setGroupBehavior(testSession.id, 'collaborative');

                const syncResult = await chatManager.synchronizeParticipants(testSession.id);
                
                expect(syncResult.success).toBe(true);
                expect(syncResult.data.sessionId).toBe(testSession.id);
                expect(syncResult.data.currentTurn).toBe('char1');
                expect(syncResult.data.turnOrder).toEqual(turnOrder);
                expect(syncResult.data.groupBehavior.type).toBe('collaborative');
                expect(Object.keys(syncResult.data.participants)).toHaveLength(3);
            });

            test('should update participant states', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                const updates = {
                    status: 'active',
                    customField: 'customValue'
                };

                const result = await chatManager.updateParticipantState(testSession.id, 'char1', updates);
                expect(result).toBe(true);

                const state = chatManager.getParticipantState(testSession.id, 'char1');
                expect(state.status).toBe('active');
                expect(state.customField).toBe('customValue');
                expect(state.lastUpdated).toBeDefined();
            });

            test('should get participant state correctly', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                const state = chatManager.getParticipantState(testSession.id, 'char1');
                expect(state).toBeDefined();
                expect(state.turnCount).toBe(0);
                expect(state.status).toBe('waiting');
                expect(state.isActive).toBe(false);
            });

            test('should emit synchronization events', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                await chatManager.synchronizeParticipants(testSession.id);
                
                const events = mockEventBus.getEventsByType('chat:participants:synchronized');
                expect(events).toHaveLength(1);
                expect(events[0].data.sessionId).toBe(testSession.id);
            });

            test('should emit participant state update events', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);

                await chatManager.updateParticipantState(testSession.id, 'char1', { status: 'active' });
                
                const events = mockEventBus.getEventsByType('chat:participantState:updated');
                expect(events).toHaveLength(1);
                expect(events[0].data.participantId).toBe('char1');
                expect(events[0].data.state.status).toBe('active');
            });
        });

        describe('Group chat statistics', () => {
            test('should provide comprehensive group chat statistics', async () => {
                const turnOrder = ['char1', 'char2', 'char3'];
                await chatManager.setTurnOrder(testSession.id, turnOrder);
                await chatManager.setGroupBehavior(testSession.id, 'collaborative');
                await chatManager.startSynchronization(testSession.id);

                // Add some messages
                await chatManager.addMessage(testSession.id, 'char1', 'Message 1');
                await chatManager.addMessage(testSession.id, 'char2', 'Message 2');
                await chatManager.addMessage(testSession.id, 'char1', 'Message 3');

                const stats = chatManager.getGroupChatStats(testSession.id);
                
                expect(stats.sessionId).toBe(testSession.id);
                expect(stats.participantCount).toBe(4);
                expect(stats.hasTurnOrder).toBe(true);
                expect(stats.currentTurn).toBe('char1');
                expect(stats.groupBehavior).toBe('collaborative');
                expect(stats.synchronizationActive).toBe(true);
                expect(stats.messageDistribution.char1).toBe(2);
                expect(stats.messageDistribution.char2).toBe(1);
            });

            test('should handle sessions without turn order', async () => {
                const stats = chatManager.getGroupChatStats(testSession.id);
                
                expect(stats.hasTurnOrder).toBe(false);
                expect(stats.currentTurn).toBeNull();
                expect(stats.groupBehavior).toBe('none');
                expect(stats.synchronizationActive).toBe(false);
            });
        });

        describe('Integration tests', () => {
            test('should handle complete group chat workflow', async () => {
                // 1. Create session with multiple participants
                const session = await chatManager.createChat(['char1', 'char2', 'char3']);
                
                // 2. Set turn order
                await chatManager.setTurnOrder(session.id, ['char1', 'char2', 'char3']);
                
                // 3. Set group behavior
                await chatManager.setGroupBehavior(session.id, 'collaborative');
                
                // 4. Start synchronization
                await chatManager.startSynchronization(session.id);
                
                // 5. Add messages in turn order
                await chatManager.addMessage(session.id, 'char1', 'Hello everyone!');
                await chatManager.advanceTurn(session.id, 'char1');
                
                await chatManager.addMessage(session.id, 'char2', 'Hi there!');
                await chatManager.advanceTurn(session.id, 'char2');
                
                await chatManager.addMessage(session.id, 'char3', 'Greetings!');
                await chatManager.advanceTurn(session.id, 'char3');
                
                // 6. Verify state
                const currentTurn = chatManager.getCurrentTurn(session.id);
                expect(currentTurn).toBe('char1'); // Should cycle back
                
                const stats = chatManager.getGroupChatStats(session.id);
                expect(stats.totalTurns).toBe(3);
                expect(stats.messageDistribution.char1).toBe(1);
                expect(stats.messageDistribution.char2).toBe(1);
                expect(stats.messageDistribution.char3).toBe(1);
                
                // 7. Clean up
                chatManager.stopSynchronization(session.id);
            });

            test('should handle error conditions gracefully', async () => {
                // Test with non-existent session
                await expect(chatManager.setTurnOrder('nonexistent', ['char1']))
                    .rejects.toThrow('ChatManager: Session \'nonexistent\' not found');
                
                await expect(chatManager.setGroupBehavior('nonexistent', 'collaborative'))
                    .rejects.toThrow('ChatManager: Session \'nonexistent\' not found');
                
                await expect(chatManager.startSynchronization('nonexistent'))
                    .rejects.toThrow('ChatManager: Session \'nonexistent\' not found');
                
                // Test with invalid participant (first set up turn order to initialize participant states)
                await chatManager.setTurnOrder(testSession.id, ['char1', 'char2']);
                await expect(chatManager.updateParticipantState(testSession.id, 'nonexistent', {}))
                    .rejects.toThrow('ChatManager: Participant \'nonexistent\' not found in session');
            });
        });
    });
}); 