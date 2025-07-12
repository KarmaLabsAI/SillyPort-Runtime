/**
 * FormatImporter Tests - Task 3.2.1: Oobabooga Format Support
 * 
 * Tests for chat format import functionality including:
 * - Format detection
 * - Message parsing
 * - Role identification
 * - Conversation reconstruction
 * - Error handling
 */

const EventBus = require('../../src/core/EventBus');
const StateManager = require('../../src/core/StateManager');
const ChatManager = require('../../src/chat/ChatManager');
const { FormatImporter } = require('../../src/chat/FormatImporter');

// Mock storage manager for testing
class MockStorageManager {
    async init() { return true; }
    async save() { return 'test-key'; }
    async load() { return null; }
}

describe('FormatImporter - Task 3.2.1: Oobabooga Format Support', () => {
    let eventBus, stateManager, chatManager, formatImporter, storageManager;

    beforeEach(() => {
        eventBus = new EventBus();
        stateManager = new StateManager(eventBus);
        storageManager = new MockStorageManager();
        chatManager = new ChatManager(eventBus, stateManager, storageManager);
        formatImporter = new FormatImporter(eventBus, chatManager);
    });

    describe('Format Detection', () => {
        test('should detect Oobabooga format from text', () => {
            const oobaboogaText = `### Human: Hello!
### Assistant: Hi there!`;
            
            const detectedFormat = formatImporter.detectFormat(oobaboogaText);
            expect(detectedFormat).toBe('oobabooga');
        });

        test('should detect Oobabooga format with content after headers', () => {
            const oobaboogaText = `### Human: Hello! How are you?
### Assistant: I'm doing well, thank you!`;
            
            const detectedFormat = formatImporter.detectFormat(oobaboogaText);
            expect(detectedFormat).toBe('oobabooga');
        });

        test('should detect Agnai format from JSON', () => {
            const agnaiData = {
                messages: [],
                userId: "user123",
                characterId: "char456"
            };
            
            const detectedFormat = formatImporter.detectFormat(agnaiData);
            expect(detectedFormat).toBe('agnai');
        });

        test('should detect CAI Tools format from JSON', () => {
            const caiData = {
                history: [],
                character_name: "Test",
                user_name: "User"
            };
            
            const detectedFormat = formatImporter.detectFormat(caiData);
            expect(detectedFormat).toBe('caiTools');
        });

        test('should detect SillyTavern format from JSON', () => {
            const stData = {
                messages: [],
                character_name: "Test",
                user_name: "User",
                chat_metadata: {}
            };
            
            const detectedFormat = formatImporter.detectFormat(stData);
            expect(detectedFormat).toBe('sillytavern');
        });

        test('should return null for unknown format', () => {
            const unknownData = "This is just some random text";
            
            const detectedFormat = formatImporter.detectFormat(unknownData);
            expect(detectedFormat).toBeNull();
        });

        test('should throw error for null data', () => {
            expect(() => formatImporter.detectFormat(null)).toThrow('FormatImporter: Data is required for format detection');
        });
    });

    describe('Oobabooga Format Parsing', () => {
        test('should parse Oobabooga messages correctly', () => {
            const oobaboogaText = `### Human: Hello! How are you today?

### Assistant: Hello! I'm doing quite well, thank you for asking. The weather is lovely today and I'm feeling quite cheerful. How about you? How has your day been so far?

### Human: It's been pretty good! I've been working on some interesting projects.`;

            const messages = formatImporter.parseOobaboogaMessages(oobaboogaText);
            
            expect(messages).toHaveLength(3);
            expect(messages[0]).toEqual({
                sender: 'user',
                role: 'user',
                content: 'Hello! How are you today?',
                timestamp: expect.any(Number),
                metadata: {
                    originalFormat: 'oobabooga',
                    lineNumber: 1
                }
            });
            expect(messages[1]).toEqual({
                sender: 'assistant',
                role: 'assistant',
                content: 'Hello! I\'m doing quite well, thank you for asking. The weather is lovely today and I\'m feeling quite cheerful. How about you? How has your day been so far?',
                timestamp: expect.any(Number),
                metadata: {
                    originalFormat: 'oobabooga',
                    lineNumber: 3
                }
            });
        });

        test('should handle Oobabooga messages with content on header line', () => {
            const oobaboogaText = `### Human: Hello!
### Assistant: Hi there!`;

            const messages = formatImporter.parseOobaboogaMessages(oobaboogaText);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('Hello!');
            expect(messages[1].content).toBe('Hi there!');
        });

        test('should handle Oobabooga messages with multi-line content', () => {
            const oobaboogaText = `### Human: Hello!

### Assistant: Hi there!
This is a multi-line response.
It has multiple sentences.`;

            const messages = formatImporter.parseOobaboogaMessages(oobaboogaText);
            
            expect(messages).toHaveLength(2);
            expect(messages[1].content).toBe('Hi there!\nThis is a multi-line response.\nIt has multiple sentences.');
        });

        test('should return empty array for text without valid messages', () => {
            const invalidText = "This is just some random text without any message headers";
            
            const messages = formatImporter.parseOobaboogaMessages(invalidText);
            expect(messages).toHaveLength(0);
        });

        test('should handle empty text', () => {
            const messages = formatImporter.parseOobaboogaMessages('');
            expect(messages).toHaveLength(0);
        });
    });

    describe('Oobabooga Import', () => {
        test('should import Oobabooga format successfully', async () => {
            const oobaboogaText = `### Human: Hello! How are you today?

### Assistant: Hello! I'm doing quite well, thank you for asking.`;

            const result = await formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant'],
                metadata: { title: 'Test Import' }
            });

            expect(result.format).toBe('oobabooga');
            expect(result.messageCount).toBe(2);
            expect(result.session).toBeDefined();
            expect(result.messages).toHaveLength(2);
            expect(result.session.title).toBe('Test Import');
        });

        test('should create chat session with correct metadata', async () => {
            const oobaboogaText = `### Human: Hello!
### Assistant: Hi!`;

            const result = await formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant']
            });

            expect(result.session.metadata.importFormat).toBe('oobabooga');
            expect(result.session.metadata.importTimestamp).toBeDefined();
            expect(result.session.metadata.originalMessageCount).toBe(2);
        });

        test('should add messages with correct metadata', async () => {
            const oobaboogaText = `### Human: Hello!
### Assistant: Hi!`;

            const result = await formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant']
            });

            expect(result.messages[0].metadata.imported).toBe(true);
            expect(result.messages[0].metadata.originalFormat).toBe('oobabooga');
            expect(result.messages[1].metadata.imported).toBe(true);
            expect(result.messages[1].metadata.originalFormat).toBe('oobabooga');
        });

        test('should emit import event', async () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('chat:imported', eventSpy);

            const oobaboogaText = `### Human: Hello!
### Assistant: Hi!`;

            await formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant']
            });

            expect(eventSpy).toHaveBeenCalledWith({
                format: 'oobabooga',
                sessionId: expect.any(String),
                messageCount: 2,
                metadata: {}
            });
        });

        test('should throw error for empty Oobabooga data', async () => {
            await expect(formatImporter.importChat('', { participants: ['user'] }))
                .rejects.toThrow('FormatImporter: No valid messages found in Oobabooga data');
        });

        test('should throw error for non-string Oobabooga data', async () => {
            await expect(formatImporter.importChat({}, { participants: ['user'] }))
                .rejects.toThrow('FormatImporter: Oobabooga format requires string data');
        });
    });

    describe('Other Format Imports', () => {
        test('should import Agnai format successfully', async () => {
            const agnaiData = {
                userId: "user123",
                characterId: "char456",
                characterName: "Seraphina",
                messages: [
                    {
                        id: "msg1",
                        role: "user",
                        content: "Hello!",
                        timestamp: 1640995200000
                    },
                    {
                        id: "msg2",
                        role: "assistant",
                        content: "Hi there!",
                        timestamp: 1640995260000
                    }
                ]
            };

            const result = await formatImporter.importChat(agnaiData, {
                participants: ['user', 'Seraphina']
            });

            expect(result.format).toBe('agnai');
            expect(result.messageCount).toBe(2);
            expect(result.session.metadata.agnaiData).toEqual({
                userId: "user123",
                characterId: "char456",
                characterName: "Seraphina"
            });
        });

        test('should import CAI Tools format successfully', async () => {
            const caiData = {
                character_name: "Seraphina",
                user_name: "Traveler",
                history: [
                    {
                        id: "hist1",
                        role: "user",
                        content: "Hello!",
                        timestamp: 1640995200000
                    },
                    {
                        id: "hist2",
                        role: "assistant",
                        content: "Hi there!",
                        timestamp: 1640995260000
                    }
                ]
            };

            const result = await formatImporter.importChat(caiData, {
                participants: ['Traveler', 'Seraphina']
            });

            expect(result.format).toBe('caiTools');
            expect(result.messageCount).toBe(2);
            expect(result.session.metadata.caiData).toEqual({
                characterName: "Seraphina",
                userName: "Traveler"
            });
        });

        test('should import SillyTavern format successfully', async () => {
            const stData = {
                character_name: "Seraphina",
                user_name: "Adventurer",
                chat_metadata: {
                    title: "Test Chat",
                    created: 1640995200000
                },
                messages: [
                    {
                        id: "msg1",
                        role: "User",
                        content: "Hello!",
                        timestamp: 1640995200000
                    },
                    {
                        id: "msg2",
                        role: "Assistant",
                        content: "Hi there!",
                        timestamp: 1640995260000
                    }
                ]
            };

            const result = await formatImporter.importChat(stData, {
                participants: ['Adventurer', 'Seraphina']
            });

            expect(result.format).toBe('sillytavern');
            expect(result.messageCount).toBe(2);
            expect(result.session.metadata.stData).toEqual({
                characterName: "Seraphina",
                userName: "Adventurer",
                chatMetadata: {
                    title: "Test Chat",
                    created: 1640995200000
                }
            });
        });
    });

    describe('Error Handling', () => {
        test('should throw error for unsupported format', async () => {
            await expect(formatImporter.importChat('data', { format: 'unsupported' }))
                .rejects.toThrow('FormatImporter: Import not implemented for unsupported');
        });

        test('should throw error for invalid Agnai data', async () => {
            await expect(formatImporter.importChat({}, { format: 'agnai' }))
                .rejects.toThrow('FormatImporter: Agnai format requires messages array');
        });

        test('should throw error for invalid CAI Tools data', async () => {
            await expect(formatImporter.importChat({}, { format: 'caiTools' }))
                .rejects.toThrow('FormatImporter: CAI Tools format requires history array');
        });

        test('should throw error for invalid SillyTavern data', async () => {
            await expect(formatImporter.importChat({}, { format: 'sillytavern' }))
                .rejects.toThrow('FormatImporter: SillyTavern format requires messages array');
        });

        test('should throw error for null data', async () => {
            await expect(formatImporter.importChat(null))
                .rejects.toThrow('FormatImporter: Data is required for import');
        });
    });

    describe('Utility Methods', () => {
        test('should return supported formats', () => {
            const formats = formatImporter.getSupportedFormats();
            
            expect(formats.oobabooga).toBeDefined();
            expect(formats.agnai).toBeDefined();
            expect(formats.caiTools).toBeDefined();
            expect(formats.sillytavern).toBeDefined();
            
            expect(formats.oobabooga.name).toBe('Oobabooga');
            expect(formats.oobabooga.description).toBe('text-generation-webui conversation format');
        });

        test('should set debug mode', () => {
            formatImporter.setDebugMode(true);
            expect(formatImporter.debugMode).toBe(true);
            
            formatImporter.setDebugMode(false);
            expect(formatImporter.debugMode).toBe(false);
        });

        test('should validate import data', () => {
            const validOobabooga = `### Human: Hello!
### Assistant: Hi!`;
            
            expect(formatImporter.validateImportData(validOobabooga, 'oobabooga')).toBe(true);
            expect(formatImporter.validateImportData('invalid', 'oobabooga')).toBe(false);
            expect(formatImporter.validateImportData(null, 'oobabooga')).toBe(false);
        });
    });

    describe('Integration with ChatManager', () => {
        test('should create chat session through ChatManager', async () => {
            const createChatSpy = jest.spyOn(chatManager, 'createChat');
            const addMessageSpy = jest.spyOn(chatManager, 'addMessage');

            const oobaboogaText = `### Human: Hello!
### Assistant: Hi!`;

            await formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant']
            });

            expect(createChatSpy).toHaveBeenCalledWith(
                ['user', 'assistant'],
                expect.objectContaining({
                    title: expect.any(String),
                    metadata: expect.objectContaining({
                        importFormat: 'oobabooga'
                    })
                })
            );

            expect(addMessageSpy).toHaveBeenCalledTimes(2);
        });

        test('should handle ChatManager errors gracefully', async () => {
            // Mock ChatManager to throw error
            chatManager.createChat = jest.fn().mockRejectedValue(new Error('Chat creation failed'));

            const oobaboogaText = `### Human: Hello!
### Assistant: Hi!`;

            await expect(formatImporter.importChat(oobaboogaText, {
                participants: ['user', 'assistant']
            })).rejects.toThrow('Chat creation failed');
        });
    });
}); 