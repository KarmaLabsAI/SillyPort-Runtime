/**
 * PromptBuilder - Context Assembly for SillyTavern Browser Runtime
 * 
 * Handles prompt construction from character data, chat history, and configuration.
 * Provides context assembly, history formatting, and system prompt construction.
 * 
 * Task 4.1.1: Context Assembly
 * Task 4.1.3: Context Optimization
 */

class PromptBuilder {
    constructor(eventBus = null, configManager = null) {
        this.eventBus = eventBus;
        this.configManager = configManager;
        
        // Default configuration
        this.defaultConfig = {
            maxContextLength: 4000,
            maxHistoryLength: 2000,
            maxSystemPromptLength: 1000,
            priorityOrder: ['system', 'worldInfo', 'character', 'history', 'user'],
            includeMetadata: true,
            trimSentences: false,
            singleLine: false,
            useStopStrings: false,
            alwaysForceName2: true,
            
            // Task 4.1.3: Context Optimization
            tokenCountingEnabled: true,
            tokenEstimationMethod: 'character', // 'character', 'word', 'gpt2'
            compressionEnabled: true,
            compressionThreshold: 1000,
            smartTruncation: true,
            contentPrioritization: true,
            contextCaching: true,
            cacheCompression: true,
            maxCacheSize: 50 * 1024 * 1024, // 50MB
            tokenLimit: 4096,
            truncationStrategy: 'smart', // 'smart', 'end', 'start', 'middle'
            priorityWeights: {
                system: 1.0,
                worldInfo: 0.9,
                character: 0.8,
                history: 0.7,
                user: 0.6
            }
        };
        
        // Cache for processed prompts
        this.promptCache = new Map();
        this.cacheEnabled = true;
        this.cacheSize = 100;
        
        // Task 4.1.3: Enhanced context caching
        this.contextCache = new Map();
        this.compressedCache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            compressions: 0,
            totalSize: 0,
            compressedSize: 0
        };
        
        // Statistics tracking
        this.stats = {
            promptsBuilt: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageLength: 0,
            totalLength: 0,
            tokenCounts: [],
            compressionRatios: [],
            truncationCount: 0
        };
        
        this.debugMode = false;
        
