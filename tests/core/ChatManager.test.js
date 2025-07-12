/**
 * ChatManager Tests
 * 
 * Tests for Task 3.1.1: Chat Session Creation
 * Validates chat session initialization, unique session identifiers, 
 * participant management, session metadata, and session persistence.
 */

const ChatManager = require('../../src/chat/ChatManager');
const EventBus = require('../../src/core/EventBus');
const StateManager = require('../../src/core/StateManager');
const StorageManager = require('../../src/core/StorageManager');

describe('ChatManager', () => {
    let chatManager;
    let eventBus;
    let stateManager;
    let storageManager;

    beforeEach(async () => {
        eventBus = new EventBus();
        stateManager = new StateManager(eventBus);
        storageManager = new StorageManager(eventBus);
        await storageManager.init();
        chatManager = new ChatManager(eventBus, stateManager, storageManager);
    });

    afterEach(() => {
        if (chatManager) {
            chatManager.destroy();
        }
    });

    describe('Task 3.1.1: Chat Session Creation', () => {
        describe('Chat session initialization', () => {
            test('should create a chat session with basic properties', async () => {
                const participantIds = ['character1', 'character2'];
                const session = await chatManager.createChat(participantIds);

                expect(session).toBeDefined();
                expect(session.id).toBeDefined();
                expect(session.participantIds).toEqual(participantIds);
                expect(session.createdAt).toBeDefined();
                expect(session.updatedAt).toBeDefined();
                expect(session.messageCount).toBe(0);
                expect(session.isActive).toBe(true); // autoActivate defaults to true
                expect(session.metadata).toBeDefined();
                expect(session.metadata.createdBy).toBe('ChatManager');
                expect(session.metadata.version).toBe('1.0.0');
            });

            test('should create session with custom title and metadata', async () => {
                const participantIds = ['character1'];
                const options = {
                    title: 'Custom Chat Title',
                    metadata: { customField: 'customValue' },
                    autoActivate: false
                };

                const session = await chatManager.createChat(participantIds, options);

                expect(session.title).toBe('Custom Chat Title');
                expect(session.metadata.customField).toBe('customValue');
                expect(session.isActive).toBe(false);
            });

            test('should generate default title for empty participants', async () => {
                const session = await chatManager.createChat([]);
                expect(session.title).toBe('Empty Chat');
            });

            test('should generate default title for single participant', async () => {
                const session = await chatManager.createChat(['character1']);
                expect(session.title).toBe('Chat with character1');
            });

            test('should generate default title for two participants', async () => {
                const session = await chatManager.createChat(['character1', 'character2']);
                expect(session.title).toBe('Chat: character1 & character2');
            });

            test('should generate default title for multiple participants', async () => {
                const session = await chatManager.createChat(['char1', 'char2', 'char3']);
                expect(session.title).toBe('Group Chat (3 participants)');
            });

            test('should throw error for invalid participant IDs', async () => {
                await expect(chatManager.createChat('invalid')).rejects.toThrow(
                    'ChatManager: Participant IDs must be an array'
                );
            });
        });

        describe('Unique session identifiers', () => {
            test('should generate unique session IDs', async () => {
                const session1 = await chatManager.createChat(['char1']);
                const session2 = await chatManager.createChat(['char2']);
                const session3 = await chatManager.createChat(['char3']);

                expect(session1.id).not.toBe(session2.id);
                expect(session2.id).not.toBe(session3.id);
                expect(session1.id).not.toBe(session3.id);
            });

            test('should generate session IDs with proper format', async () => {
                const session = await chatManager.createChat(['char1']);
                
                expect(session.id).toMatch(/^chat_\d+_\d+$/);
                expect(session.id.startsWith('chat_')).toBe(true);
            });

            test('should increment session counter correctly', async () => {
                const session1 = await chatManager.createChat(['char1']);
                const session2 = await chatManager.createChat(['char2']);
                
                const id1 = parseInt(session1.id.split('_')[2]);
                const id2 = parseInt(session2.id.split('_')[2]);
                
                expect(id2).toBe(id1 + 1);
            });
        });

        describe('Participant management', () => {
            test('should track participants correctly', async () => {
                const participantIds = ['char1', 'char2', 'char3'];
                const session = await chatManager.createChat(participantIds);

                expect(session.participantIds).toEqual(participantIds);
                expect(chatManager.participants.get(session.id)).toBeDefined();
                expect(chatManager.participants.get(session.id).size).toBe(3);
            });

            test('should add participants to existing session', async () => {
                const session = await chatManager.createChat(['char1']);
                const result = await chatManager.addParticipants(session.id, ['char2', 'char3']);

                expect(result).toBe(true);
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.participantIds).toContain('char1');
                expect(updatedSession.participantIds).toContain('char2');
                expect(updatedSession.participantIds).toContain('char3');
            });

            test('should not add duplicate participants', async () => {
                const session = await chatManager.createChat(['char1']);
                const result = await chatManager.addParticipants(session.id, ['char1', 'char2']);

                expect(result).toBe(true);
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.participantIds).toEqual(['char1', 'char2']);
            });

            test('should remove participants from session', async () => {
                const session = await chatManager.createChat(['char1', 'char2', 'char3']);
                const result = await chatManager.removeParticipants(session.id, ['char2']);

                expect(result).toBe(true);
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.participantIds).toContain('char1');
                expect(updatedSession.participantIds).not.toContain('char2');
                expect(updatedSession.participantIds).toContain('char3');
            });

            test('should handle removing non-existent participants gracefully', async () => {
                const session = await chatManager.createChat(['char1']);
                const result = await chatManager.removeParticipants(session.id, ['nonexistent']);

                expect(result).toBe(true);
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.participantIds).toEqual(['char1']);
            });

            test('should throw error for invalid session ID when adding participants', async () => {
                await expect(chatManager.addParticipants('invalid', ['char1'])).rejects.toThrow(
                    "ChatManager: Session 'invalid' not found"
                );
            });

            test('should throw error for invalid session ID when removing participants', async () => {
                await expect(chatManager.removeParticipants('invalid', ['char1'])).rejects.toThrow(
                    "ChatManager: Session 'invalid' not found"
                );
            });
        });

        describe('Session metadata', () => {
            test('should initialize session metadata correctly', async () => {
                const session = await chatManager.createChat(['char1']);
                
                expect(session.metadata).toBeDefined();
                expect(session.metadata.createdBy).toBe('ChatManager');
                expect(session.metadata.version).toBe('1.0.0');
            });

            test('should update session metadata', async () => {
                const session = await chatManager.createChat(['char1']);
                const newMetadata = { customField: 'newValue', priority: 'high' };
                
                const result = await chatManager.updateSessionMetadata(session.id, newMetadata);
                
                expect(result).toBe(true);
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.metadata.customField).toBe('newValue');
                expect(updatedSession.metadata.priority).toBe('high');
                expect(updatedSession.metadata.lastUpdated).toBeDefined();
            });

            test('should preserve existing metadata when updating', async () => {
                const session = await chatManager.createChat(['char1']);
                const originalCreatedBy = session.metadata.createdBy;
                
                await chatManager.updateSessionMetadata(session.id, { newField: 'value' });
                
                const updatedSession = chatManager.getChat(session.id);
                expect(updatedSession.metadata.createdBy).toBe(originalCreatedBy);
                expect(updatedSession.metadata.newField).toBe('value');
            });

            test('should throw error for invalid session ID when updating metadata', async () => {
                await expect(chatManager.updateSessionMetadata('invalid', {})).rejects.toThrow(
                    "ChatManager: Session 'invalid' not found"
                );
            });
        });

        describe('Session persistence', () => {
            test('should save sessions to storage', async () => {
                const session = await chatManager.createChat(['char1']);
                
                const result = await chatManager.saveSessions();
                
                expect(result).toBe(true);
            });

            test('should load sessions from storage', async () => {
                const session = await chatManager.createChat(['char1']);
                await chatManager.saveSessions();
                
                // Create new instance to test loading
                const newChatManager = new ChatManager(eventBus, stateManager, storageManager);
                const result = await newChatManager.loadSessions();
                
                expect(result).toBe(true);
                const loadedSession = newChatManager.getChat(session.id);
                expect(loadedSession).toBeDefined();
                expect(loadedSession.participantIds).toEqual(session.participantIds);
                
                newChatManager.destroy();
            });

            test('should handle storage errors gracefully', async () => {
                // Test without storage manager
                const chatManagerNoStorage = new ChatManager(eventBus, stateManager, null);
                const session = await chatManagerNoStorage.createChat(['char1']);
                
                const result = await chatManagerNoStorage.saveSessions();
                expect(result).toBe(false);
                
                chatManagerNoStorage.destroy();
            });
        });

        describe('Session activation and management', () => {
            test('should activate a chat session', async () => {
                const session = await chatManager.createChat(['char1'], { autoActivate: false });
                expect(session.isActive).toBe(false);
                
                const result = await chatManager.activateChat(session.id);
                
                expect(result).toBe(true);
                const activatedSession = chatManager.getChat(session.id);
                expect(activatedSession.isActive).toBe(true);
            });

            test('should deactivate previous active session when activating new one', async () => {
                const session1 = await chatManager.createChat(['char1']);
                const session2 = await chatManager.createChat(['char2'], { autoActivate: false });
                
                expect(session1.isActive).toBe(true);
                expect(session2.isActive).toBe(false);
                
                await chatManager.activateChat(session2.id);
                
                const updatedSession1 = chatManager.getChat(session1.id);
                const updatedSession2 = chatManager.getChat(session2.id);
                
                expect(updatedSession1.isActive).toBe(false);
                expect(updatedSession2.isActive).toBe(true);
            });

            test('should get active chat session', async () => {
                const session = await chatManager.createChat(['char1']);
                
                const activeChat = chatManager.getActiveChat();
                
                expect(activeChat).toBeDefined();
                expect(activeChat.id).toBe(session.id);
                expect(activeChat.isActive).toBe(true);
            });

            test('should return null when no active chat', async () => {
                const session = await chatManager.createChat(['char1'], { autoActivate: false });
                
                const activeChat = chatManager.getActiveChat();
                
                expect(activeChat).toBeNull();
            });

            test('should get chat by ID', async () => {
                const session = await chatManager.createChat(['char1']);
                
                const retrievedSession = chatManager.getChat(session.id);
                
                expect(retrievedSession).toBeDefined();
                expect(retrievedSession.id).toBe(session.id);
            });

            test('should return null for non-existent chat', async () => {
                const session = chatManager.getChat('nonexistent');
                expect(session).toBeNull();
            });

            test('should get all chats with filters', async () => {
                const session1 = await chatManager.createChat(['char1']);
                const session2 = await chatManager.createChat(['char2'], { autoActivate: false });
                const session3 = await chatManager.createChat(['char1', 'char3']);
                
                const allChats = chatManager.getAllChats();
                expect(allChats).toHaveLength(3);
                
                const activeChats = chatManager.getAllChats({ activeOnly: true });
                expect(activeChats).toHaveLength(1);
                expect(activeChats[0].isActive).toBe(true);
                
                const char1Chats = chatManager.getAllChats({ participantIds: ['char1'] });
                expect(char1Chats).toHaveLength(2);
            });
        });

        describe('Session deletion', () => {
            test('should delete a chat session', async () => {
                const session = await chatManager.createChat(['char1']);
                
                const result = await chatManager.deleteChat(session.id);
                
                expect(result).toBe(true);
                expect(chatManager.getChat(session.id)).toBeNull();
                expect(chatManager.participants.has(session.id)).toBe(false);
                expect(chatManager.sessionMetadata.has(session.id)).toBe(false);
            });

            test('should clear active chat when deleting active session', async () => {
                const session = await chatManager.createChat(['char1']);
                
                await chatManager.deleteChat(session.id);
                
                expect(chatManager.getActiveChat()).toBeNull();
            });

            test('should throw error for non-existent session', async () => {
                await expect(chatManager.deleteChat('nonexistent')).rejects.toThrow(
                    "ChatManager: Session 'nonexistent' not found"
                );
            });
        });

        describe('Event emission', () => {
            test('should emit chat:created event', async () => {
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:created', eventSpy);
                
                const session = await chatManager.createChat(['char1']);
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: session,
                    participantIds: ['char1']
                });
            });

            test('should emit chat:activated event', async () => {
                const session = await chatManager.createChat(['char1'], { autoActivate: false });
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:activated', eventSpy);
                
                await chatManager.activateChat(session.id);
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: expect.objectContaining({ isActive: true }),
                    previousActive: undefined
                });
            });

            test('should emit chat:participants:added event', async () => {
                const session = await chatManager.createChat(['char1']);
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:participants:added', eventSpy);
                
                await chatManager.addParticipants(session.id, ['char2']);
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: expect.any(Object),
                    addedParticipants: ['char2']
                });
            });

            test('should emit chat:participants:removed event', async () => {
                const session = await chatManager.createChat(['char1', 'char2']);
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:participants:removed', eventSpy);
                
                await chatManager.removeParticipants(session.id, ['char2']);
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: expect.any(Object),
                    removedParticipants: ['char2']
                });
            });

            test('should emit chat:metadata:updated event', async () => {
                const session = await chatManager.createChat(['char1']);
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:metadata:updated', eventSpy);
                
                await chatManager.updateSessionMetadata(session.id, { newField: 'value' });
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: expect.any(Object),
                    updatedMetadata: { newField: 'value' }
                });
            });

            test('should emit chat:deleted event', async () => {
                const session = await chatManager.createChat(['char1']);
                const eventSpy = jest.fn();
                eventBus.subscribe('chat:deleted', eventSpy);
                
                await chatManager.deleteChat(session.id);
                
                expect(eventSpy).toHaveBeenCalledWith({
                    sessionId: session.id,
                    session: session
                });
            });
        });

        describe('State manager integration', () => {
            test('should update state manager when creating chat', async () => {
                const session = await chatManager.createChat(['char1']);
                
                const stateSession = stateManager.getState(`chatSessions.${session.id}`);
                expect(stateSession).toBeDefined();
                expect(stateSession.id).toBe(session.id);
            });

            test('should update state manager when activating chat', async () => {
                const session = await chatManager.createChat(['char1'], { autoActivate: false });
                
                await chatManager.activateChat(session.id);
                
                const activeChatId = stateManager.getState('activeChat');
                expect(activeChatId).toBe(session.id);
            });

            test('should update state manager when deleting chat', async () => {
                const session = await chatManager.createChat(['char1']);
                
                await chatManager.deleteChat(session.id);
                
                const stateSession = stateManager.getState(`chatSessions.${session.id}`);
                expect(stateSession).toBeUndefined();
            });
        });

        describe('Statistics and debugging', () => {
            test('should get session statistics', async () => {
                const session1 = await chatManager.createChat(['char1']);
                const session2 = await chatManager.createChat(['char2', 'char3'], { autoActivate: false });
                
                const stats = chatManager.getSessionStats();
                expect(stats.totalSessions).toBe(2);
                expect(stats.activeSessions).toBe(1);
                expect(stats.totalParticipants).toBe(3);
                expect(stats.averageParticipants).toBe(1.5);
            });

            test('should get specific session statistics', async () => {
                const session = await chatManager.createChat(['char1', 'char2']);
                
                const stats = chatManager.getSessionStats(session.id);
                expect(stats.sessionId).toBe(session.id);
                expect(stats.participantCount).toBe(2);
                expect(stats.messageCount).toBe(0);
                expect(stats.isActive).toBe(true);
            });

            test('should return null for non-existent session stats', async () => {
                const stats = chatManager.getSessionStats('nonexistent');
                expect(stats).toBeNull();
            });

            test('should get runtime statistics', async () => {
                const stats = chatManager.getStats();
                
                expect(stats.totalSessions).toBe(0);
                expect(stats.activeSessions).toBe(0);
                expect(stats.totalParticipants).toBe(0);
                expect(stats.autoSaveEnabled).toBe(true);
                expect(stats.autoSaveInterval).toBe(30000);
                expect(stats.maxMessagesPerSession).toBe(1000);
                expect(stats.maxMessageLength).toBe(10000);
                expect(stats.debugMode).toBe(false);
            });

            test('should enable debug mode', async () => {
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                
                chatManager.setDebugMode(true);
                await chatManager.createChat(['char1']);
                
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('ChatManager: Created chat session')
                );
                
                consoleSpy.mockRestore();
            });
        });

        describe('Auto-save functionality', () => {
            test('should start auto-save', async () => {
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                
                chatManager.setDebugMode(true);
                chatManager.startAutoSave();
                
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('ChatManager: Auto-save started')
                );
                
                consoleSpy.mockRestore();
            });

            test('should stop auto-save', async () => {
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                
                chatManager.setDebugMode(true);
                chatManager.stopAutoSave();
                
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('ChatManager: Auto-save stopped')
                );
                
                consoleSpy.mockRestore();
            });

            test('should not start multiple auto-save timers', async () => {
                chatManager.startAutoSave();
                const timer1 = chatManager.autoSaveTimer;
                
                chatManager.startAutoSave();
                const timer2 = chatManager.autoSaveTimer;
                
                expect(timer1).not.toBe(timer2);
            });
        });

        describe('Resource cleanup', () => {
            test('should destroy resources properly', async () => {
                const session = await chatManager.createChat(['char1']);
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                
                chatManager.setDebugMode(true);
                chatManager.destroy();
                
                expect(consoleSpy).toHaveBeenCalledWith('ChatManager: Destroyed');
                expect(chatManager.sessions.size).toBe(0);
                expect(chatManager.participants.size).toBe(0);
                expect(chatManager.sessionMetadata.size).toBe(0);
                expect(chatManager.autoSaveTimer).toBeNull();
                
                consoleSpy.mockRestore();
            });
        });
    });
}); 