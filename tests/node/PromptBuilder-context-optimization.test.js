/**
 * PromptBuilder Context Optimization Tests - Task 4.1.3
 * 
 * Tests for token counting, message truncation, content prioritization,
 * compression techniques, and context caching.
 */

const PromptBuilder = require('../../src/prompt/PromptBuilder');
const EventBus = require('../../src/core/EventBus');
const ConfigManager = require('../../src/core/ConfigManager');

describe('PromptBuilder - Task 4.1.3: Context Optimization', () => {
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
        promptBuilder.clearContextCache();
    });

    describe('Token Counting', () => {
        test('should count tokens using character method', () => {
            const text = 'Hello world, this is a test message.';
            const tokens = promptBuilder.countTokens(text, 'character');
            
            // Character method: 1 token ≈ 4 characters
            const expectedTokens = Math.ceil(text.length / 4);
            expect(tokens).toBe(expectedTokens);
        });

        test('should count tokens using word method', () => {
            const text = 'Hello world, this is a test message.';
            const tokens = promptBuilder.countTokens(text, 'word');
            
            // Word method: count words
            const expectedTokens = text.trim().split(/\s+/).length;
            expect(tokens).toBe(expectedTokens);
        });

        test('should count tokens using GPT-2 method', () => {
            const text = 'Hello world, this is a test message.';
            const tokens = promptBuilder.countTokens(text, 'gpt2');
            
            // GPT-2 method: split by delimiters and count
            const expectedTokens = text
                .toLowerCase()
                .replace(/[^\w\s]/g, ' $& ')
                .split(/\s+/)
                .filter(token => token.length > 0)
                .length;
            
            expect(tokens).toBe(expectedTokens);
        });

        test('should handle empty text', () => {
            expect(promptBuilder.countTokens('')).toBe(0);
            expect(promptBuilder.countTokens(null)).toBe(0);
            expect(promptBuilder.countTokens(undefined)).toBe(0);
        });

        test('should throw error for unknown method', () => {
            expect(() => {
                promptBuilder.countTokens('test', 'unknown');
            }).toThrow('Unknown token counting method: unknown');
        });

        test('should use default method when none specified', () => {
            const text = 'Test message';
            const tokens = promptBuilder.countTokens(text);
            
            // Should use default method (character)
            const expectedTokens = Math.ceil(text.length / 4);
            expect(tokens).toBe(expectedTokens);
        });
    });

    describe('Smart Truncation', () => {
        const longText = 'This is the first sentence. This is the second sentence. This is the third sentence. This is the fourth sentence. This is the fifth sentence.';

        test('should not truncate when under token limit', () => {
            const result = promptBuilder.smartTruncate(longText, 1000);
            
            expect(result.truncated).toBe(false);
            expect(result.text).toBe(longText);
            expect(result.tokensRemoved).toBe(0);
        });

        test('should truncate from end when over token limit', () => {
            const result = promptBuilder.smartTruncate(longText, 10, 'end');
            
            expect(result.truncated).toBe(true);
            expect(result.text.length).toBeLessThan(longText.length);
            expect(result.tokensRemoved).toBeGreaterThan(0);
        });

        test('should truncate from start when over token limit', () => {
            const result = promptBuilder.smartTruncate(longText, 10, 'start');
            
            expect(result.truncated).toBe(true);
            expect(result.text.length).toBeLessThan(longText.length);
            expect(result.tokensRemoved).toBeGreaterThan(0);
        });

        test('should truncate from middle when over token limit', () => {
            const result = promptBuilder.smartTruncate(longText, 10, 'middle');
            
            expect(result.truncated).toBe(true);
            expect(result.text).toContain('...');
            expect(result.tokensRemoved).toBeGreaterThan(0);
        });

        test('should use smart truncation by default', () => {
            const result = promptBuilder.smartTruncate(longText, 10, 'smart');
            
            expect(result.truncated).toBe(true);
            expect(result.text.length).toBeLessThan(longText.length);
            expect(result.tokensRemoved).toBeGreaterThan(0);
        });

        test('should handle single sentence text', () => {
            const singleSentence = 'This is a single sentence.';
            const result = promptBuilder.smartTruncate(singleSentence, 5);
            
            expect(result.truncated).toBe(true);
            expect(result.text.length).toBeLessThan(singleSentence.length);
        });

        test('should handle empty text', () => {
            const result = promptBuilder.smartTruncate('', 10);
            
            expect(result.text).toBe('');
            expect(result.truncated).toBe(false);
            expect(result.tokensRemoved).toBe(0);
        });

        test('should prioritize content based on priority level', () => {
            // High priority should keep from start
            const highPriority = promptBuilder.smartTruncate(longText, 10, 'smart', 0.8);
            
            // Low priority should keep from end
            const lowPriority = promptBuilder.smartTruncate(longText, 10, 'smart', 0.2);
            
            expect(highPriority.text).not.toBe(lowPriority.text);
        });
    });

    describe('Content Prioritization', () => {
        test('should prioritize components based on weights', () => {
            const components = {
                system: 'System prompt content',
                character: 'Character description content',
                history: 'Chat history content',
                user: 'User persona content'
            };

            const prioritized = promptBuilder.prioritizeContent(components, 50, {
                contentPrioritization: true,
                priorityWeights: {
                    system: 1.0,
                    character: 0.8,
                    history: 0.6,
                    user: 0.4
                },
                truncationStrategy: 'smart'
            });

            expect(prioritized).toBeDefined();
            expect(Object.keys(prioritized)).toContain('system');
            expect(Object.keys(prioritized)).toContain('character');
        });

        test('should not prioritize when disabled', () => {
            const components = {
                system: 'System content',
                character: 'Character content'
            };

            const prioritized = promptBuilder.prioritizeContent(components, 50, {
                contentPrioritization: false
            });

            expect(prioritized).toEqual(components);
        });

        test('should handle empty components', () => {
            const prioritized = promptBuilder.prioritizeContent({}, 50, {
                contentPrioritization: true
            });

            expect(prioritized).toEqual({});
        });

        test('should respect token limits', () => {
            const components = {
                system: 'A'.repeat(100),
                character: 'B'.repeat(100),
                history: 'C'.repeat(100)
            };

            const prioritized = promptBuilder.prioritizeContent(components, 50, {
                contentPrioritization: true,
                priorityWeights: {
                    system: 1.0,
                    character: 0.8,
                    history: 0.6
                },
                truncationStrategy: 'smart'
            });

            const totalTokens = Object.values(prioritized).reduce((sum, content) => 
                sum + promptBuilder.countTokens(content), 0);
            
            expect(totalTokens).toBeLessThanOrEqual(50);
        });
    });

    describe('Text Compression', () => {
        test('should compress text by removing whitespace', () => {
            const text = 'This   has    extra    whitespace.';
            const result = promptBuilder.compressText(text, { removeWhitespace: true });
            
            expect(result.compressed).toBe(true);
            expect(result.text).toBe('This has extra whitespace.');
            expect(result.ratio).toBeLessThan(1.0);
        });

        test('should compress text by removing redundant phrases', () => {
            const text = 'I think this is very good and so on. In my opinion, it is really excellent.';
            const result = promptBuilder.compressText(text, { removeRedundancy: true });
            
            expect(result.compressed).toBe(true);
            expect(result.text).toContain('this is good');
            expect(result.text).not.toContain('very');
            expect(result.text).not.toContain('and so on');
            expect(result.text).not.toContain('In my opinion');
        });

        test('should compress text by shortening words', () => {
            const text = 'The character description contains personality information.';
            const result = promptBuilder.compressText(text, { shortenWords: true });
            
            expect(result.compressed).toBe(true);
            expect(result.text).toContain('char');
            expect(result.text).toContain('desc');
            expect(result.text).toContain('persona');
            expect(result.text).toContain('info');
        });

        test('should not compress when disabled', () => {
            const text = 'Test message';
            const result = promptBuilder.compressText(text, { removeWhitespace: false });
            
            expect(result.compressed).toBe(false);
            expect(result.text).toBe(text);
            expect(result.ratio).toBe(1.0);
        });

        test('should handle empty text', () => {
            const result = promptBuilder.compressText('');
            
            expect(result.compressed).toBe(false);
            expect(result.text).toBe('');
            expect(result.ratio).toBe(1.0);
        });

        test('should calculate compression statistics correctly', () => {
            const text = 'This is a test message with some content.';
            const result = promptBuilder.compressText(text, {
                removeWhitespace: true,
                removeRedundancy: true,
                shortenWords: true
            });
            
            expect(result.originalSize).toBe(text.length);
            expect(result.compressedSize).toBe(result.text.length);
            expect(result.savings).toBe(result.originalSize - result.compressedSize);
            expect(result.ratio).toBe(result.compressedSize / result.originalSize);
        });
    });

    describe('Context Caching', () => {
        test('should cache context data', () => {
            const key = 'test-key';
            const data = { content: 'test content', metadata: { test: true } };
            const config = { contextCaching: true, cacheCompression: false };

            promptBuilder.cacheContext(key, data, config);
            
            const cached = promptBuilder.getCachedContext(key);
            expect(cached).toEqual(data);
        });

        test('should compress cached data when beneficial', () => {
            const key = 'test-key';
            // Use data that will definitely be compressed (redundant phrases and long words)
            const data = { 
                content: 'This is a very long description with really excellent information about the character personality and scenario details. In my opinion, this contains quite a lot of redundant phrases and so on. I think this will be compressed because it has many words that can be shortened like character, description, personality, information, because, through, though, etc.',
                metadata: { test: true } 
            };
            const config = { 
                contextCaching: true, 
                cacheCompression: true,
                compressionThreshold: 500 // Lower threshold to ensure compression
            };

            promptBuilder.cacheContext(key, data, config);
            
            const cached = promptBuilder.getCachedContext(key);
            expect(cached).toEqual(data);
            
            // Check that compression was applied (data contains compressible content)
            const cacheStats = promptBuilder.cacheStats;
            expect(cacheStats.compressions).toBeGreaterThan(0);
        });

        test('should return null for non-existent cache key', () => {
            const cached = promptBuilder.getCachedContext('non-existent');
            expect(cached).toBeNull();
        });

        test('should track cache statistics', () => {
            const key = 'test-key';
            const data = { content: 'test content' };
            const config = { contextCaching: true };

            // Initial stats
            expect(promptBuilder.cacheStats.hits).toBe(0);
            expect(promptBuilder.cacheStats.misses).toBe(0);

            // Cache miss
            const cached1 = promptBuilder.getCachedContext(key);
            expect(cached1).toBeNull();
            expect(promptBuilder.cacheStats.misses).toBe(1);

            // Cache data
            promptBuilder.cacheContext(key, data, config);

            // Cache hit
            const cached2 = promptBuilder.getCachedContext(key);
            expect(cached2).toEqual(data);
            expect(promptBuilder.cacheStats.hits).toBe(1);
        });

        test('should enforce cache size limits', () => {
            const config = { contextCaching: true, cacheCompression: false };
            
            // Set small cache size
            promptBuilder.defaultConfig.maxCacheSize = 1000;

            // Add multiple large entries
            for (let i = 0; i < 10; i++) {
                const data = { content: 'A'.repeat(500) };
                promptBuilder.cacheContext(`key-${i}`, data, config);
            }

            // Check that cache size is enforced
            const totalSize = promptBuilder.cacheStats.totalSize;
            expect(totalSize).toBeLessThanOrEqual(1000);
        });

        test('should clear context cache', () => {
            const key = 'test-key';
            const data = { content: 'test content' };
            const config = { contextCaching: true };

            promptBuilder.cacheContext(key, data, config);
            expect(promptBuilder.getCachedContext(key)).toEqual(data);

            promptBuilder.clearContextCache();
            expect(promptBuilder.getCachedContext(key)).toBeNull();
            expect(promptBuilder.cacheStats.hits).toBe(0);
            expect(promptBuilder.cacheStats.misses).toBe(1); // One miss from the getCachedContext call after clear
            expect(promptBuilder.cacheStats.compressions).toBe(0);
        });
    });

    describe('Integration with buildPrompt', () => {
        test('should apply token optimization when enabled', async () => {
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
                tokenCountingEnabled: true,
                tokenLimit: 100,
                contentPrioritization: true
            });

            expect(result.metadata.tokenCount).toBeLessThanOrEqual(100);
            expect(result.metadata.optimizationStats.optimizationApplied).toBe(true);
        });

        test('should apply compression when enabled', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'This is a very long description with redundant phrases and so on. In my opinion, it contains really excellent information about the character personality and scenario details.'
                }
            };

            const result = await promptBuilder.buildPrompt(character, [], null, {
                compressionEnabled: true,
                compressionThreshold: 50
            });

            expect(result.metadata.optimizationStats.compression.compressed).toBe(true);
            expect(result.metadata.optimizationStats.compression.compressionRatio).toBeLessThan(1.0);
        });

        test('should use context caching when enabled', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character' }
            };

            const config = {
                contextCaching: true,
                cacheCompression: false
            };

            // First call
            const result1 = await promptBuilder.buildPrompt(character, [], null, config);
            
            // Second call should use cache
            const result2 = await promptBuilder.buildPrompt(character, [], null, config);

            expect(result1.content).toBe(result2.content);
            expect(promptBuilder.cacheStats.hits).toBeGreaterThan(0);
        });

        test('should track optimization statistics', async () => {
            const character = {
                id: 'test-character',
                data: {
                    name: 'Test Character',
                    description: 'A'.repeat(500)
                }
            };

            await promptBuilder.buildPrompt(character, [], null, {
                tokenCountingEnabled: true,
                tokenLimit: 50,
                compressionEnabled: true,
                compressionThreshold: 100,
                contextCaching: true
            });

            const stats = promptBuilder.getStats();
            expect(stats.averageTokens).toBeGreaterThan(0);
            expect(stats.optimizationStats.truncationCount).toBeGreaterThan(0);
            // Context cache hits may be 0 if no cache hit occurred, so we just check the structure
            expect(stats.contextCacheStats).toBeDefined();
            expect(typeof stats.contextCacheStats.hits).toBe('number');
        });
    });

    describe('Configuration Methods', () => {
        test('should set token counting method', () => {
            promptBuilder.setTokenCountingMethod('word');
            expect(promptBuilder.defaultConfig.tokenEstimationMethod).toBe('word');
        });

        test('should throw error for invalid token counting method', () => {
            expect(() => {
                promptBuilder.setTokenCountingMethod('invalid');
            }).toThrow('Unknown token counting method: invalid');
        });

        test('should set compression settings', () => {
            promptBuilder.setCompressionSettings(true, 500);
            expect(promptBuilder.defaultConfig.compressionEnabled).toBe(true);
            expect(promptBuilder.defaultConfig.compressionThreshold).toBe(500);
        });

        test('should set truncation strategy', () => {
            promptBuilder.setTruncationStrategy('end');
            expect(promptBuilder.defaultConfig.truncationStrategy).toBe('end');
        });

        test('should throw error for invalid truncation strategy', () => {
            expect(() => {
                promptBuilder.setTruncationStrategy('invalid');
            }).toThrow('Invalid truncation strategy: invalid');
        });
    });

    describe('Optimization Statistics', () => {
        test('should return comprehensive optimization stats', () => {
            const stats = promptBuilder.getOptimizationStats();
            
            expect(stats.tokenCounting).toBeDefined();
            expect(stats.compression).toBeDefined();
            expect(stats.truncation).toBeDefined();
            expect(stats.caching).toBeDefined();
            
            expect(stats.tokenCounting.enabled).toBe(true);
            expect(stats.compression.enabled).toBe(true);
            expect(stats.truncation.enabled).toBe(true);
            expect(stats.caching.contextEnabled).toBe(true);
        });

        test('should track token counting statistics', async () => {
            const character = {
                id: 'test-character',
                data: { name: 'Test Character', description: 'Test description' }
            };

            await promptBuilder.buildPrompt(character, [], null, {
                tokenCountingEnabled: true
            });

            const stats = promptBuilder.getOptimizationStats();
            expect(stats.tokenCounting.totalTokenCounts).toBeGreaterThan(0);
            expect(stats.tokenCounting.averageTokens).toBeGreaterThan(0);
        });

        test('should track compression statistics', async () => {
            const character = {
                id: 'test-character',
                data: { 
                    name: 'Test Character', 
                    description: 'This is a very long description with redundant phrases and so on.' 
                }
            };

            await promptBuilder.buildPrompt(character, [], null, {
                compressionEnabled: true,
                compressionThreshold: 50
            });

            const stats = promptBuilder.getOptimizationStats();
            expect(stats.compression.totalCompressions).toBeGreaterThan(0);
            expect(stats.compression.averageRatio).toBeLessThan(1.0);
        });
    });
}); 