        // Token counting utilities
        this.tokenCounters = {
            character: this.estimateTokensByCharacter.bind(this),
            word: this.estimateTokensByWord.bind(this),
            gpt2: this.estimateTokensGPT2.bind(this)
        };
    }

    /**
     * Estimate tokens by character count (rough approximation)
     * @param {string} text - Text to count tokens
     * @returns {number} Estimated token count
     */
    estimateTokensByCharacter(text) {
        if (!text) return 0;
        // Rough approximation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }

    /**
     * Estimate tokens by word count
     * @param {string} text - Text to count tokens
     * @returns {number} Estimated token count
     */
    estimateTokensByWord(text) {
        if (!text) return 0;
        // Split by whitespace and count words
        const words = text.trim().split(/\s+/);
        return words.length;
    }

    /**
     * Estimate tokens using GPT-2 tokenizer approximation
     * @param {string} text - Text to count tokens
     * @returns {number} Estimated token count
     */
    estimateTokensGPT2(text) {
        if (!text) return 0;
        
        // GPT-2 tokenizer approximation
        // Split by common delimiters and count
        const tokens = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' $& ')
            .split(/\s+/)
            .filter(token => token.length > 0);
        
        return tokens.length;
    }

    /**
     * Count tokens in text using specified method
     * @param {string} text - Text to count tokens
     * @param {string} method - Token counting method
     * @returns {number} Token count
     */
    countTokens(text, method = null) {
        const countingMethod = method || this.defaultConfig.tokenEstimationMethod;
        const counter = this.tokenCounters[countingMethod];
        
        if (!counter) {
            throw new Error(`Unknown token counting method: ${countingMethod}`);
        }
        
        return counter(text);
    }

    /**
     * Smart truncation of text based on priority and token limits
     * @param {string} text - Text to truncate
     * @param {number} maxTokens - Maximum tokens allowed
     * @param {string} strategy - Truncation strategy
     * @param {number} priority - Content priority (0-1)
     * @returns {Object} Truncated text and metadata
     */
    smartTruncate(text, maxTokens, strategy = 'smart', priority = 0.5) {
        if (!text || maxTokens <= 0) {
            return { text: '', truncated: false, tokensRemoved: 0 };
        }

        const currentTokens = this.countTokens(text);
        if (currentTokens <= maxTokens) {
            return { text, truncated: false, tokensRemoved: 0 };
        }

        const tokensToRemove = currentTokens - maxTokens;
        let truncatedText = text;
        let tokensRemoved = 0;

        switch (strategy) {
            case 'end':
                // Remove from end
                truncatedText = this.truncateFromEnd(text, tokensToRemove);
                break;
                
            case 'start':
                // Remove from start
                truncatedText = this.truncateFromStart(text, tokensToRemove);
                break;
                
            case 'middle':
                // Remove from middle
                truncatedText = this.truncateFromMiddle(text, tokensToRemove);
                break;
                
            case 'smart':
            default:
                // Smart truncation based on content structure
                truncatedText = this.smartTruncateContent(text, tokensToRemove, priority);
                break;
        }

        tokensRemoved = currentTokens - this.countTokens(truncatedText);
        
        return {
            text: truncatedText,
            truncated: true,
            tokensRemoved,
            originalTokens: currentTokens,
            finalTokens: this.countTokens(truncatedText)
        };
    }

    /**
     * Truncate text from the end
     * @param {string} text - Text to truncate
     * @param {number} tokensToRemove - Tokens to remove
     * @returns {string} Truncated text
     */
    truncateFromEnd(text, tokensToRemove) {
        const words = text.split(/\s+/);
        const tokensPerWord = this.countTokens(text) / words.length;
        const wordsToRemove = Math.ceil(tokensToRemove / tokensPerWord);
        
        return words.slice(0, Math.max(0, words.length - wordsToRemove)).join(' ');
    }

    /**
     * Truncate text from the start
     * @param {string} text - Text to truncate
     * @param {number} tokensToRemove - Tokens to remove
     * @returns {string} Truncated text
     */
    truncateFromStart(text, tokensToRemove) {
        const words = text.split(/\s+/);
        const tokensPerWord = this.countTokens(text) / words.length;
        const wordsToRemove = Math.ceil(tokensToRemove / tokensPerWord);
        
        return words.slice(wordsToRemove).join(' ');
    }

    /**
     * Truncate text from the middle
     * @param {string} text - Text to truncate
     * @param {number} tokensToRemove - Tokens to remove
     * @returns {string} Truncated text
     */
    truncateFromMiddle(text, tokensToRemove) {
        const words = text.split(/\s+/);
        const tokensPerWord = this.countTokens(text) / words.length;
        const wordsToRemove = Math.ceil(tokensToRemove / tokensPerWord);
        const halfRemove = Math.floor(wordsToRemove / 2);
        
        const firstPart = words.slice(0, Math.floor(words.length / 2) - halfRemove);
        const secondPart = words.slice(Math.floor(words.length / 2) + halfRemove);
        
        return [...firstPart, '...', ...secondPart].join(' ');
    }

    /**
     * Smart truncation based on content structure and priority
     * @param {string} text - Text to truncate
     * @param {number} tokensToRemove - Tokens to remove
     * @param {number} priority - Content priority
     * @returns {string} Truncated text
     */
    smartTruncateContent(text, tokensToRemove, priority) {
        // Split into sentences for better truncation
        const sentences = text.split(/(?<=[.!?])\s+/);
        
        if (sentences.length <= 1) {
            // Single sentence, use end truncation
            return this.truncateFromEnd(text, tokensToRemove);
        }

        // Calculate tokens per sentence
        const sentenceTokens = sentences.map(s => this.countTokens(s));
        const totalTokens = sentenceTokens.reduce((sum, tokens) => sum + tokens, 0);
        
        // Determine which sentences to keep based on priority
        const keepRatio = 1 - (tokensToRemove / totalTokens);
        const sentencesToKeep = Math.max(1, Math.floor(sentences.length * keepRatio));
        
        // Keep sentences based on priority position
        let selectedSentences;
        if (priority > 0.7) {
            // High priority: keep from start
            selectedSentences = sentences.slice(0, sentencesToKeep);
        } else if (priority < 0.3) {
            // Low priority: keep from end
            selectedSentences = sentences.slice(-sentencesToKeep);
        } else {
            // Medium priority: keep from both ends
            const halfKeep = Math.ceil(sentencesToKeep / 2);
            const firstPart = sentences.slice(0, halfKeep);
            const secondPart = sentences.slice(-halfKeep);
            selectedSentences = [...firstPart, ...secondPart];
        }
        
        return selectedSentences.join(' ');
    }

    /**
     * Prioritize content based on importance and token limits
     * @param {Object} components - Prompt components
     * @param {number} maxTokens - Maximum tokens allowed
     * @param {Object} config - Configuration
     * @returns {Object} Prioritized components
     */
    prioritizeContent(components, maxTokens, config) {
        if (!config.contentPrioritization) {
            return components;
        }

        const prioritized = {};
        const weights = config.priorityWeights;
        let remainingTokens = maxTokens;

        // Sort components by priority
        const sortedComponents = Object.entries(components)
            .map(([key, content]) => ({
                key,
                content,
                weight: weights[key] || 0.5,
                tokens: this.countTokens(content)
            }))
            .sort((a, b) => b.weight - a.weight);

        // Allocate tokens based on priority
        for (const component of sortedComponents) {
            if (remainingTokens <= 0) {
                break;
            }

            const allocatedTokens = Math.floor(remainingTokens * component.weight);
            const truncationResult = this.smartTruncate(
                component.content,
                Math.min(allocatedTokens, component.tokens),
                config.truncationStrategy,
                component.weight
            );

            prioritized[component.key] = truncationResult.text;
            remainingTokens -= this.countTokens(truncationResult.text);
        }

        return prioritized;
    }

    /**
     * Compress text using simple compression techniques
     * @param {string} text - Text to compress
     * @param {Object} options - Compression options
     * @returns {Object} Compressed text and metadata
     */
    compressText(text, options = {}) {
        if (!text || !this.defaultConfig.compressionEnabled) {
            return { text, compressed: false, ratio: 1.0 };
        }

        const originalSize = text.length;
        let compressedText = text;

        // Remove extra whitespace
        if (options.removeWhitespace !== false) {
            compressedText = compressedText.replace(/\s+/g, ' ').trim();
        }

        // Remove common redundant phrases
        if (options.removeRedundancy !== false) {
            const redundancies = [
                /\b(very|really|quite|extremely)\s+/gi,
                /\b(and so on|etc\.|and the like)\b/gi,
                /\b(in my opinion|I think|I believe)\b/gi
            ];
            
            redundancies.forEach(pattern => {
                compressedText = compressedText.replace(pattern, '');
            });
        }

        // Shorten common words
        if (options.shortenWords !== false) {
            const wordMap = {
                'character': 'char',
                'description': 'desc',
                'personality': 'persona',
                'scenario': 'scene',
                'information': 'info',
                'because': 'bc',
                'through': 'thru',
                'though': 'tho'
            };

            Object.entries(wordMap).forEach(([long, short]) => {
                const regex = new RegExp(`\\b${long}\\b`, 'gi');
                compressedText = compressedText.replace(regex, short);
            });
        }

        const compressedSize = compressedText.length;
        const ratio = originalSize > 0 ? compressedSize / originalSize : 1.0;

        return {
            text: compressedText,
            compressed: ratio < 0.95, // Only consider compressed if significant reduction
            ratio,
            originalSize,
            compressedSize,
            savings: originalSize - compressedSize
        };
    }

    /**
     * Enhanced context caching with compression
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     * @param {Object} config - Configuration
     */
    async cacheContext(key, data, config) {
        if (!config.contextCaching) return;

        const dataString = JSON.stringify(data);
        const dataSize = new Blob([dataString]).size;

        // Check if compression is beneficial
        const compressionThreshold = config.compressionThreshold || this.defaultConfig.compressionThreshold;
        if (config.cacheCompression && dataSize > compressionThreshold) {
            // For JSON data, we should not apply text-based compression as it modifies the content
            // Instead, we'll use the new Compressor utility for proper data compression
            try {
                const { compress } = require('../utils/Compressor.js');
                const compressedData = await compress(dataString);
                const compressedSize = new Blob([compressedData]).size;
                
                if (compressedSize < dataSize) {
                    this.compressedCache.set(key, {
                        data: compressedData,
                        compressed: true,
                        originalSize: dataSize,
                        compressedSize: compressedSize,
                        timestamp: Date.now()
                    });
                    this.cacheStats.compressions++;
                    this.cacheStats.compressedSize += compressedSize;
                } else {
                    this.contextCache.set(key, {
                        data: dataString,
                        compressed: false,
                        originalSize: dataSize,
                        compressedSize: dataSize,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                // Fallback to uncompressed storage if compression fails
                this.contextCache.set(key, {
                    data: dataString,
                    compressed: false,
                    originalSize: dataSize,
                    compressedSize: dataSize,
                    timestamp: Date.now()
                });
            }
        } else {
            this.contextCache.set(key, {
                data: dataString,
                compressed: false,
                originalSize: dataSize,
                compressedSize: dataSize,
                timestamp: Date.now()
            });
        }

        this.cacheStats.totalSize += dataSize;
        this.enforceCacheSize();
    }

    /**
     * Retrieve context from cache
     * @param {string} key - Cache key
     * @returns {Promise<Object|null>} Cached data or null
     */
    async getCachedContext(key) {
        // Check compressed cache first
        if (this.compressedCache.has(key)) {
            this.cacheStats.hits++;
            const cached = this.compressedCache.get(key);
            try {
                const { decompress } = require('../utils/Compressor.js');
                const decompressedData = await decompress(cached.data);
                return JSON.parse(decompressedData);
            } catch (error) {
                // Fallback to uncompressed data if decompression fails
                console.warn('Decompression failed, using fallback:', error.message);
                return null;
            }
        }

        // Check regular cache
        if (this.contextCache.has(key)) {
            this.cacheStats.hits++;
            const cached = this.contextCache.get(key);
            return JSON.parse(cached.data);
        }

        this.cacheStats.misses++;
        return null;
    }

    /**
     * Enforce cache size limits
     */
    enforceCacheSize() {
        const maxSize = this.defaultConfig.maxCacheSize;
        let currentSize = this.cacheStats.totalSize;

        if (currentSize <= maxSize) return;

        // Remove oldest entries from both caches
        const allEntries = [
            ...Array.from(this.contextCache.entries()).map(([key, value]) => ({
                key,
                value,
                cache: 'context'
            })),
            ...Array.from(this.compressedCache.entries()).map(([key, value]) => ({
                key,
                value,
                cache: 'compressed'
            }))
        ].sort((a, b) => a.value.timestamp - b.value.timestamp);

        // Remove entries until under limit
        for (const entry of allEntries) {
            if (currentSize <= maxSize) break;

            currentSize -= entry.value.originalSize;
            this.cacheStats.totalSize -= entry.value.originalSize;

            if (entry.cache === 'context') {
                this.contextCache.delete(entry.key);
            } else {
                this.compressedCache.delete(entry.key);
            }
        }
    }

    /**
     * Build a complete prompt from character data and chat history
     * @param {Object} character - CharacterCard instance or character data
     * @param {Array} messages - Array of chat messages
     * @param {Object} contextPreset - Context preset configuration
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Built prompt with metadata
     */
    async buildPrompt(character, messages = [], contextPreset = null, options = {}) {
        const startTime = Date.now();
        
        try {
            // Defensive: error if character is not object/null
            if (character !== null && typeof character !== 'object') {
                if (this.eventBus) {
                    await this.eventBus.emit('prompt:error', {
                        error: 'Invalid character data',
                        characterId: 'unknown',
                        messageCount: Array.isArray(messages) ? messages.length : 0
                    });
                }
                // Return a default result instead of throwing
                return {
                    content: '',
                    metadata: {
                        characterId: 'unknown',
                        messageCount: Array.isArray(messages) ? messages.length : 0,
                        contextPreset: 'default',
                        totalLength: 0,
                        componentLengths: {},
                        buildTime: Date.now() - startTime,
                        cacheHit: false,
                        timestamp: Date.now(),
                        tokenCount: 0,
                        optimizationStats: {}
                    },
                    components: {},
                    config: this.mergeConfig(options)
                };
            }
            
            // Merge options with defaults
            const config = this.mergeConfig(options);
            
            // Generate cache key
            const cacheKey = this.generateCacheKey(character, messages, contextPreset, config);
            
            // Check context cache first (Task 4.1.3)
            if (config.contextCaching) {
                const cachedContext = await this.getCachedContext(cacheKey);
                if (cachedContext) {
                    this.stats.cacheHits++;
                    this.stats.promptsBuilt++;
                    this.stats.totalLength += cachedContext.content.length;
                    this.stats.averageLength = this.stats.totalLength / this.stats.promptsBuilt;
                    return cachedContext;
                }
            }
            
            // Check regular cache
            if (this.cacheEnabled && this.promptCache.has(cacheKey)) {
                this.stats.cacheHits++;
                this.stats.promptsBuilt++;
                this.stats.totalLength += this.promptCache.get(cacheKey).content.length;
                this.stats.averageLength = this.stats.totalLength / this.stats.promptsBuilt;
                return this.promptCache.get(cacheKey);
            }
            
            this.stats.cacheMisses++;
            
            // Build prompt components
            const components = await this.buildComponents(character, messages, contextPreset, config);
            
            // Task 4.1.3: Apply content prioritization and token optimization
            let optimizedComponents = components;
            let optimizationStats = {};
            
            if (config.tokenCountingEnabled && config.tokenLimit) {
                const totalTokens = Object.values(components).reduce((sum, content) => 
                    sum + this.countTokens(content), 0);
                
                if (totalTokens > config.tokenLimit) {
                    optimizedComponents = this.prioritizeContent(components, config.tokenLimit, config);
                    optimizationStats = {
                        originalTokens: totalTokens,
                        finalTokens: Object.values(optimizedComponents).reduce((sum, content) => 
                            sum + this.countTokens(content), 0),
                        tokensRemoved: totalTokens - Object.values(optimizedComponents).reduce((sum, content) => 
                            sum + this.countTokens(content), 0),
                        optimizationApplied: true
                    };
                    this.stats.truncationCount++;
                }
            }
            
            // Assemble final prompt
            const prompt = await this.assemblePrompt(optimizedComponents, contextPreset, config, character);
            
            // Task 4.1.3: Apply compression if enabled
            let finalContent = prompt.content;
            let compressionStats = {};
            
            if (config.compressionEnabled && finalContent.length > config.compressionThreshold) {
                const compressionResult = this.compressText(finalContent, {
                    removeWhitespace: true,
                    removeRedundancy: true,
                    shortenWords: true
                });
                
                if (compressionResult.compressed) {
                    finalContent = compressionResult.text;
                    compressionStats = {
                        compressed: true,
                        originalSize: compressionResult.originalSize,
                        compressedSize: compressionResult.compressedSize,
                        compressionRatio: compressionResult.ratio,
                        savings: compressionResult.savings
                    };
                    this.stats.compressionRatios.push(compressionResult.ratio);
                }
            }
            
            // Calculate statistics
            const promptLength = finalContent.length;
            const tokenCount = this.countTokens(finalContent);
            this.updateStats(promptLength, tokenCount);
            
            // Create result object
            const result = {
                content: finalContent,
                metadata: {
                    characterId: character?.id || character?.data?.name || 'unknown',
                    messageCount: messages.length,
                    contextPreset: contextPreset?.name || 'default',
                    totalLength: promptLength,
                    componentLengths: prompt.componentLengths,
                    buildTime: Date.now() - startTime,
                    cacheHit: this.cacheEnabled && this.promptCache.has(cacheKey),
                    timestamp: Date.now(),
                    tokenCount: tokenCount,
                    optimizationStats: {
                        ...optimizationStats,
                        compression: compressionStats
                    }
                },
                components: optimizedComponents,
                config: config
            };
            
            // Cache the result (Task 4.1.3: Enhanced caching)
            if (this.cacheEnabled) {
                this.cachePrompt(cacheKey, result);
            }
            
            if (config.contextCaching) {
                this.cacheContext(cacheKey, result, config);
            }
            
            // Emit event
            if (this.eventBus) {
                await this.eventBus.emit('prompt:built', {
                    characterId: character?.id || character?.data?.name || 'unknown',
                    messageCount: messages.length,
                    promptLength: promptLength,
                    buildTime: result.metadata.buildTime
                });
            }
            
            return result;
            
        } catch (error) {
            if (this.eventBus) {
                await this.eventBus.emit('prompt:error', {
                    error: error.message,
                    characterId: character?.id || character?.data?.name || 'unknown',
                    messageCount: Array.isArray(messages) ? messages.length : 0
                });
            }
            throw error;
        }
    }

    /**
     * Build individual prompt components
     * @param {Object} character - Character data
     * @param {Array} messages - Chat messages
     * @param {Object} contextPreset - Context preset
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} Built components
     */
    async buildComponents(character, messages, contextPreset, config) {
        const components = {};
        
        // Build system prompt
        if (config.includeSystemPrompt !== false) {
            components.system = await this.buildSystemPrompt(character, contextPreset, config);
        }
        
        // Build world info
        if (character?.data?.world_info) {
            components.worldInfo = await this.buildWorldInfo(character, config);
        }
        
        // Build character description
        components.character = await this.buildCharacterDescription(character, config);
        
        // Build chat history
        if (messages && messages.length > 0) {
            components.history = await this.buildChatHistory(messages, character, config);
        }
        
        // Build user persona
        if (config.userPersona) {
            components.user = await this.buildUserPersona(config.userPersona, config);
        }
        
        return components;
    }

    /**
     * Build system prompt component
     * @param {Object} character - Character data
     * @param {Object} contextPreset - Context preset
     * @param {Object} config - Configuration
     * @returns {Promise<string>} System prompt
     */
    async buildSystemPrompt(character, contextPreset, config) {
        let systemPrompt = '';
        
        // Get system prompt from character data
        if (character?.data?.system_prompt) {
            systemPrompt += character.data.system_prompt.trim();
        }
        
        // Add context preset system instructions
        if (contextPreset?.system_instructions) {
            if (systemPrompt) systemPrompt += '\n\n';
            systemPrompt += contextPreset.system_instructions.trim();
        }
        
        // Add default system instructions if none provided
        if (!systemPrompt) {
            systemPrompt = this.getDefaultSystemPrompt(character, contextPreset);
        }
        
        // Apply length limits
        if (systemPrompt.length > config.maxSystemPromptLength) {
            systemPrompt = this.truncateText(systemPrompt, config.maxSystemPromptLength, '...');
        }
        
        return systemPrompt;
    }

    /**
     * Build world info component
     * @param {Object} character - Character data
     * @param {Object} config - Configuration
     * @returns {Promise<string>} World info
     */
    async buildWorldInfo(character, config) {
        if (!character?.data?.world_info) {
            return '';
        }
        
        let worldInfo = character.data.world_info;
        
        // Format world info based on structure
        if (typeof worldInfo === 'object') {
            worldInfo = this.formatWorldInfoObject(worldInfo);
        }
        
        // Apply length limits
        const maxWorldInfoLength = Math.floor(config.maxContextLength * 0.3); // 30% of context
        if (worldInfo.length > maxWorldInfoLength) {
            worldInfo = this.truncateText(worldInfo, maxWorldInfoLength, '...');
        }
        
        return worldInfo;
    }

    /**
     * Build character description component
     * @param {Object} character - Character data
     * @param {Object} config - Configuration
     * @returns {Promise<string>} Character description
     */
    async buildCharacterDescription(character, config) {
        if (!character?.data) {
            return '';
        }
        
        const data = character.data;
        let description = '';
        
        // Add character name
        if (data.name) {
            description += `Character: ${data.name}\n`;
        }
        
        // Add description
        if (data.description) {
            description += `Description: ${data.description}\n`;
        }
        
        // Add personality
        if (data.personality) {
            description += `Personality: ${data.personality}\n`;
        }
        
        // Add scenario
        if (data.scenario) {
            description += `Scenario: ${data.scenario}\n`;
        }
        
        // Add first message
        if (data.first_mes) {
            description += `${data.first_mes}\n`;
        }
        
        // Add example messages
        if (data.mes_example) {
            description += `Example conversation:\n${data.mes_example}\n`;
        }
        
        // Apply length limits
        const maxCharLength = Math.floor(config.maxContextLength * 0.4); // 40% of context
        if (description.length > maxCharLength) {
            description = this.truncateText(description, maxCharLength, '...');
        }
        
        return description;
    }

    /**
     * Build chat history component
     * @param {Array} messages - Chat messages
     * @param {Object} character - Character data
     * @param {Object} config - Configuration
     * @returns {Promise<string>} Formatted chat history
     */
    async buildChatHistory(messages, character, config) {
        if (!messages || messages.length === 0) {
            return '';
        }
        
        // Sort messages by timestamp
        const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
        
        // Apply history length limits
        const maxHistoryLength = config.maxHistoryLength;
        let history = '';
        let currentLength = 0;
        
        // Process messages in reverse order to get most recent within limits
        for (let i = sortedMessages.length - 1; i >= 0; i--) {
            const message = sortedMessages[i];
            const formattedMessage = this.formatMessage(message, character, config);
            
            if (currentLength + formattedMessage.length > maxHistoryLength) {
                break;
            }
            
            history = formattedMessage + '\n' + history;
            currentLength += formattedMessage.length + 1;
        }
        
        // Trim and format
        history = history.trim();
        
        // Apply sentence trimming if enabled
        if (config.trimSentences) {
            history = this.trimSentences(history);
        }
        
        return history;
    }

    /**
     * Build user persona component
     * @param {Object} userPersona - User persona data
     * @param {Object} config - Configuration
     * @returns {Promise<string>} User persona
     */
    async buildUserPersona(userPersona, config) {
        if (!userPersona) {
            return '';
        }
        
        let persona = '';
        
        if (typeof userPersona === 'string') {
            persona = userPersona;
        } else if (typeof userPersona === 'object') {
            if (userPersona.description) {
                persona += `User: ${userPersona.description}\n`;
            }
            if (userPersona.personality) {
                persona += `User personality: ${userPersona.personality}\n`;
            }
            if (userPersona.background) {
                persona += `User background: ${userPersona.background}\n`;
            }
        }
        
        // Apply length limits
        const maxPersonaLength = Math.floor(config.maxContextLength * 0.2); // 20% of context
        if (persona.length > maxPersonaLength) {
            persona = this.truncateText(persona, maxPersonaLength, '...');
        }
        
        return persona;
    }

    /**
     * Assemble final prompt from components
     * @param {Object} components - Built components
     * @param {Object} contextPreset - Context preset
     * @param {Object} config - Configuration
     * @param {Object} character - Character data
     * @returns {Promise<Object>} Assembled prompt
     */
    async assemblePrompt(components, contextPreset, config, character) {
        let finalPrompt = '';
        const componentLengths = {};
        const template = contextPreset?.story_string || this.getDefaultTemplate();
        const variables = {
            system: components.system || '',
            wiBefore: components.worldInfo || '',
            description: this.extractCharacterField(components.character, 'description'),
            personality: this.extractCharacterField(components.character, 'personality'),
            scenario: this.extractCharacterField(components.character, 'scenario'),
            wiAfter: '',
            persona: components.user || '',
            char: this.getCharacterName(components.character),
            trim: config.trimSentences ? '{{trim}}' : '',
            first_mes: character?.data?.first_mes || '',
            mes_example: character?.data?.mes_example || ''
        };
        finalPrompt = this.applyTemplate(template, variables);
        if (components.history) {
            const separator = contextPreset?.example_separator || '***';
            finalPrompt += `\n${separator}\n${components.history}`;
        }
        if (contextPreset?.chat_start) {
            finalPrompt += `\n${contextPreset.chat_start}`;
        }
        Object.keys(components).forEach(key => {
            componentLengths[key] = components[key]?.length || 0;
        });
        if (config.singleLine) {
            finalPrompt = finalPrompt.replace(/\n/g, ' ');
        }
        if (finalPrompt.length > config.maxContextLength) {
            finalPrompt = this.truncateText(finalPrompt, config.maxContextLength, '...');
        }
        return {
            content: finalPrompt.trim(),
            componentLengths
        };
    }

    /**
     * Format a single message for history
     * @param {Object} message - Message object
     * @param {Object} character - Character data
     * @param {Object} config - Configuration
     * @returns {string} Formatted message
     */
    formatMessage(message, character, config) {
        if (!message || !message.content) {
            return '';
        }
        
        let formatted = '';
        
        // Add sender name
        if (message.senderId && config.alwaysForceName2) {
            const senderName = this.getSenderName(message.senderId, character);
            formatted += `${senderName}: `;
        }
        
        // Add message content
        formatted += message.content;
        
        return formatted;
    }

    /**
     * Get sender name from sender ID
     * @param {string} senderId - Sender ID
     * @param {Object} character - Character data
     * @returns {string} Sender name
     */
    getSenderName(senderId, character) {
        // If sender is the character
        if (character?.data?.name && senderId === character.id) {
            return character.data.name;
        }
        
        // If sender is user
        if (senderId === 'user' || senderId === 'User') {
            return 'You';
        }
        
        // Return sender ID as fallback
        return senderId;
    }

    /**
     * Extract specific field from character description
     * @param {string} characterDesc - Character description
     * @param {string} field - Field to extract
     * @returns {string} Extracted field value
     */
    extractCharacterField(characterDesc, field) {
        if (!characterDesc) return '';
        
        const fieldMap = {
            description: /Description:\s*([^\n]+)/,
            personality: /Personality:\s*([^\n]+)/,
            scenario: /Scenario:\s*([^\n]+)/,
            first_mes: /^(?!.*Example conversation:)([^\n]+)$/m
        };
        
        const regex = fieldMap[field];
        if (regex) {
            const match = characterDesc.match(regex);
            if (match) {
                return match[1].trim();
            }
        }
        
        return '';
    }

    /**
     * Get character name from character description
     * @param {string} characterDesc - Character description
     * @returns {string} Character name
     */
    getCharacterName(characterDesc) {
        if (!characterDesc) return 'Character';
        
        // Try to extract name from "Character: Name" pattern
        const match = characterDesc.match(/Character:\s*([^\n]+)/);
        if (match) {
            return match[1].trim();
        }
        
        return 'Character';
    }

    /**
     * Validate a template for syntax errors, unknown variables, and unclosed tags
     * @param {string} template - Template string
     * @param {Object} variables - Allowed variables
     * @param {Object} customFunctions - Allowed custom functions (optional)
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateTemplate(template, variables = {}, customFunctions = {}) {
        const errors = [];
        // Check for unclosed conditionals
        const openIfs = [...template.matchAll(/\{\{#if\s+\w+\}\}/g)];
        const closeIfs = [...template.matchAll(/\{\{\/if\}\}/g)];
        if (openIfs.length !== closeIfs.length) {
            errors.push('Mismatched {{#if}} and {{/if}} tags');
        }
        // Check for unknown variables
        const varMatches = [...template.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)];
        for (const match of varMatches) {
            const varName = match[1];
            if (!(varName in variables)) {
                errors.push(`Unknown variable: {{${varName}}}`);
            }
        }
        // Check for unknown custom functions (e.g., {{#customFunc ...}})
        const funcMatches = [...template.matchAll(/\{\{#([a-zA-Z0-9_]+)(?:\s+[^}]*)?\}\}/g)];
        for (const match of funcMatches) {
            const funcName = match[1];
            if (funcName !== 'if' && !(funcName in customFunctions)) {
                errors.push(`Unknown custom function: {{#${funcName}}}`);
            }
        }
        return { valid: errors.length === 0, errors };
    }

    /**
     * Apply template with variables and custom functions
     * @param {string} template - Template string
     * @param {Object} variables - Template variables
     * @param {Object} customFunctions - Custom template functions (optional)
     * @returns {string} Processed template
     */
    applyTemplate(template, variables, customFunctions = {}) {
        let result = template;
        // Replace variables
        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value || '');
        });
        // Handle conditionals and custom functions
        result = this.processConditionals(result, variables, customFunctions);
        return result;
    }

    /**
     * Process conditional statements and custom functions in template
     * @param {string} template - Template string
     * @param {Object} variables - Template variables
     * @param {Object} customFunctions - Custom template functions (optional)
     * @returns {string} Processed template
     */
    processConditionals(template, variables, customFunctions = {}) {
        // Handle {{#if variable}}content{{/if}} pattern
        const conditionalRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;
        template = template.replace(conditionalRegex, (match, variable, content) => {
            const value = variables[variable];
            if (value && value.trim() !== '') {
                return content;
            }
            return '';
        });
        // Handle custom functions: {{#funcName arg1 arg2}}content{{/funcName}}
        const customFuncRegex = /\{\{#([a-zA-Z0-9_]+)(?:\s+([^}]*))?\}\}([\s\S]*?)\{\{\/\1\}\}/g;
        template = template.replace(customFuncRegex, (match, funcName, args, content) => {
            if (funcName === 'if') return match; // Already handled
            if (customFunctions && typeof customFunctions[funcName] === 'function') {
                // Parse args (split by whitespace, ignore empty)
                const argList = args ? args.trim().split(/\s+/) : [];
                return customFunctions[funcName](content, ...argList, variables);
            }
            // Unknown function: leave as is or remove
            return '';
        });
        return template;
    }

    /**
     * Format world info object
     * @param {Object} worldInfo - World info object
     * @returns {string} Formatted world info
     */
    formatWorldInfoObject(worldInfo) {
        if (Array.isArray(worldInfo)) {
            return worldInfo.map(item => {
                if (typeof item === 'string') return item;
                if (item.name && item.content) {
                    return `${item.name}: ${item.content}`;
                }
                return JSON.stringify(item);
            }).join('\n');
        }
        
        if (typeof worldInfo === 'object') {
            return Object.entries(worldInfo)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        }
        
        return String(worldInfo);
    }

    /**
     * Trim sentences to fit context
     * @param {string} text - Text to trim
     * @returns {string} Trimmed text
     */
    trimSentences(text) {
        const sentences = text.split(/[.!?]+/);
        if (sentences.length <= 3) return text;
        
        // Keep last 3 sentences
        return sentences.slice(-3).join('. ') + '.';
    }

    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {string} suffix - Suffix to add
     * @returns {string} Truncated text
     */
    truncateText(text, maxLength, suffix = '...') {
        if (text.length <= maxLength) return text;
        
        const truncated = text.substring(0, maxLength - suffix.length);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.8) {
            return truncated.substring(0, lastSpace) + suffix;
        }
        
        return truncated + suffix;
    }

    /**
     * Get default system prompt
     * @param {Object} character - Character data
     * @param {Object} contextPreset - Context preset
     * @returns {string} Default system prompt
     */
    getDefaultSystemPrompt(character, contextPreset) {
        return `You are ${character?.data?.name || 'a character'} in a roleplay conversation. 
Respond in character and maintain consistency with your personality and background. 
Keep responses engaging and appropriate to the context.`;
    }

    /**
     * Get default template
     * @returns {string} Default template
     */
    getDefaultTemplate() {
        return `{{#if system}}{{system}}\n{{/if}}{{#if wiBefore}}{{wiBefore}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}'s personality: {{personality}}\n{{/if}}{{#if scenario}}Scenario: {{scenario}}\n{{/if}}{{#if first_mes}}{{first_mes}}\n{{/if}}{{#if mes_example}}Example conversation:\n{{mes_example}}\n{{/if}}{{#if wiAfter}}{{wiAfter}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}`;
    }

    /**
     * Merge configuration with defaults
     * @param {Object} options - User options
     * @returns {Object} Merged configuration
     */
    mergeConfig(options) {
        const config = { ...this.defaultConfig };
        
        // Merge with config manager if available
        if (this.configManager) {
            const runtimeConfig = this.configManager.get('prompt') || {};
            Object.assign(config, runtimeConfig);
        }
        
        // Merge with user options
        Object.assign(config, options);
        
        return config;
    }

    /**
     * Generate cache key for prompt
     * @param {Object} character - Character data
     * @param {Array} messages - Messages
     * @param {Object} contextPreset - Context preset
     * @param {Object} config - Configuration
     * @returns {string} Cache key
     */
    generateCacheKey(character, messages, contextPreset, config) {
        const characterId = character?.id || character?.data?.name || 'unknown';
        const messageCount = messages?.length || 0;
        const presetName = contextPreset?.name || 'default';
        const configHash = JSON.stringify(config);
        
        return `${characterId}_${messageCount}_${presetName}_${this.hashString(configHash)}`;
    }

    /**
     * Simple string hash function
     * @param {string} str - String to hash
     * @returns {string} Hash
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Cache prompt result
     * @param {string} key - Cache key
     * @param {Object} result - Prompt result
     */
    cachePrompt(key, result) {
        // Implement LRU cache eviction
        if (this.promptCache.size >= this.cacheSize) {
            const firstKey = this.promptCache.keys().next().value;
            this.promptCache.delete(firstKey);
        }
        
        this.promptCache.set(key, result);
    }

    /**
     * Update statistics
     * @param {number} promptLength - Prompt length
     * @param {number} tokenCount - Token count of built prompt
     */
    updateStats(promptLength, tokenCount = 0) {
        this.stats.promptsBuilt++;
        this.stats.totalLength += promptLength;
        this.stats.averageLength = this.stats.totalLength / this.stats.promptsBuilt;
        
        if (tokenCount > 0) {
            this.stats.tokenCounts.push(tokenCount);
        }
    }

    /**
     * Get prompt statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const avgTokens = this.stats.tokenCounts.length > 0 
            ? this.stats.tokenCounts.reduce((sum, count) => sum + count, 0) / this.stats.tokenCounts.length 
            : 0;
        
        const avgCompressionRatio = this.stats.compressionRatios.length > 0
            ? this.stats.compressionRatios.reduce((sum, ratio) => sum + ratio, 0) / this.stats.compressionRatios.length
            : 1.0;
        
        return {
            ...this.stats,
            cacheSize: this.promptCache.size,
            cacheEnabled: this.cacheEnabled,
            debugMode: this.debugMode,
            averageTokens: Math.round(avgTokens * 100) / 100,
            averageCompressionRatio: Math.round(avgCompressionRatio * 1000) / 1000,
            contextCacheStats: this.cacheStats,
            optimizationStats: {
                truncationCount: this.stats.truncationCount,
                compressionCount: this.stats.compressionRatios.length,
                averageTokensPerPrompt: Math.round(avgTokens * 100) / 100
            }
        };
    }

    /**
     * Clear prompt cache
     */
    clearCache() {
        this.promptCache.clear();
    }

    /**
     * Clear context cache (Task 4.1.3)
     */
    clearContextCache() {
        this.contextCache.clear();
        this.compressedCache.clear();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            compressions: 0,
            totalSize: 0,
            compressedSize: 0
        };
    }

    /**
     * Get context optimization statistics (Task 4.1.3)
     * @returns {Object} Optimization statistics
     */
    getOptimizationStats() {
        return {
            tokenCounting: {
                enabled: this.defaultConfig.tokenCountingEnabled,
                method: this.defaultConfig.tokenEstimationMethod,
                averageTokens: this.stats.tokenCounts.length > 0 
                    ? this.stats.tokenCounts.reduce((sum, count) => sum + count, 0) / this.stats.tokenCounts.length 
                    : 0,
                totalTokenCounts: this.stats.tokenCounts.length
            },
            compression: {
                enabled: this.defaultConfig.compressionEnabled,
                threshold: this.defaultConfig.compressionThreshold,
                averageRatio: this.stats.compressionRatios.length > 0
                    ? this.stats.compressionRatios.reduce((sum, ratio) => sum + ratio, 0) / this.stats.compressionRatios.length
                    : 1.0,
                totalCompressions: this.stats.compressionRatios.length
            },
            truncation: {
                enabled: this.defaultConfig.smartTruncation,
                strategy: this.defaultConfig.truncationStrategy,
                totalTruncations: this.stats.truncationCount
            },
            caching: {
                contextEnabled: this.defaultConfig.contextCaching,
                cacheCompression: this.defaultConfig.cacheCompression,
                contextCacheSize: this.contextCache.size,
                compressedCacheSize: this.compressedCache.size,
                cacheStats: this.cacheStats
            }
        };
    }

    /**
     * Set token counting method (Task 4.1.3)
     * @param {string} method - Token counting method ('character', 'word', 'gpt2')
     */
    setTokenCountingMethod(method) {
        if (!this.tokenCounters[method]) {
            throw new Error(`Unknown token counting method: ${method}`);
        }
        this.defaultConfig.tokenEstimationMethod = method;
    }

    /**
     * Set compression settings (Task 4.1.3)
     * @param {boolean} enabled - Enable compression
     * @param {number} threshold - Compression threshold
     */
    setCompressionSettings(enabled, threshold = null) {
        this.defaultConfig.compressionEnabled = enabled;
        if (threshold !== null) {
            this.defaultConfig.compressionThreshold = threshold;
        }
    }

    /**
     * Set truncation strategy (Task 4.1.3)
     * @param {string} strategy - Truncation strategy ('smart', 'end', 'start', 'middle')
     */
    setTruncationStrategy(strategy) {
        const validStrategies = ['smart', 'end', 'start', 'middle'];
        if (!validStrategies.includes(strategy)) {
            throw new Error(`Invalid truncation strategy: ${strategy}`);
        }
        this.defaultConfig.truncationStrategy = strategy;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Debug mode enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Enable/disable caching
     * @param {boolean} enabled - Cache enabled
     */
    setCacheEnabled(enabled) {
        this.cacheEnabled = enabled;
        if (!enabled) {
            this.clearCache();
        }
    }

    /**
     * Set cache size
     * @param {number} size - Cache size
     */
    setCacheSize(size) {
        this.cacheSize = size;
        while (this.promptCache.size > this.cacheSize) {
            const firstKey = this.promptCache.keys().next().value;
            this.promptCache.delete(firstKey);
        }
    }

    /**
     * Destroy the prompt builder
     */
    destroy() {
        this.clearCache();
    }
}

module.exports = PromptBuilder; 