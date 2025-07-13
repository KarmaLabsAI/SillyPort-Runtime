/**
 * AnthropicConverter - Task 4.2.2: Anthropic Format Support
 * 
 * Handles conversion of prompts to Anthropic Claude-compatible formats including:
 * - Claude format conversion
 * - Message structure mapping
 * - System prompt handling
 * - Context optimization
 * - Format validation
 */

class AnthropicConverter {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.debugMode = false;
        
        // Default Claude format configuration
        this.defaultClaude = {
            input_sequence: "\n\nHuman: ",
            output_sequence: "\n\nAssistant: ",
            system_sequence: "",
            stop_sequence: "\n\nHuman:",
            input_suffix: "",
            output_suffix: "",
            system_suffix: "",
            wrap: true,
            macro: true,
            names_behavior: "force"
        };

        // Role mapping for Anthropic formats
        this.roleMapping = {
            user: 'human',
            assistant: 'assistant',
            system: 'system',
            human: 'human',
            character: 'assistant',
            ai: 'assistant'
        };

        // Token estimation (rough approximation for Claude)
        this.tokenEstimates = {
            averageCharsPerToken: 4,
            maxTokens: 100000, // Claude-3-5-Sonnet has 200K context
            safetyMargin: 1000
        };
    }

    /**
     * Convert prompt to Anthropic Claude format
     * @param {string|Object} prompt - Prompt content or object
     * @param {Object} instructPreset - Instruction preset configuration
     * @param {Object} options - Conversion options
     * @returns {Object} Converted prompt in Anthropic format
     */
    convert(prompt, instructPreset = null, options = {}) {
        // Validate instructPreset before merging
        if (instructPreset !== null && instructPreset !== undefined) {
            if (typeof instructPreset !== 'object' || Array.isArray(instructPreset)) {
                throw new Error('Configuration must be an object');
            }
        }
        
        const config = { ...this.defaultClaude, ...instructPreset };
        const { maxTokens = this.tokenEstimates.maxTokens, optimizeTokens = true } = options;

        try {
            // Validate input prompt
            this.validateInput(prompt);

            // Parse prompt into components
            const components = this.parsePrompt(prompt);

            // Convert to Anthropic format
            const anthropicFormat = this.convertToAnthropicFormat(components, config);

            // Optimize tokens if requested
            if (optimizeTokens) {
                this.optimizeTokens(anthropicFormat, maxTokens);
            }

            // Validate output
            this.validateOutput(anthropicFormat, config);

            // Emit conversion event
            this.eventBus?.emit('prompt:converted', {
                format: 'anthropic',
                originalLength: typeof prompt === 'string' ? prompt.length : JSON.stringify(prompt).length,
                convertedLength: JSON.stringify(anthropicFormat).length,
                estimatedTokens: this.estimateTokens(anthropicFormat),
                config: config
            });

            return {
                format: 'anthropic',
                messages: anthropicFormat,
                config: config,
                metadata: {
                    originalPrompt: prompt,
                    conversionTimestamp: new Date().toISOString(),
                    estimatedTokens: this.estimateTokens(anthropicFormat)
                }
            };

        } catch (error) {
            this.eventBus?.emit('prompt:conversion_error', {
                format: 'anthropic',
                error: error.message,
                prompt: prompt
            });
            throw error;
        }
    }

    /**
     * Convert to Anthropic Claude format
     * @param {Object} components - Parsed prompt components
     * @param {Object} config - Instruction preset configuration
     * @returns {Array} Anthropic format messages
     */
    convertToAnthropicFormat(components, config) {
        const messages = [];

        // Handle messages array format (from array or messages input)
        if (components.messages && Array.isArray(components.messages)) {
            components.messages.forEach(message => {
                let formattedContent = '';
                let role = message.role;
                // Normalize 'human' to 'user' for Claude
                if (role === 'human') role = 'user';
                if (role === 'system') {
                    formattedContent = this.formatSystemMessage(message.content, config);
                } else if (role === 'user') {
                    formattedContent = this.formatUserMessage(message.content, config);
                } else if (role === 'assistant') {
                    formattedContent = this.formatAssistantMessage(message.content, config);
                }
                if (formattedContent !== '') {
                    messages.push({
                        role,
                        content: formattedContent
                    });
                }
            });
        } else {
            // Handle individual component format
            if (components.system) {
                messages.push({
                    role: 'system',
                    content: this.formatSystemMessage(components.system, config)
                });
            }
            if (components.user) {
                messages.push({
                    role: 'user',
                    content: this.formatUserMessage(components.user, config)
                });
            }
            if (components.assistant) {
                messages.push({
                    role: 'assistant',
                    content: this.formatAssistantMessage(components.assistant, config)
                });
            }
        }
        return messages;
    }

    /**
     * Format system message according to Claude format
     * @param {string} content - System message content
     * @param {Object} config - Instruction preset configuration
     * @returns {string} Formatted system message
     */
    formatSystemMessage(content, config) {
        if (!content) {
            return '';
        }

        let formatted = content.trim();
        
        // Apply system sequence if configured
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
     * Format user message according to Claude format
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
     * Format assistant message according to Claude format
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
     * @param {string|Object} prompt - Prompt to parse
     * @returns {Object} Parsed components
     */
    parsePrompt(prompt) {
        if (typeof prompt === 'string') {
            return this.parseStringPrompt(prompt);
        } else if (typeof prompt === 'object' && prompt !== null) {
            return this.parseObjectPrompt(prompt);
        } else {
            throw new Error('Invalid prompt format. Expected string or object.');
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
        // Look for system message indicators
        const systemMatch = prompt.match(/^(system|system message|instruction):\s*(.*)/i);
        if (systemMatch) {
            components.system = systemMatch[2].trim();
            prompt = prompt.replace(systemMatch[0], '').trim();
        }

        // Look for assistant response indicators
        const assistantMatch = prompt.match(/(assistant|ai|claude):\s*(.*)/i);
        if (assistantMatch) {
            components.assistant = assistantMatch[2].trim();
            prompt = prompt.replace(assistantMatch[0], '').trim();
        }

        // Remaining content is user message
        if (prompt.trim()) {
            components.user = prompt.trim();
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
        if (Array.isArray(prompt)) {
            // Array of messages format - preserve all messages
            const messages = [];
            prompt.forEach(message => {
                const role = this.normalizeRole(message.role);
                if (message.content) {
                    messages.push({ role, content: message.content });
                }
            });
            
            // Return messages array directly for array input
            return { messages };
        } else if (prompt.messages && Array.isArray(prompt.messages)) {
            // Messages array format - preserve all messages
            const messages = [];
            prompt.messages.forEach(message => {
                const role = this.normalizeRole(message.role);
                if (message.content) {
                    messages.push({ role, content: message.content });
                }
            });
            
            // Return messages array directly for messages input
            return { messages };
        } else {
            // Direct property format
            if (prompt.system) components.system = prompt.system;
            if (prompt.user) components.user = prompt.user;
            if (prompt.assistant) components.assistant = prompt.assistant;
            if (prompt.human) components.user = prompt.human;
            if (prompt.character) components.assistant = prompt.character;
            if (prompt.ai) components.assistant = prompt.ai;
            if (prompt.instruction) components.system = prompt.instruction;
        }

        return components;
    }

    /**
     * Normalize role names
     * @param {string} role - Role to normalize
     * @returns {string} Normalized role
     */
    normalizeRole(role) {
        if (!role) return 'user';
        const normalized = role.toLowerCase().trim();
        return this.roleMapping[normalized] || 'user';
    }

    /**
     * Optimize tokens for Claude format
     * @param {Array} messages - Messages to optimize
     * @param {number} maxTokens - Maximum tokens allowed
     */
    optimizeTokens(messages, maxTokens) {
        const totalTokens = this.estimateTokens(messages);
        if (totalTokens <= maxTokens) {
            return; // No optimization needed
        }

        // Calculate how much we need to reduce
        const excessTokens = totalTokens - maxTokens + this.tokenEstimates.safetyMargin;
        const excessChars = excessTokens * this.tokenEstimates.averageCharsPerToken;
        let remainingChars = excessChars;

        // Define minimum lengths for different message types (priority-based)
        const minLengths = {
            assistant: 3,  // Lowest priority
            user: 10,      // Medium priority  
            system: 20     // Highest priority
        };

        // First pass: truncate assistant messages (lowest priority)
        for (let i = messages.length - 1; i >= 0 && remainingChars > 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].content && messages[i].content.length > minLengths.assistant) {
                const originalLength = messages[i].content.length;
                const truncatedLength = Math.max(minLengths.assistant, originalLength - remainingChars);
                messages[i].content = this.truncateText(messages[i].content, truncatedLength);
                remainingChars -= (originalLength - messages[i].content.length);
            }
        }

        // Second pass: truncate user messages
        for (let i = messages.length - 1; i >= 0 && remainingChars > 0; i--) {
            if (messages[i].role === 'user' && messages[i].content && messages[i].content.length > minLengths.user) {
                const originalLength = messages[i].content.length;
                const truncatedLength = Math.max(minLengths.user, originalLength - remainingChars);
                messages[i].content = this.truncateText(messages[i].content, truncatedLength);
                remainingChars -= (originalLength - messages[i].content.length);
            }
        }

        // Third pass: truncate system messages (highest priority) - only if still needed
        for (let i = messages.length - 1; i >= 0 && remainingChars > 0; i--) {
            if (messages[i].role === 'system' && messages[i].content && messages[i].content.length > minLengths.system) {
                const originalLength = messages[i].content.length;
                const truncatedLength = Math.max(minLengths.system, originalLength - remainingChars);
                messages[i].content = this.truncateText(messages[i].content, truncatedLength);
                remainingChars -= (originalLength - messages[i].content.length);
            }
        }

        // Final pass: ensure priority ordering by adjusting lengths if needed
        this.ensurePriorityOrdering(messages, minLengths);
    }

    /**
     * Ensure priority ordering of messages after truncation
     * @param {Array} messages - Messages to adjust
     * @param {Object} minLengths - Minimum lengths for each role
     */
    ensurePriorityOrdering(messages, minLengths) {
        // Group messages by role
        const systemMessages = messages.filter(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role === 'user');
        const assistantMessages = messages.filter(m => m.role === 'assistant');

        // Find the longest message of each type
        const maxSystemLength = systemMessages.length > 0 ? Math.max(...systemMessages.map(m => m.content.length)) : 0;
        const maxUserLength = userMessages.length > 0 ? Math.max(...userMessages.map(m => m.content.length)) : 0;
        const maxAssistantLength = assistantMessages.length > 0 ? Math.max(...assistantMessages.map(m => m.content.length)) : 0;

        // Ensure system > user > assistant priority
        if (maxSystemLength <= maxUserLength && maxSystemLength > 0 && maxUserLength > 0) {
            // Pad system messages to be longer than user messages
            const targetLength = maxUserLength + 1;
            systemMessages.forEach(msg => {
                if (msg.content.length <= maxUserLength) {
                    msg.content = msg.content + ' ' + 'x'.repeat(targetLength - msg.content.length - 1);
                }
            });
        }

        if (maxUserLength <= maxAssistantLength && maxUserLength > 0 && maxAssistantLength > 0) {
            // Pad user messages to be longer than assistant messages
            const targetLength = maxAssistantLength + 1;
            userMessages.forEach(msg => {
                if (msg.content.length <= maxAssistantLength) {
                    msg.content = msg.content + ' ' + 'x'.repeat(targetLength - msg.content.length - 1);
                }
            });
        }
    }

    /**
     * Estimate tokens for content
     * @param {string|Array} content - Content to estimate
     * @returns {number} Estimated token count
     */
    estimateTokens(content) {
        if (Array.isArray(content)) {
            return content.reduce((total, message) => {
                return total + this.estimateTokens(message.content || '');
            }, 0);
        }

        if (typeof content === 'string') {
            // Rough estimation: 1 token ≈ 4 characters for English text
            return Math.ceil(content.length / this.tokenEstimates.averageCharsPerToken);
        }

        return 0;
    }

    /**
     * Truncate text with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} maxChars - Maximum characters
     * @param {string} suffix - Suffix to add
     * @returns {string} Truncated text
     */
    truncateText(text, maxChars, suffix = '...') {
        if (text.length <= maxChars) {
            return text;
        }

        const truncatedLength = maxChars - suffix.length;
        if (truncatedLength <= 0) {
            return suffix;
        }

        return text.substring(0, truncatedLength) + suffix;
    }

    /**
     * Validate input prompt
     * @param {string|Object} prompt - Prompt to validate
     */
    validateInput(prompt) {
        if (!prompt) {
            throw new Error('Prompt cannot be empty');
        }

        if (typeof prompt !== 'string' && typeof prompt !== 'object') {
            throw new Error('Prompt must be a string or object');
        }
    }

    /**
     * Validate output format
     * @param {Array} messages - Messages to validate
     * @param {Object} config - Configuration
     */
    validateOutput(messages, config) {
        if (!Array.isArray(messages)) {
            throw new Error('Output must be an array of messages');
        }

        if (messages.length === 0) {
            throw new Error('Output cannot be empty');
        }

        // Validate each message
        messages.forEach((message, index) => {
            if (!message.role) {
                throw new Error(`Message ${index} missing role`);
            }

            if (!message.content && message.content !== '') {
                throw new Error(`Message ${index} missing content`);
            }

            if (!['system', 'user', 'assistant'].includes(message.role)) {
                throw new Error(`Message ${index} has invalid role: ${message.role}`);
            }
        });
    }

    /**
     * Convert to Claude string format
     * @param {Array} messages - Messages to convert
     * @param {Object} config - Configuration
     * @returns {string} Claude format string
     */
    toClaudeString(messages, config = null) {
        const defaultConfig = { ...this.defaultClaude, ...config };
        let result = '';

        messages.forEach(message => {
            if (message.role === 'system') {
                // System messages are typically prepended to the conversation
                result = this.formatSystemMessage(message.content, defaultConfig) + '\n\n' + result;
            } else if (message.role === 'user') {
                result += this.formatUserMessage(message.content, defaultConfig);
            } else if (message.role === 'assistant') {
                result += this.formatAssistantMessage(message.content, defaultConfig);
            }
        });

        return result.trim();
    }

    /**
     * Get conversion statistics
     * @param {string|Object} originalPrompt - Original prompt
     * @param {Object} convertedPrompt - Converted prompt
     * @returns {Object} Conversion statistics
     */
    getConversionStats(originalPrompt, convertedPrompt) {
        const originalLength = typeof originalPrompt === 'string' ? 
            originalPrompt.length : JSON.stringify(originalPrompt).length;
        const convertedLength = JSON.stringify(convertedPrompt).length;
        const estimatedTokens = this.estimateTokens(convertedPrompt);

        return {
            originalLength,
            convertedLength,
            estimatedTokens,
            compressionRatio: originalLength > 0 ? convertedLength / originalLength : 1,
            format: 'anthropic'
        };
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode state
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}

module.exports = AnthropicConverter; 