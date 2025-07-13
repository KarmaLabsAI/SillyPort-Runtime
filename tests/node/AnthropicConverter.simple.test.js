/**
 * AnthropicConverter Tests - Task 4.2.2: Anthropic Format Support
 * 
 * Tests for Claude format conversion, message structure mapping, system prompt handling,
 * context optimization, and format validation.
 */

const AnthropicConverter = require('../../src/prompt/AnthropicConverter');
const EventBus = require('../../src/core/EventBus');

describe('AnthropicConverter', () => {
    let converter;
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
        converter = new AnthropicConverter(eventBus);
    });

    describe('Task 4.2.2: Anthropic Format Support', () => {
        describe('Claude format conversion', () => {
            test('should convert simple string prompt to Claude format', () => {
                const prompt = 'Hello, how are you?';
                const result = converter.convert(prompt);
                
                expect(result.format).toBe('anthropic');
                expect(result.messages).toHaveLength(1);
                expect(result.messages[0].role).toBe('user');
                expect(result.messages[0].content).toContain('Human: Hello, how are you?');
            });

            test('should convert object prompt to Claude format', () => {
                const prompt = {
                    user: 'Hello, how are you?',
                    assistant: 'I am doing well, thank you!'
                };
                const result = converter.convert(prompt);
                
                expect(result.format).toBe('anthropic');
                expect(result.messages).toHaveLength(2);
                expect(result.messages[0].role).toBe('user');
                expect(result.messages[0].content).toContain('Human: Hello, how are you?');
                expect(result.messages[1].role).toBe('assistant');
                expect(result.messages[1].content).toContain('Assistant: I am doing well, thank you!');
            });

            test('should convert array of messages to Claude format', () => {
                const prompt = [
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Hi there!' },
                    { role: 'user', content: 'How are you?' }
                ];
                const result = converter.convert(prompt);
                
                expect(result.format).toBe('anthropic');
                expect(result.messages).toHaveLength(3);
                expect(result.messages[0].role).toBe('user');
                expect(result.messages[1].role).toBe('assistant');
                expect(result.messages[2].role).toBe('user');
            });

            test('should handle custom Claude preset configuration', () => {
                const prompt = 'Hello';
                const customPreset = {
                    input_sequence: '\n\nUser: ',
                    output_sequence: '\n\nClaude: ',
                    wrap: true
                };
                const result = converter.convert(prompt, customPreset);
                
                expect(result.messages[0].content).toContain('User: Hello');
                expect(result.config.input_sequence).toBe('\n\nUser: ');
                expect(result.config.output_sequence).toBe('\n\nClaude: ');
            });
        });

        describe('Message structure mapping', () => {
            test('should map user role correctly', () => {
                const prompt = { user: 'Hello' };
                const result = converter.convert(prompt);
                
                expect(result.messages[0].role).toBe('user');
                expect(result.messages[0].content).toContain('Human: Hello');
            });

            test('should map assistant role correctly', () => {
                const prompt = { assistant: 'Hello' };
                const result = converter.convert(prompt);
                
                expect(result.messages[0].role).toBe('assistant');
                expect(result.messages[0].content).toContain('Assistant: Hello');
            });

            test('should map system role correctly', () => {
                const prompt = { system: 'You are a helpful assistant' };
                const result = converter.convert(prompt);
                
                expect(result.messages[0].role).toBe('system');
                expect(result.messages[0].content).toBe('You are a helpful assistant');
            });

            test('should normalize various role names', () => {
                const prompts = [
                    { human: 'Hello' },
                    { character: 'Hello' },
                    { ai: 'Hello' }
                ];

                prompts.forEach(prompt => {
                    const result = converter.convert(prompt);
                    expect(result.messages[0].role).toBeDefined();
                    expect(['user', 'assistant']).toContain(result.messages[0].role);
                });
            });

            test('should handle messages array format', () => {
                const prompt = {
                    messages: [
                        { role: 'system', content: 'You are helpful' },
                        { role: 'user', content: 'Hello' },
                        { role: 'assistant', content: 'Hi!' }
                    ]
                };
                const result = converter.convert(prompt);
                
                expect(result.messages).toHaveLength(3);
                expect(result.messages[0].role).toBe('system');
                expect(result.messages[1].role).toBe('user');
                expect(result.messages[2].role).toBe('assistant');
            });
        });

        describe('System prompt handling', () => {
            test('should include system message in Claude format', () => {
                const prompt = {
                    system: 'You are a helpful AI assistant.',
                    user: 'Hello'
                };
                const result = converter.convert(prompt);
                
                expect(result.messages).toHaveLength(2);
                expect(result.messages[0].role).toBe('system');
                expect(result.messages[0].content).toBe('You are a helpful AI assistant.');
                expect(result.messages[1].role).toBe('user');
            });

            test('should handle system message with custom sequence', () => {
                const prompt = { system: 'You are helpful' };
                const customPreset = {
                    system_sequence: 'System: ',
                    system_suffix: ' End'
                };
                const result = converter.convert(prompt, customPreset);
                
                expect(result.messages[0].content).toBe('System: You are helpful End');
            });

            test('should handle empty system message', () => {
                const prompt = { system: '', user: 'Hello' };
                const result = converter.convert(prompt);
                
                expect(result.messages).toHaveLength(1);
                expect(result.messages[0].role).toBe('user');
            });

            test('should parse system message from string prompt', () => {
                const prompt = 'System: You are helpful\n\nHuman: Hello';
                const result = converter.convert(prompt);
                
                expect(result.messages).toHaveLength(2);
                expect(result.messages[0].role).toBe('system');
                expect(result.messages[0].content).toBe('You are helpful');
                expect(result.messages[1].role).toBe('user');
            });
        });

        describe('Context optimization', () => {
            test('should optimize tokens when exceeding limit', () => {
                const longContent = 'x'.repeat(50000); // ~12.5k tokens
                const prompt = { user: longContent };
                const result = converter.convert(prompt, null, { maxTokens: 1000 });
                
                expect(result.messages[0].content.length).toBeLessThan(longContent.length);
                expect(converter.estimateTokens(result.messages)).toBeLessThan(1000);
            });

            test('should prioritize system messages over user messages', () => {
                const systemContent = 'System: ' + 'x'.repeat(1000);
                const userContent = 'User: ' + 'x'.repeat(1000);
                const prompt = { system: systemContent, user: userContent };
                const result = converter.convert(prompt, null, { maxTokens: 500 });
                
                // System message should be preserved more than user message
                const systemLength = result.messages[0].content.length;
                const userLength = result.messages[1].content.length;
                expect(systemLength).toBeGreaterThan(userLength);
            });

            test('should prioritize user messages over assistant messages', () => {
                const userContent = 'User: ' + 'x'.repeat(1000);
                const assistantContent = 'Assistant: ' + 'x'.repeat(1000);
                const prompt = { user: userContent, assistant: assistantContent };
                const result = converter.convert(prompt, null, { maxTokens: 500 });
                
                // User message should be preserved more than assistant message
                const userLength = result.messages[0].content.length;
                const assistantLength = result.messages[1].content.length;
                expect(userLength).toBeGreaterThan(assistantLength);
            });

            test('should not optimize when under token limit', () => {
                const prompt = { user: 'Hello' };
                const result = converter.convert(prompt, null, { maxTokens: 1000 });
                
                expect(result.messages[0].content).toContain('Hello');
                expect(converter.estimateTokens(result.messages)).toBeLessThan(1000);
            });

            test('should handle token estimation correctly', () => {
                const content = 'Hello world';
                const tokens = converter.estimateTokens(content);
                
                expect(tokens).toBeGreaterThan(0);
                expect(tokens).toBeLessThanOrEqual(Math.ceil(content.length / 4) + 1);
            });
        });

        describe('Format validation', () => {
            test('should validate input prompt', () => {
                expect(() => converter.convert(null)).toThrow('Prompt cannot be empty');
                expect(() => converter.convert(undefined)).toThrow('Prompt cannot be empty');
                expect(() => converter.convert(123)).toThrow('Prompt must be a string or object');
            });

            test('should validate output format', () => {
                const validMessages = [
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Hi' }
                ];
                
                expect(() => converter.validateOutput(validMessages)).not.toThrow();
            });

            test('should reject invalid message roles', () => {
                const invalidMessages = [
                    { role: 'invalid', content: 'Hello' }
                ];
                
                expect(() => converter.validateOutput(invalidMessages)).toThrow('invalid role');
            });

            test('should reject messages without content', () => {
                const invalidMessages = [
                    { role: 'user' }
                ];
                
                expect(() => converter.validateOutput(invalidMessages)).toThrow('missing content');
            });

            test('should reject empty message array', () => {
                expect(() => converter.validateOutput([])).toThrow('Output cannot be empty');
            });

            test('should validate configuration object', () => {
                const prompt = 'Hello';
                expect(() => converter.convert(prompt, 'invalid')).toThrow('Configuration must be an object');
            });
        });

        describe('Event emission', () => {
            test('should emit conversion event on success', () => {
                const eventSpy = jest.fn();
                eventBus.subscribe('prompt:converted', eventSpy);
                
                const prompt = 'Hello';
                converter.convert(prompt);
                
                expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                    format: 'anthropic',
                    originalLength: expect.any(Number),
                    convertedLength: expect.any(Number),
                    estimatedTokens: expect.any(Number)
                }));
            });

            test('should emit error event on failure', () => {
                const eventSpy = jest.fn();
                eventBus.subscribe('prompt:conversion_error', eventSpy);
                
                expect(() => converter.convert(null)).toThrow();
                
                expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                    format: 'anthropic',
                    error: expect.any(String)
                }));
            });
        });

        describe('Utility methods', () => {
            test('should convert to Claude string format', () => {
                const messages = [
                    { role: 'system', content: 'You are helpful' },
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Hi!' }
                ];
                const result = converter.toClaudeString(messages);
                
                expect(result).toContain('You are helpful');
                expect(result).toContain('Human: Hello');
                expect(result).toContain('Assistant: Hi!');
            });

            test('should get conversion statistics', () => {
                const originalPrompt = 'Hello';
                const convertedPrompt = { messages: [{ role: 'user', content: 'Human: Hello' }] };
                const stats = converter.getConversionStats(originalPrompt, convertedPrompt);
                
                expect(stats).toHaveProperty('originalLength');
                expect(stats).toHaveProperty('convertedLength');
                expect(stats).toHaveProperty('estimatedTokens');
                expect(stats).toHaveProperty('compressionRatio');
                expect(stats.format).toBe('anthropic');
            });

            test('should truncate text correctly', () => {
                const text = 'Hello world';
                const truncated = converter.truncateText(text, 5);
                
                expect(truncated).toBe('He...');
                expect(truncated.length).toBe(5);
            });

            test('should handle debug mode', () => {
                converter.setDebugMode(true);
                expect(converter.debugMode).toBe(true);
                
                converter.setDebugMode(false);
                expect(converter.debugMode).toBe(false);
            });
        });

        describe('Integration with Claude preset', () => {
            test('should work with Claude preset configuration', () => {
                const claudePreset = {
                    input_sequence: "\n\nHuman: ",
                    output_sequence: "\n\nAssistant: ",
                    stop_sequence: "\n\nHuman:",
                    wrap: true
                };
                
                const prompt = { user: 'Hello', assistant: 'Hi there!' };
                const result = converter.convert(prompt, claudePreset);
                
                expect(result.messages[0].content).toContain('Human: Hello');
                expect(result.messages[1].content).toContain('Assistant: Hi there!');
                expect(result.config.stop_sequence).toBe('\n\nHuman:');
            });

            test('should handle Claude preset with custom sequences', () => {
                const customPreset = {
                    input_sequence: "\n\nUser: ",
                    output_sequence: "\n\nClaude: ",
                    system_sequence: "\n\nSystem: ",
                    wrap: true
                };
                
                const prompt = {
                    system: 'You are helpful',
                    user: 'Hello',
                    assistant: 'Hi!'
                };
                const result = converter.convert(prompt, customPreset);
                
                expect(result.messages[0].content).toContain('System: You are helpful');
                expect(result.messages[1].content).toContain('User: Hello');
                expect(result.messages[2].content).toContain('Claude: Hi!');
            });
        });
    });
}); 