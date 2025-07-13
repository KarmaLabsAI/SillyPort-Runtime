/**
 * OpenAIConverter Test Suite
 * 
 * Tests for Task 4.2.1: OpenAI Format Support
 * 
 * Tests ChatML format conversion, message role mapping, system message handling,
 * token optimization, and format validation.
 */

const OpenAIConverter = require('../../src/prompt/OpenAIConverter.js');
const EventBus = require('../../src/core/EventBus.js');

describe('OpenAIConverter - Task 4.2.1: OpenAI Format Support', () => {
    let eventBus, converter;

    beforeEach(() => {
        eventBus = new EventBus();
        converter = new OpenAIConverter(eventBus);
    });

    describe('ChatML Format Conversion', () => {
        test('should convert simple string prompt to ChatML format', () => {
            const prompt = 'Hello, how are you?';
            const instructPreset = {
                input_sequence: '<|im_start|>user',
                output_sequence: '<|im_start|>assistant',
                system_sequence: '<|im_start|>system',
                input_suffix: '<|im_end|>\n',
                output_suffix: '<|im_end|>\n',
                system_suffix: '<|im_end|>\n',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.format).toBe('openai');
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].content).toContain('<|im_start|>user');
            expect(result.messages[0].content).toContain('<|im_end|>');
        });

        test('should convert prompt with system message to ChatML format', () => {
            const prompt = {
                system: 'You are a helpful assistant.',
                user: 'Hello, how are you?'
            };
            const instructPreset = {
                input_sequence: '<|im_start|>user',
                output_sequence: '<|im_start|>assistant',
                system_sequence: '<|im_start|>system',
                input_suffix: '<|im_end|>\n',
                output_suffix: '<|im_end|>\n',
                system_suffix: '<|im_end|>\n',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('<|im_start|>system');
            expect(result.messages[1].role).toBe('user');
            expect(result.messages[1].content).toContain('<|im_start|>user');
        });

        test('should handle ChatML format with custom sequences', () => {
            const prompt = 'Test message';
            const instructPreset = {
                input_sequence: '[INST] ',
                output_sequence: '',
                system_sequence: '',
                input_suffix: ' [/INST]',
                output_suffix: '',
                system_suffix: '',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.messages[0].content).toContain('[INST] ');
            expect(result.messages[0].content).toContain(' [/INST]');
        });

        test('should convert to ChatML string format', () => {
            const messages = [
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'Hello' }
            ];
            const config = {
                system_sequence: '<|im_start|>system',
                input_sequence: '<|im_start|>user',
                system_suffix: '<|im_end|>\n',
                input_suffix: '<|im_end|>\n'
            };

            const chatml = converter.toChatMLString(messages, config);

            expect(chatml).toContain('<|im_start|>system');
            expect(chatml).toContain('<|im_start|>user');
            expect(chatml).toContain('<|im_end|>');
        });
    });

    describe('Message Role Mapping', () => {
        test('should normalize user roles correctly', () => {
            expect(converter.normalizeRole('user')).toBe('user');
            expect(converter.normalizeRole('human')).toBe('user');
            expect(converter.normalizeRole('Human')).toBe('user');
            expect(converter.normalizeRole('USER')).toBe('user');
        });

        test('should normalize assistant roles correctly', () => {
            expect(converter.normalizeRole('assistant')).toBe('assistant');
            expect(converter.normalizeRole('character')).toBe('assistant');
            expect(converter.normalizeRole('ai')).toBe('assistant');
            expect(converter.normalizeRole('Assistant')).toBe('assistant');
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
            expect(result.messages[1].role).toBe('assistant');
        });
    });

    describe('System Message Handling', () => {
        test('should format system message with ChatML sequences', () => {
            const content = 'You are a helpful assistant.';
            const config = {
                system_sequence: '<|im_start|>system',
                system_suffix: '<|im_end|>\n',
                wrap: true
            };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toContain('<|im_start|>system');
            expect(formatted).toContain('<|im_end|>');
            expect(formatted).toContain(content);
        });

        test('should handle system message with prefix and suffix', () => {
            const content = 'System instruction';
            const config = {
                system_sequence: '<|im_start|>system',
                system_sequence_prefix: 'PREFIX: ',
                system_sequence_suffix: ' :SUFFIX',
                system_suffix: '<|im_end|>\n'
            };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toContain('PREFIX: ');
            expect(formatted).toContain(' :SUFFIX');
            expect(formatted).toContain(content);
        });

        test('should handle empty system message', () => {
            const content = '';
            const config = { system_sequence: '<|im_start|>system' };

            const formatted = converter.formatSystemMessage(content, config);

            expect(formatted).toBe('');
        });

        test('should parse string prompt with system markers', () => {
            const prompt = '### System: You are helpful\n### User: Hello';
            const result = converter.convert(prompt);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[1].role).toBe('user');
        });
    });

    describe('Token Optimization', () => {
        test('should optimize tokens when exceeding limit', () => {
            const longPrompt = 'A'.repeat(10000); // Very long prompt
            const options = { maxTokens: 1000, optimizeTokens: true };

            const result = converter.convert(longPrompt, null, options);

            const estimatedTokens = converter.estimateTokens(result.messages);
            expect(estimatedTokens).toBeLessThanOrEqual(1000);
        });

        test('should preserve system message priority during optimization', () => {
            const prompt = {
                system: 'Important system instruction',
                user: 'A'.repeat(5000), // Long user message
                assistant: 'A'.repeat(5000) // Long assistant message
            };
            const options = { maxTokens: 1000, optimizeTokens: true };

            const result = converter.convert(prompt, null, options);

            // System message should be preserved
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('Important system instruction');
        });

        test('should truncate messages to fit token limit', () => {
            const longContent = 'A'.repeat(2000);
            const maxChars = 100;
            const suffix = '...';

            const truncated = converter.truncateText(longContent, maxChars, suffix);

            expect(truncated.length).toBeLessThanOrEqual(maxChars);
            expect(truncated).toContain(suffix);
        });

        test('should estimate tokens correctly', () => {
            const content = 'Hello world';
            const estimated = converter.estimateTokens(content);

            expect(estimated).toBeGreaterThan(0);
            expect(typeof estimated).toBe('number');
        });

        test('should estimate tokens for message arrays', () => {
            const messages = [
                { role: 'system', content: 'System message' },
                { role: 'user', content: 'User message' }
            ];

            const estimated = converter.estimateTokens(messages);

            expect(estimated).toBeGreaterThan(0);
            expect(typeof estimated).toBe('number');
        });
    });

    describe('Format Validation', () => {
        test('should validate input prompt', () => {
            const validConfig = {
                input_sequence: '<|im_start|>user',
                output_sequence: '<|im_start|>assistant',
                system_sequence: '<|im_start|>system'
            };
            expect(() => converter.validateInput('Valid prompt', validConfig)).not.toThrow();
            expect(() => converter.validateInput({ content: 'Valid' }, validConfig)).not.toThrow();
        });

        test('should reject invalid input types', () => {
            expect(() => converter.validateInput(null, {})).toThrow();
            expect(() => converter.validateInput(undefined, {})).toThrow();
            expect(() => converter.validateInput(123, {})).toThrow();
        });

        test('should validate instruction preset configuration', () => {
            const validConfig = {
                input_sequence: '<|im_start|>user',
                output_sequence: '<|im_start|>assistant',
                system_sequence: '<|im_start|>system'
            };

            expect(() => converter.validateInput('test', validConfig)).not.toThrow();
        });

        test('should reject invalid instruction preset', () => {
            expect(() => converter.validateInput('test', null)).toThrow();
            expect(() => converter.validateInput('test', {})).toThrow();
        });

        test('should validate output format', () => {
            const validMessages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi' }
            ];

            expect(() => converter.validateOutput(validMessages, {})).not.toThrow();
        });

        test('should reject invalid message format', () => {
            expect(() => converter.validateOutput([], {})).toThrow();
            expect(() => converter.validateOutput([{ role: 'user' }], {})).toThrow();
            expect(() => converter.validateOutput([{ content: 'test' }], {})).toThrow();
        });

        test('should reject invalid roles', () => {
            const invalidMessages = [
                { role: 'invalid', content: 'test' }
            ];

            expect(() => converter.validateOutput(invalidMessages, {})).toThrow();
        });
    });

    describe('String Prompt Parsing', () => {
        test('should parse simple string prompt', () => {
            const prompt = 'Hello world';
            const components = converter.parseStringPrompt(prompt);

            expect(components.user).toBe('Hello world');
            expect(components.system).toBe('');
            expect(components.assistant).toBe('');
        });

        test('should parse string with system markers', () => {
            const prompt = '### System: System message\n### User: User message';
            const components = converter.parseStringPrompt(prompt);

            expect(components.system).toBe('System message');
            expect(components.user).toBe('User message');
        });

        test('should parse string with ChatML markers', () => {
            const prompt = '<|im_start|>system System message<|im_end|>\n<|im_start|>user User message<|im_end|>';
            const components = converter.parseStringPrompt(prompt);

            expect(components.system).toBe('System message');
            expect(components.user).toBe('User message');
        });

        test('should handle multi-line content', () => {
            const prompt = '### User: Line 1\nLine 2\nLine 3';
            const components = converter.parseStringPrompt(prompt);

            expect(components.user).toBe('Line 1\nLine 2\nLine 3');
        });
    });

    describe('Object Prompt Parsing', () => {
        test('should parse messages array format', () => {
            const prompt = {
                messages: [
                    { role: 'system', content: 'System' },
                    { role: 'user', content: 'User' }
                ]
            };

            const components = converter.parseObjectPrompt(prompt);

            expect(components.system).toBe('System');
            expect(components.user).toBe('User');
        });

        test('should parse direct component format', () => {
            const prompt = {
                system: 'System message',
                user: 'User message',
                assistant: 'Assistant message'
            };

            const components = converter.parseObjectPrompt(prompt);

            expect(components.system).toBe('System message');
            expect(components.user).toBe('User message');
            expect(components.assistant).toBe('Assistant message');
        });

        test('should parse simple content format', () => {
            const prompt = { content: 'Simple message' };

            const components = converter.parseObjectPrompt(prompt);

            expect(components.user).toBe('Simple message');
        });

        test('should reject unrecognized object format', () => {
            const prompt = { unknown: 'field' };

            expect(() => converter.parseObjectPrompt(prompt)).toThrow();
        });
    });

    describe('Event Emission', () => {
        test('should emit conversion event on successful conversion', () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:converted', eventSpy);

            converter.convert('Test prompt');

            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                format: 'openai',
                originalLength: expect.any(Number),
                convertedLength: expect.any(Number),
                estimatedTokens: expect.any(Number)
            }));
        });

        test('should emit error event on conversion failure', () => {
            const eventSpy = jest.fn();
            eventBus.subscribe('prompt:conversion_error', eventSpy);

            expect(() => converter.convert(null)).toThrow();

            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                format: 'openai',
                error: expect.any(String)
            }));
        });
    });

    describe('Conversion Statistics', () => {
        test('should calculate conversion statistics', () => {
            const originalPrompt = 'Hello world';
            const convertedPrompt = {
                messages: [{ role: 'user', content: '<|im_start|>user Hello world<|im_end|>\n' }]
            };

            const stats = converter.getConversionStats(originalPrompt, convertedPrompt);

            expect(stats).toHaveProperty('originalLength');
            expect(stats).toHaveProperty('convertedLength');
            expect(stats).toHaveProperty('estimatedTokens');
            expect(stats).toHaveProperty('compressionRatio');
            expect(stats).toHaveProperty('tokenEfficiency');
        });

        test('should handle zero-length original prompt', () => {
            const originalPrompt = '';
            const convertedPrompt = {
                messages: [{ role: 'user', content: 'test' }]
            };

            const stats = converter.getConversionStats(originalPrompt, convertedPrompt);

            expect(stats.compressionRatio).toBe(1);
        });
    });

    describe('Integration Tests', () => {
        test('should convert complex prompt with all components', () => {
            const prompt = {
                system: 'You are a helpful AI assistant.',
                user: 'Please help me with a question.',
                assistant: 'I would be happy to help!'
            };

            const instructPreset = {
                input_sequence: '<|im_start|>user',
                output_sequence: '<|im_start|>assistant',
                system_sequence: '<|im_start|>system',
                input_suffix: '<|im_end|>\n',
                output_suffix: '<|im_end|>\n',
                system_suffix: '<|im_end|>\n',
                wrap: true
            };

            const result = converter.convert(prompt, instructPreset);

            expect(result.format).toBe('openai');
            expect(result.messages).toHaveLength(3);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[1].role).toBe('user');
            expect(result.messages[2].role).toBe('assistant');
            expect(result.metadata).toHaveProperty('conversionTimestamp');
            expect(result.metadata).toHaveProperty('estimatedTokens');
        });

        test('should handle different instruction presets', () => {
            const prompt = 'Test message';
            const llamaPreset = {
                input_sequence: '[INST] ',
                output_sequence: '',
                system_sequence: '',
                input_suffix: ' [/INST]',
                output_suffix: '',
                system_suffix: '',
                wrap: true
            };

            const result = converter.convert(prompt, llamaPreset);

            expect(result.messages[0].content).toContain('[INST] ');
            expect(result.messages[0].content).toContain(' [/INST]');
        });
    });
}); 