/**
 * OpenAIConverter - Task 4.2.1: OpenAI Format Support
 * 
 * Handles conversion of prompts to OpenAI-compatible formats including:
 * - ChatML format conversion
 * - Message role mapping
 * - System message handling
 * - Token optimization
 * - Format validation
 */

class OpenAIConverter {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.debugMode = false;
        
        // Default ChatML format configuration
        this.defaultChatML = {
            input_sequence: "<|im_start|>user",
            output_sequence: "<|im_start|>assistant",
            system_sequence: "<|im_start|>system",
            stop_sequence: "<|im_end|>",
            input_suffix: "<|im_end|>\n",
            output_suffix: "<|im_end|>\n",
            system_suffix: "<|im_end|>\n",
            wrap: true,
            macro: true,
            names_behavior: "force"
        };

        // Role mapping for OpenAI formats
        this.roleMapping = {
            user: 'user',
            assistant: 'assistant',
            system: 'system',
            human: 'user',
            character: 'assistant',
            ai: 'assistant'
        };

        // Token estimation (rough approximation)
        this.tokenEstimates = {
            averageCharsPerToken: 4,
            maxTokens: 4096,
            safetyMargin: 100
        };
    }

    /**
     * Convert prompt to OpenAI ChatML format
     * @param {string|Object} prompt - Prompt content or object
     * @param {Object} instructPreset - Instruction preset configuration
     * @param {Object} options - Conversion options
     * @returns {Object} Converted prompt in OpenAI format
     */
    convert(prompt, instructPreset = null, options = {}) {
        const config = { ...this.defaultChatML, ...instructPreset };
        const { maxTokens = this.tokenEstimates.maxTokens, optimizeTokens = true } = options;

        try {
            // Validate input
            this.validateInput(prompt, config);

            // Parse prompt into components
            const components = this.parsePrompt(prompt);

            // Convert to OpenAI format
            const openaiFormat = this.convertToOpenAIFormat(components, config);

            // Optimize tokens if requested
            if (optimizeTokens) {
                this.optimizeTokens(openaiFormat, maxTokens);
            }

            // Validate output
            this.validateOutput(openaiFormat, config);

            // Emit conversion event
            this.eventBus?.emit('prompt:converted', {
                format: 'openai',
                originalLength: typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length,
                convertedLength: JSON.stringify(openaiFormat).length,
                estimatedTokens: this.estimateTokens(openaiFormat),
                config: config
            });

            return {
                format: 'openai',
                messages: openaiFormat,
                config: config,
                metadata: {
                    originalPrompt: prompt,
                    conversionTimestamp: new Date().toISOString(),
                    estimatedTokens: this.estimateTokens(openaiFormat)
                }
            };

        } catch (error) {
            this.eventBus?.emit('prompt:conversion_error', {
                format: 'openai',
                error: error.message,
                prompt: prompt
            });
            throw error;
        }
    }

    /**
     * Convert to OpenAI ChatML format
     * @param {Object} components - Parsed prompt components
     * @param {Object} config - Instruction preset configuration
     * @returns {Array} OpenAI format messages
     */
    convertToOpenAIFormat(components, config) {
        const messages = [];

        // Add system message if present
        if (components.system) {
            messages.push({
                role: 'system',
                content: this.formatSystemMessage(components.system, config)
            });
        }

        // Add user message
        if (components.user) {
            messages.push({
                role: 'user',
                content: this.formatUserMessage(components.user, config)
            });
        }

        // Add assistant message if present
        if (components.assistant) {
            messages.push({
                role: 'assistant',
                content: this.formatAssistantMessage(components.assistant, config)
            });
        }

        return messages;
    }

    /**
     * Format system message according to ChatML
     * @param {string} content - System message content
     * @param {Object} config - Instruction preset configuration
     * @returns {string} Formatted system message
     */
    formatSystemMessage(content, config) {
        if (!content || !config.system_sequence) {
            return '';
        }

        let formatted = content.trim();
        
        // Apply system sequence
        if (config.wrap && config.system_sequence) {
            formatted = config.system_sequence + formatted;
        }
        
        // Apply system sequence prefix/suffix
        if (config.system_sequence_prefix) {
            formatted = config.system_sequence_prefix + formatted;
        }
        
        if (config.system_sequence_suffix) {
            formatted = formatted + config.system_sequence_suffix;
        }
        
        // Apply system suffix
        if (config.system_suffix) {
            formatted = formatted + config.system_suffix;
        }

        return formatted;
    }

    /**
     * Format user message according to ChatML
     * @param {string} content - User message content
     * @param {Object} config - Instruction preset configuration
     * @returns {string} Formatted user message
     */
    formatUserMessage(content, config) {
        if (!content) {
            return '';
        }

        let formatted = content.trim();
        
        // Apply input sequence if wrap is enabled
        if (config.wrap && config.input_sequence) {
            formatted = config.input_sequence + formatted;
        }
        
        // Apply input suffix
        if (config.input_suffix) {
            formatted = formatted + config.input_suffix;
        }

        return formatted;
    }

    /**
     * Format assistant message according to ChatML
     * @param {string} content - Assistant message content
     * @param {Object} config - Instruction preset configuration
     * @returns {string} Formatted assistant message
     */
    formatAssistantMessage(content, config) {
        if (!content) {
            return '';
        }

        let formatted = content.trim();
        
        // Apply output sequence if wrap is enabled
        if (config.wrap && config.output_sequence) {
            formatted = config.output_sequence + formatted;
        }
        
        // Apply output suffix
        if (config.output_suffix) {
            formatted = formatted + config.output_suffix;
        }

        return formatted;
    }

    /**
     * Parse prompt into components
     * @param {string|Object} prompt - Prompt content
     * @returns {Object} Parsed components
     */
    parsePrompt(prompt) {
        if (typeof prompt === 'string') {
            return this.parseStringPrompt(prompt);
        } else if (typeof prompt === 'object' && prompt !== null) {
            return this.parseObjectPrompt(prompt);
        } else {
            throw new Error('OpenAIConverter: Invalid prompt format');
        }
    }

    /**
     * Parse string prompt into components
     * @param {string} prompt - String prompt
     * @returns {Object} Parsed components
     */
    parseStringPrompt(prompt) {
        const components = {
            system: '',
            user: '',
            assistant: ''
        };

        // Simple parsing for string prompts
        // Look for system/user/assistant markers
        const lines = prompt.split('\n');
        let currentSection = 'user';

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('### System:') || trimmedLine.startsWith('<|im_start|>system')) {
                currentSection = 'system';
                components.system = trimmedLine.replace(/^### System:\s*|<\|im_start\|>system\s*/, '');
            } else if (trimmedLine.startsWith('### User:') || trimmedLine.startsWith('<|im_start|>user')) {
                currentSection = 'user';
                components.user = trimmedLine.replace(/^### User:\s*|<\|im_start\|>user\s*/, '');
            } else if (trimmedLine.startsWith('### Assistant:') || trimmedLine.startsWith('<|im_start|>assistant')) {
                currentSection = 'assistant';
                components.assistant = trimmedLine.replace(/^### Assistant:\s*|<\|im_start\|>assistant\s*/, '');
            } else if (trimmedLine) {
                // Add to current section
                if (components[currentSection]) {
                    components[currentSection] += '\n' + trimmedLine;
                } else {
                    components[currentSection] = trimmedLine;
                }
            }
        }

        // Clean up ChatML suffixes from content
        components.system = components.system.replace(/<\|im_end\|>.*$/, '').trim();
        components.user = components.user.replace(/<\|im_end\|>.*$/, '').trim();
        components.assistant = components.assistant.replace(/<\|im_end\|>.*$/, '').trim();

        // If no specific sections found, treat as user message
        if (!components.system && !components.user && !components.assistant) {
            components.user = prompt;
        }

        return components;
    }

    /**
     * Parse object prompt into components
     * @param {Object} prompt - Object prompt
     * @returns {Object} Parsed components
     */
    parseObjectPrompt(prompt) {
        const components = {
            system: '',
            user: '',
            assistant: ''
        };

        // Handle different object formats
        if (prompt.messages && Array.isArray(prompt.messages)) {
            // OpenAI format messages array
            for (const message of prompt.messages) {
                const role = this.normalizeRole(message.role);
                if (role === 'system') {
                    components.system = message.content || '';
                } else if (role === 'user') {
                    components.user = message.content || '';
                } else if (role === 'assistant') {
                    components.assistant = message.content || '';
                }
            }
        } else if (prompt.system || prompt.user || prompt.assistant) {
            // Direct component format
            components.system = prompt.system || '';
            components.user = prompt.user || '';
            components.assistant = prompt.assistant || '';
        } else if (prompt.content) {
            // Simple content format
            components.user = prompt.content;
        } else {
            throw new Error('OpenAIConverter: Unrecognized object prompt format');
        }

        return components;
    }

    /**
     * Normalize role to OpenAI format
     * @param {string} role - Input role
     * @returns {string} Normalized role
     */
    normalizeRole(role) {
        if (!role) return 'user';
        
        const normalized = role.toLowerCase().trim();
        return this.roleMapping[normalized] || 'user';
    }

    /**
     * Optimize tokens for OpenAI format
     * @param {Array} messages - OpenAI format messages
     * @param {number} maxTokens - Maximum tokens allowed
     */
    optimizeTokens(messages, maxTokens) {
        const currentTokens = this.estimateTokens(messages);
        
        if (currentTokens <= maxTokens) {
            return; // No optimization needed
        }

        const availableTokens = maxTokens - this.tokenEstimates.safetyMargin;
        let remainingTokens = availableTokens;

        // Create a copy of messages to work with
        const originalMessages = [...messages];
        const optimizedMessages = [];

        // Prioritize system message, then user, then assistant
        const priorityOrder = ['system', 'user', 'assistant'];
        
        for (const priority of priorityOrder) {
            const message = originalMessages.find(m => m.role === priority);
            if (!message) continue;

            const messageTokens = this.estimateTokens([message]);
            
            if (messageTokens <= remainingTokens) {
                optimizedMessages.push({ ...message });
                remainingTokens -= messageTokens;
            } else {
                // Truncate message to fit remaining tokens
                const maxChars = Math.floor(remainingTokens * this.tokenEstimates.averageCharsPerToken);
                const truncatedMessage = {
                    ...message,
                    content: this.truncateText(message.content, maxChars, '...')
                };
                optimizedMessages.push(truncatedMessage);
                remainingTokens = 0;
                break;
            }
        }

        // Replace original messages with optimized ones
        messages.splice(0, messages.length, ...optimizedMessages);
    }

    /**
     * Estimate token count for OpenAI format
     * @param {Array|string} content - Content to estimate
     * @returns {number} Estimated token count
     */
    estimateTokens(content) {
        if (Array.isArray(content)) {
            // OpenAI messages array
            return content.reduce((total, message) => {
                return total + this.estimateTokens(message.content);
            }, 0);
        } else if (typeof content === 'string') {
            // Simple string estimation
            return Math.ceil(content.length / this.tokenEstimates.averageCharsPerToken);
        } else {
            return 0;
        }
    }

    /**
     * Truncate text to fit token limit
     * @param {string} text - Text to truncate
     * @param {number} maxChars - Maximum characters
     * @param {string} suffix - Truncation suffix
     * @returns {string} Truncated text
     */
    truncateText(text, maxChars, suffix = '...') {
        if (!text || text.length <= maxChars) {
            return text;
        }

        const truncated = text.substring(0, maxChars - suffix.length);
        return truncated + suffix;
    }

    /**
     * Validate input prompt
     * @param {string|Object} prompt - Prompt to validate
     * @param {Object} config - Instruction preset configuration
     */
    validateInput(prompt, config) {
        if (!prompt) {
            throw new Error('OpenAIConverter: Prompt is required');
        }

        if (typeof prompt !== 'string' && typeof prompt !== 'object') {
            throw new Error('OpenAIConverter: Prompt must be string or object');
        }

        if (!config || typeof config !== 'object') {
            throw new Error('OpenAIConverter: Valid instruction preset configuration is required');
        }

        // Validate required config fields
        const requiredFields = ['input_sequence', 'output_sequence', 'system_sequence'];
        for (const field of requiredFields) {
            if (!(field in config)) {
                throw new Error(`OpenAIConverter: Missing required config field: ${field}`);
            }
        }
    }

    /**
     * Validate output format
     * @param {Array} messages - OpenAI format messages
     * @param {Object} config - Instruction preset configuration
     */
    validateOutput(messages, config) {
        if (!Array.isArray(messages)) {
            throw new Error('OpenAIConverter: Output must be messages array');
        }

        if (messages.length === 0) {
            throw new Error('OpenAIConverter: At least one message is required');
        }

        // Validate each message
        for (const message of messages) {
            if (!message.role || !message.content) {
                throw new Error('OpenAIConverter: Each message must have role and content');
            }

            if (!['system', 'user', 'assistant'].includes(message.role)) {
                throw new Error(`OpenAIConverter: Invalid role: ${message.role}`);
            }

            if (typeof message.content !== 'string') {
                throw new Error('OpenAIConverter: Message content must be string');
            }
        }
    }

    /**
     * Convert to ChatML format string
     * @param {Array} messages - OpenAI format messages
     * @param {Object} config - Instruction preset configuration
     * @returns {string} ChatML format string
     */
    toChatMLString(messages, config) {
        let chatml = '';

        for (const message of messages) {
            if (message.role === 'system') {
                chatml += config.system_sequence + message.content + config.system_suffix;
            } else if (message.role === 'user') {
                chatml += config.input_sequence + message.content + config.input_suffix;
            } else if (message.role === 'assistant') {
                chatml += config.output_sequence + message.content + config.output_suffix;
            }
        }

        return chatml;
    }

    /**
     * Get conversion statistics
     * @param {Object} originalPrompt - Original prompt
     * @param {Object} convertedPrompt - Converted prompt
     * @returns {Object} Conversion statistics
     */
    getConversionStats(originalPrompt, convertedPrompt) {
        const originalLength = typeof originalPrompt === 'string' 
            ? originalPrompt.length 
            : JSON.stringify(originalPrompt).length;
        
        const convertedLength = JSON.stringify(convertedPrompt).length;
        const estimatedTokens = this.estimateTokens(convertedPrompt.messages);

        return {
            originalLength,
            convertedLength,
            estimatedTokens,
            compressionRatio: originalLength > 0 ? convertedLength / originalLength : 1,
            tokenEfficiency: estimatedTokens > 0 ? convertedLength / estimatedTokens : 0
        };
    }
}

module.exports = OpenAIConverter; 