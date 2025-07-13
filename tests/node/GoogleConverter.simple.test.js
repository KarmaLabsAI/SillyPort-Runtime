/**
 * GoogleConverter Test Suite
 * 
 * Tests for Task 4.2.3: Google Format Support
 * 
 * Tests Gemini/PaLM format conversion, message structure mapping, context handling,
 * format validation, and model-specific optimization.
 */

const GoogleConverter = require('../../src/prompt/GoogleConverter.js');
const EventBus = require('../../src/core/EventBus.js');

describe('GoogleConverter - Task 4.2.3: Google Format Support', () => {
    let eventBus, converter;

    beforeEach(() => {
        eventBus = new EventBus();
        converter = new GoogleConverter(eventBus);
    });

    describe('Gemini Format Conversion', () => {
        test('should convert simple string prompt to Gemini format', () => {
            const prompt = 'Hello, how are you?';
            const instructPreset = {
                input_sequence: 'user',
                output_sequence: 'model',
                system_sequence: 'system',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.format).toBe('google');
            expect(result.model).toBe('gemini-pro');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].content).toContain('user: ');
        });

        test('should convert prompt with system message to Gemini format', () => {
            const prompt = {
                system: 'You are a helpful assistant.',
                user: 'Hello, how are you?'
            };
            const instructPreset = {
                input_sequence: 'user',
                output_sequence: 'model',
                system_sequence: 'system',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('system: ');
            expect(result.messages[1].role).toBe('user');
            expect(result.messages[1].content).toContain('user: ');
        });

        test('should handle Gemini format with custom sequences', () => {
            const prompt = 'Test message';
            const instructPreset = {
                input_sequence: 'Human',
                output_sequence: 'Assistant',
                system_sequence: 'System',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.messages[0].content).toContain('Human: ');
        });

        test('should convert to Gemini string format', () => {
            const messages = [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'Hello' }
            ];
            const config = {
                system_sequence: 'system',
                input_sequence: 'user',
                wrap: true
            };

            const geminiString = converter.toGoogleString(messages, config);

            expect(geminiString).toContain('system: ');
            expect(geminiString).toContain('user: ');
        });
    });

    describe('Message Structure Mapping', () => {
        test('should normalize user roles correctly', () => {
            expect(converter.normalizeRole('user')).toBe('user');
            expect(converter.normalizeRole('human')).toBe('user');
            expect(converter.normalizeRole('Human')).toBe('user');
            expect(converter.normalizeRole('USER')).toBe('user');
        });

        test('should normalize assistant roles to model', () => {
            expect(converter.normalizeRole('assistant')).toBe('model');
            expect(converter.normalizeRole('character')).toBe('model');
            expect(converter.normalizeRole('ai')).toBe('model');
            expect(converter.normalizeRole('Assistant')).toBe('model');
        });

        test('should normalize system roles correctly', () => {
            expect(converter.normalizeRole('system')).toBe('system');
            expect(converter.normalizeRole('System')).toBe('system');
        });

        test('should handle unknown roles', () => {
            expect(converter.normalizeRole('unknown')).toBe('user');
            expect(converter.normalizeRole('')).toBe('user');
            expect(converter.normalizeRole(null)).toBe('user');
        });

        test('should parse object prompt with role mapping', () => {
            const prompt = {
                messages: [
                    { role: 'human', content: 'Hello' },
                    { role: 'character', content: 'Hi there!' }
                ]
            };

            const result = converter.convert(prompt);

            expect(result.messages[0].role).toBe('user');
            expect(result.messages[1].role).toBe('model');
        });
    });

    describe('System Message Handling', () => {
        test('should format system message with Gemini sequences', () => {
            const content = 'You are a helpful assistant.';
            const config = {
                system_sequence: 'system',
                wrap: true
            };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toContain('system: ');
            expect(formatted).toContain(content);
        });

        test('should handle system message with prefix and suffix', () => {
            const content = 'System instruction';
            const config = {
                system_sequence: 'system',
                system_sequence_prefix: 'PREFIX: ',
                system_sequence_suffix: ' :SUFFIX',
                wrap: true
            };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toContain('PREFIX: ');
            expect(formatted).toContain(' :SUFFIX');
            expect(formatted).toContain(content);
        });

        test('should handle empty system message', () => {
            const content = '';
            const config = { system_sequence: 'system' };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toBe('');
        });

        test('should parse string prompt with system markers', () => {
            const prompt = 'system: You are helpful\nuser: Hello';
            const result = converter.convert(prompt);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[1].role).toBe('user');
        });
    });

    describe('Model-Specific Optimization', () => {
        test('should handle Gemini Pro with system prompts', () => {
            const prompt = {
                system: 'You are helpful',
                user: 'Hello'
            };
            const options = { model: 'gemini-pro' };

            const result = converter.convert(prompt, null, options);

            expect(result.model).toBe('gemini-pro');
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[1].role).toBe('user');
        });

        test('should handle PaLM-2 without system prompts', () => {
            const prompt = {
                system: 'You are helpful',
                user: 'Hello'
            };
            const options = { model: 'palm-2' };

            const result = converter.convert(prompt, null, options);

            expect(result.model).toBe('palm-2');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].content).toContain('system: ');
            expect(result.messages[0].content).toContain('user: ');
        });

        test('should handle Gemini Pro Vision with image support', () => {
            const prompt = {
                user: 'Describe this image'
            };
            const options = { model: 'gemini-pro-vision' };

            const result = converter.convert(prompt, null, options);

            expect(result.model).toBe('gemini-pro-vision');
            expect(result.metadata.modelCapabilities.supportsImages).toBe(true);
        });

        test('should optimize tokens for different models', () => {
            const longPrompt = 'A'.repeat(10000); // Very long prompt
            const options = { maxTokens: 1000, optimizeTokens: true, model: 'gemini-pro' };

            const result = converter.convert(longPrompt, null, options);

            expect(result.messages[0].content.length).toBeLessThan(5000);
        });
    });

    describe('Context Handling', () => {
        test('should handle multi-turn conversations', () => {
            const prompt = {
                messages: [
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Hi there!' },
                    { role: 'user', content: 'How are you?' }
                ]
            };

            const result = converter.convert(prompt);

            expect(result.messages).toHaveLength(3);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[1].role).toBe('model');
            expect(result.messages[2].role).toBe('user');
        });

        test('should handle context window optimization', () => {
            const messages = [];
            for (let i = 0; i < 10; i++) {
                messages.push({ role: 'user', content: 'Message ' + i + ' ' + 'A'.repeat(1000) });
                messages.push({ role: 'assistant', content: 'Response ' + i + ' ' + 'B'.repeat(1000) });
            }

            const prompt = { messages };
            const options = { maxTokens: 5000, optimizeTokens: true };

            const result = converter.convert(prompt, null, options);

            // Should have fewer messages due to optimization
            expect(result.messages.length).toBeLessThan(20);
        });

        test('should preserve system message in optimization', () => {
            const messages = [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'A'.repeat(10000) }
            ];

            const prompt = { messages };
            const options = { maxTokens: 1000, optimizeTokens: true };

            const result = converter.convert(prompt, null, options);

            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('You are helpful');
        });
    });

    describe('Format Validation', () => {
        test('should validate input prompt', () => {
            expect(() => converter.convert(null)).toThrow('Prompt cannot be null or undefined');
            expect(() => converter.convert('')).toThrow('String prompt cannot be empty');
            expect(() => converter.convert({})).toThrow('Object prompt must contain at least one content field');
        });

        test('should validate message structure', () => {
            const invalidPrompt = {
                messages: [
                    { role: 'invalid', content: 'test' }
                ]
            };

            expect(() => converter.convert(invalidPrompt)).toThrow('Invalid role: invalid');
        });

        test('should validate message order', () => {
            const invalidPrompt = {
                messages: [
                    { role: 'user', content: 'Hello' },
                    { role: 'user', content: 'Hello again' }
                ]
            };

            expect(() => converter.convert(invalidPrompt)).toThrow('Cannot have consecutive user messages');
        });

        test('should validate system message support', () => {
            const prompt = {
                system: 'You are helpful',
                user: 'Hello'
            };
            const options = { model: 'palm-2' };

            // Should not throw for PaLM-2, but should handle system message differently
            const result = converter.convert(prompt, null, options);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
        });
    });

    describe('Token Optimization', () => {
        test('should optimize tokens when exceeding limit', () => {
            const longPrompt = 'A'.repeat(10000); // Very long prompt
            const options = { maxTokens: 1000, optimizeTokens: true };

            const result = converter.convert(longPrompt, null, options);

            const estimatedTokens = converter.estimateTokens(result.messages[0].content);
            expect(estimatedTokens).toBeLessThan(1000);
        });

        test('should estimate tokens correctly', () => {
            const content = 'Hello world';
            const tokens = converter.estimateTokens(content);

            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThanOrEqual(Math.ceil(content.length / 4));
        });

        test('should truncate text properly', () => {
            const text = 'This is a long text that needs to be truncated';
            const truncated = converter.truncateText(text, 10);

            expect(truncated.length).toBeLessThanOrEqual(13); // 10 + 3 for suffix
            expect(truncated).toContain('...');
        });
    });

    describe('Model Configuration', () => {
        test('should get supported models', () => {
            const models = converter.getSupportedModels();

            expect(models).toContain('gemini-pro');
            expect(models).toContain('gemini-pro-vision');
            expect(models).toContain('palm-2');
        });

        test('should get model configuration', () => {
            const config = converter.getModelConfig('gemini-pro');

            expect(config).toBeDefined();
            expect(config.maxTokens).toBe(32768);
            expect(config.supportsSystemPrompts).toBe(true);
        });

        test('should return null for unsupported model', () => {
            const config = converter.getModelConfig('unsupported-model');

            expect(config).toBeNull();
        });
    });

    describe('Conversion Statistics', () => {
        test('should provide conversion statistics', () => {
            const originalPrompt = 'Hello world';
            const result = converter.convert(originalPrompt);
            const stats = converter.getConversionStats(originalPrompt, result);

            expect(stats.originalLength).toBe(11);
            expect(stats.convertedLength).toBeGreaterThan(0);
            expect(stats.format).toBe('google');
            expect(stats.model).toBe('gemini-pro');
        });

        test('should calculate compression ratio', () => {
            const originalPrompt = 'A'.repeat(1000);
            const result = converter.convert(originalPrompt);
            const stats = converter.getConversionStats(originalPrompt, result);

            expect(stats.compressionRatio).toBeGreaterThan(0);
            expect(stats.tokenRatio).toBeGreaterThan(0);
        });
    });

    describe('Event Emission', () => {
        test('should emit conversion event', () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:converted', eventSpy);

            converter.convert('Hello');

            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                format: 'google',
                model: 'gemini-pro'
            }));
        });

        test('should emit error event on failure', () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:conversion_error', eventSpy);

            expect(() => converter.convert('')).toThrow();

            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                format: 'google',
                error: expect.any(String)
            }));
        });
    });

    describe('Debug Mode', () => {
        test('should enable debug mode', () => {
            converter.setDebugMode(true);
            expect(converter.debugMode).toBe(true);
        });

        test('should disable debug mode', () => {
            converter.setDebugMode(false);
            expect(converter.debugMode).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty messages array', () => {
            const prompt = { messages: [] };

            expect(() => converter.convert(prompt)).toThrow('Output must contain at least one message');
        });

        test('should handle messages without content', () => {
            const prompt = {
                messages: [
                    { role: 'user', content: '' }
                ]
            };

            const result = converter.convert(prompt);
            expect(result.messages[0].content).toBe('');
        });

        test('should handle very long individual messages', () => {
            const longContent = 'A'.repeat(50000);
            const prompt = { user: longContent };
            const options = { maxTokens: 1000, optimizeTokens: true };

            const result = converter.convert(prompt, null, options);

            expect(result.messages[0].content.length).toBeLessThan(5000);
        });

        test('should handle mixed content types', () => {
            const prompt = {
                system: 123, // Number
                user: true,  // Boolean
                assistant: null // Null
            };

            const result = converter.convert(prompt);

            expect(result.messages[0].content).toBe('system: 123');
            expect(result.messages[1].content).toBe('user: true');
            expect(result.messages[2].content).toBe('model: ');
        });
    });
}); 