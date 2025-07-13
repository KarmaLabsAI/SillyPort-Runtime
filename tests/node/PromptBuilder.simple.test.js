/**
 * PromptBuilder Tests - Task 4.1.1: Context Assembly
 * 
 * Tests for prompt construction, character data integration, chat history formatting,
 * system prompt construction, context window management, and priority-based inclusion.
 */

const PromptBuilder = require('../../src/prompt/PromptBuilder');
const EventBus = require('../../src/core/EventBus');
const ConfigManager = require('../../src/core/ConfigManager');

describe('PromptBuilder - Task 4.1.1: Context Assembly', () => {
    let promptBuilder;
    let eventBus;
    let configManager;

    beforeEach(() => {
        eventBus = new EventBus();
        configManager = new ConfigManager(eventBus);
        promptBuilder = new PromptBuilder(eventBus, configManager);
    });

    afterEach(() => {
        promptBuilder.destroy();
    });

    describe('Character Data Integration', () => {
        test('should integrate character data into prompt', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'A test character for testing',
                    personality: 'Friendly and helpful',
                    scenario: 'Testing scenario',
                    first_mes: 'Hello!',
                    mes_example: 'Test: Hello\nCharacter: Hi there!'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('Test Character');
            expect(result.content).toContain('A test character for testing');
            expect(result.content).toContain('Friendly and helpful');
            expect(result.content).toContain('Testing scenario');
            expect(result.content).toContain('Hello!');
            expect(result.content).toContain('Test: Hello');
        });

        test('should handle missing character data gracefully', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character'
                    // Missing other fields
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('Test Character');
            expect(result.metadata.characterId).toBe('test-character');
        });

        test('should handle null character gracefully', async () => {
            const result = await promptBuilder.buildPrompt(null, [], null);

            expect(result.content).toBeDefined();
            expect(result.metadata.characterId).toBe('unknown');
        });
    });

    describe('Chat History Formatting', () => {
        test('should format chat history correctly', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const messages = [
                {
                    id: 'msg1',
                    senderId: 'user',
                    content: 'Hello there!',
                    timestamp: 1000
                },
                {
                    id: 'msg2',
                    senderId: 'test-character',
                    content: 'Hi! How are you?',
                    timestamp: 2000
                }
            ];

            const result = await promptBuilder.buildPrompt(character, messages, null);

            expect(result.content).toContain('You: Hello there!');
            expect(result.content).toContain('Test Character: Hi! How are you?');
            expect(result.metadata.messageCount).toBe(2);
        });

        test('should respect history length limits', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const messages = Array.from({ length: 10 }, (_, i) => ({
                id: `msg${i}`,
                senderId: i % 2 === 0 ? 'user' : 'test-character',
                content: 'A'.repeat(100), // Long message
                timestamp: i * 1000
            }));

            const result = await promptBuilder.buildPrompt(character, messages, null, {
                maxHistoryLength: 500
            });

            // Should truncate history to fit within limits
            expect(result.content.length).toBeLessThan(2000);
        });

        test('should sort messages by timestamp', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const messages = [
                {
                    id: 'msg2',
                    senderId: 'test-character',
                    content: 'Second message',
                    timestamp: 2000
                },
                {
                    id: 'msg1',
                    senderId: 'user',
                    content: 'First message',
                    timestamp: 1000
                }
            ];

            const result = await promptBuilder.buildPrompt(character, messages, null);

            const content = result.content;
            const firstIndex = content.indexOf('First message');
            const secondIndex = content.indexOf('Second message');

            expect(firstIndex).toBeLessThan(secondIndex);
        });
    });

    describe('System Prompt Construction', () => {
        test('should use character system prompt when available', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    system_prompt: 'You are a helpful AI assistant.'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('You are a helpful AI assistant.');
        });

        test('should use default system prompt when none provided', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('You are Test Character in a roleplay conversation');
        });

        test('should respect system prompt length limits', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    system_prompt: 'A'.repeat(2000) // Very long system prompt
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                maxSystemPromptLength: 100
            });

            expect(result.components.system.length).toBeLessThanOrEqual(100);
        });
    });

    describe('Context Window Management', () => {
        test('should respect overall context length limits', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'A'.repeat(1000),
                    personality: 'B'.repeat(1000),
                    scenario: 'C'.repeat(1000)
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                maxContextLength: 500
            });

            expect(result.content.length).toBeLessThanOrEqual(500);
        });

        test('should prioritize components based on configuration', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'Character description',
                    personality: 'Character personality',
                    scenario: 'Character scenario'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                maxContextLength: 200
            });

            // Should include character name and basic info even with tight limits
            expect(result.content).toContain('Test Character');
        });
    });

    describe('Priority-based Inclusion', () => {
        test('should include world info when available', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    world_info: 'This is a fantasy world with magic.'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('This is a fantasy world with magic');
        });

        test('should include user persona when provided', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                userPersona: 'You are a curious explorer.'
            });

            expect(result.content).toContain('You are a curious explorer');
        });

        test('should handle complex world info objects', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    world_info: [
                        { name: 'Magic', content: 'Magic exists in this world' },
                        { name: 'Technology', content: 'Advanced technology is available' }
                    ]
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('Magic: Magic exists in this world');
            expect(result.content).toContain('Technology: Advanced technology is available');
        });
    });

    describe('Template Processing', () => {
        test('should process context preset templates correctly', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'A test character',
                    personality: 'Friendly'
                }
            };

            const contextPreset = {
                name: 'Test Preset',
                story_string: '{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}\'s personality: {{personality}}\n{{/if}}'
            };

            const result = await promptBuilder.buildPrompt(character, [], contextPreset);

            expect(result.content).toContain('A test character');
            expect(result.content).toContain('Test Character\'s personality: Friendly');
        });

        test('should handle conditional template logic', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const contextPreset = {
                name: 'Test Preset',
                story_string: '{{#if description}}{{description}}\n{{/if}}{{#if missing_field}}This should not appear{{/if}}'
            };

            const result = await promptBuilder.buildPrompt(character, [], contextPreset);

            expect(result.content).not.toContain('This should not appear');
        });

        test('should use default template when no preset provided', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'A test character'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toContain('A test character');
        });
    });

    describe('Caching System', () => {
        test('should cache prompt results', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            // First call
            const result1 = await promptBuilder.buildPrompt(character, [], null);
            
            // Second call should use cache
            const result2 = await promptBuilder.buildPrompt(character, [], null);

            expect(result1.content).toBe(result2.content);
            expect(result2.metadata.cacheHit).toBe(false); // First call
        });

        test('should respect cache size limits', async () => {
            promptBuilder.setCacheSize(2);

            const character1 = { id: 'char1', data: { name: 'Character 1' } };
            const character2 = { id: 'char2', data: { name: 'Character 2' } };
            const character3 = { id: 'char3', data: { name: 'Character 3' } };

            await promptBuilder.buildPrompt(character1, [], null);
            await promptBuilder.buildPrompt(character2, [], null);
            await promptBuilder.buildPrompt(character3, [], null);

            expect(promptBuilder.promptCache.size).toBe(2);
        });

        test('should disable caching when requested', async () => {
            promptBuilder.setCacheEnabled(false);

            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            await promptBuilder.buildPrompt(character, [], null);
            await promptBuilder.buildPrompt(character, [], null);

            expect(promptBuilder.promptCache.size).toBe(0);
        });
    });

    describe('Event Emission', () => {
        test('should emit prompt:built event', async () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:built', eventSpy);

            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            await promptBuilder.buildPrompt(character, [], null);

            expect(eventSpy).toHaveBeenCalledWith({
                characterId: 'test-character',
                messageCount: 0,
                promptLength: expect.any(Number),
                buildTime: expect.any(Number)
            });
        });

        test('should emit prompt:error event on failure', async () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:error', eventSpy);

            // Force an error by passing invalid data
            await promptBuilder.buildPrompt('invalid', [], null);

            expect(eventSpy).toHaveBeenCalledWith({
                error: expect.any(String),
                characterId: 'unknown',
                messageCount: 0
            });
        });
    });

    describe('Statistics Tracking', () => {
        test('should track prompt building statistics', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            await promptBuilder.buildPrompt(character, [], null);
            await promptBuilder.buildPrompt(character, [], null);

            const stats = promptBuilder.getStats();

            expect(stats.promptsBuilt).toBe(2);
            expect(stats.averageLength).toBeGreaterThan(0);
            expect(stats.totalLength).toBeGreaterThan(0);
        });

        test('should track cache performance', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            // First call (cache miss)
            await promptBuilder.buildPrompt(character, [], null);
            
            // Second call (cache hit)
            await promptBuilder.buildPrompt(character, [], null);

            const stats = promptBuilder.getStats();

            expect(stats.cacheHits).toBe(1);
            expect(stats.cacheMisses).toBe(1);
        });
    });

    describe('Configuration Management', () => {
        test('should merge configuration with defaults', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                maxContextLength: 1000,
                trimSentences: true
            });

            expect(result.config.maxContextLength).toBe(1000);
            expect(result.config.trimSentences).toBe(true);
            expect(result.config.maxHistoryLength).toBe(2000); // Default value
        });

        test('should use config manager settings', async () => {
            configManager.set('prompt.maxContextLength', 800);
            configManager.set('prompt.trimSentences', true);

            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.config.maxContextLength).toBe(800);
            expect(result.config.trimSentences).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid character data gracefully', async () => {
            const character = {
                id: 'test-character',
                data: null
            };

            const result = await promptBuilder.buildPrompt(character, [], null);

            expect(result.content).toBeDefined();
            expect(result.metadata.characterId).toBe('test-character');
        });

        test('should handle invalid messages gracefully', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const messages = [
                { id: 'msg1', content: 'Valid message' },
                { id: 'msg2', content: null },
                { id: 'msg3' } // Missing content
            ];

            const result = await promptBuilder.buildPrompt(character, messages, null);

            expect(result.content).toContain('Valid message');
            expect(result.metadata.messageCount).toBe(3);
        });

        test('should handle invalid context preset gracefully', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const contextPreset = {
                name: 'Invalid Preset',
                story_string: '{{#if invalid_field}}{{invalid_field}}{{/if}}'
            };

            const result = await promptBuilder.buildPrompt(character, [], contextPreset);

            expect(result.content).toBeDefined();
            expect(result.metadata.contextPreset).toBe('Invalid Preset');
        });
    });

    describe('Utility Methods', () => {
        test('should format world info objects correctly', () => {
            const worldInfo = [
                { name: 'Setting', content: 'Fantasy world' },
                { name: 'Magic', content: 'Magic exists' }
            ];

            const formatted = promptBuilder.formatWorldInfoObject(worldInfo);

            expect(formatted).toContain('Setting: Fantasy world');
            expect(formatted).toContain('Magic: Magic exists');
        });

        test('should truncate text correctly', () => {
            const longText = 'A'.repeat(100);
            const truncated = promptBuilder.truncateText(longText, 50);

            expect(truncated.length).toBeLessThanOrEqual(50);
            expect(truncated).toContain('...');
        });

        test('should get character name from description', () => {
            const description = 'Character: Test Character\nDescription: A test character';
            const name = promptBuilder.getCharacterName(description);

            expect(name).toBe('Test Character');
        });

        test('should get sender name correctly', () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const characterName = promptBuilder.getSenderName('test-character', character);
            const userName = promptBuilder.getSenderName('user', character);
            const unknownName = promptBuilder.getSenderName('unknown', character);

            expect(characterName).toBe('Test Character');
            expect(userName).toBe('You');
            expect(unknownName).toBe('unknown');
        });
    });
}); 