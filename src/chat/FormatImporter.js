/**
 * FormatImporter - Task 3.2.1: Oobabooga Format Support
 * 
 * Handles importing chat conversations from various formats including:
 * - Oobabooga format (text-generation-webui)
 * - Agnai format
 * - Character.AI Tools format
 * - SillyTavern format
 */

class FormatImporter {
    constructor(eventBus, chatManager) {
        this.eventBus = eventBus;
        this.chatManager = chatManager;
        this.debugMode = false;
        
        // Supported formats registry
        this.supportedFormats = {
            oobabooga: {
                name: 'Oobabooga',
                description: 'text-generation-webui conversation format',
                extensions: ['.txt'],
                detect: (data) => this.detectOobaboogaFormat(data),
                parse: (data) => this.parseOobaboogaMessages(data),
                import: (data, options) => this.importOobaboogaChat(data, options)
            },
            agnai: {
                name: 'Agnai',
                description: 'Agnai chat export format',
                extensions: ['.json'],
                detect: (data) => this.detectAgnaiFormat(data),
                parse: (data) => this.parseAgnaiMessages(data),
                import: (data, options) => this.importAgnaiChat(data, options)
            },
            caiTools: {
                name: 'CAI Tools',
                description: 'Character.AI Tools export format',
                extensions: ['.json'],
                detect: (data) => this.detectCaiToolsFormat(data),
                parse: (data) => this.parseCaiToolsMessages(data),
                import: (data, options) => this.importCaiToolsChat(data, options)
            },
            sillytavern: {
                name: 'SillyTavern',
                description: 'SillyTavern native format',
                extensions: ['.json'],
                detect: (data) => this.detectSillyTavernFormat(data),
                parse: (data) => this.parseSillyTavernMessages(data),
                import: (data, options) => this.importSillyTavernChat(data, options)
            }
        };
    }

    /**
     * Detect the format of the provided data
     * @param {string|Object} data - Data to analyze
     * @returns {string|null} Format name or null if unknown
     */
    detectFormat(data) {
        if (data === null || data === undefined) {
            throw new Error('FormatImporter: Data is required for format detection');
        }

        // Try each format detector
        for (const [formatName, format] of Object.entries(this.supportedFormats)) {
            if (format.detect(data)) {
                if (this.debugMode) {
                    console.log(`FormatImporter: Detected format: ${formatName}`);
                }
                return formatName;
            }
        }

        if (this.debugMode) {
            console.log('FormatImporter: No format detected');
        }
        return null;
    }

    /**
     * Detect Oobabooga format
     * @param {string} data - Data to check
     * @returns {boolean} True if Oobabooga format
     */
    detectOobaboogaFormat(data) {
        if (typeof data !== 'string') {
            return false;
        }

        // Look for Oobabooga message headers
        const oobaboogaPattern = /^### (Human|Assistant):/m;
        return oobaboogaPattern.test(data);
    }

    /**
     * Detect Agnai format
     * @param {Object} data - Data to check
     * @returns {boolean} True if Agnai format
     */
    detectAgnaiFormat(data) {
        if (typeof data !== 'object' || data === null) {
            return false;
        }

        return (
            Array.isArray(data.messages) &&
            typeof data.userId === 'string' &&
            typeof data.characterId === 'string'
        );
    }

    /**
     * Detect CAI Tools format
     * @param {Object} data - Data to check
     * @returns {boolean} True if CAI Tools format
     */
    detectCaiToolsFormat(data) {
        if (typeof data !== 'object' || data === null) {
            return false;
        }

        return (
            Array.isArray(data.history) &&
            typeof data.character_name === 'string' &&
            typeof data.user_name === 'string' &&
            !data.chat_metadata // Distinguishes from SillyTavern
        );
    }

    /**
     * Detect SillyTavern format
     * @param {Object} data - Data to check
     * @returns {boolean} True if SillyTavern format
     */
    detectSillyTavernFormat(data) {
        if (typeof data !== 'object' || data === null) {
            return false;
        }

        return (
            Array.isArray(data.messages) &&
            typeof data.character_name === 'string' &&
            typeof data.user_name === 'string' &&
            typeof data.chat_metadata === 'object'
        );
    }

    /**
     * Parse Oobabooga format messages
     * @param {string} text - Oobabooga format text
     * @returns {Array} Array of parsed messages
     */
    parseOobaboogaMessages(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const messages = [];
        const lines = text.split('\n');
        let currentMessage = null;
        let currentContent = [];
        let lineNumber = 0;

        for (const line of lines) {
            lineNumber++;
            
            // Check for message headers
            const headerMatch = line.match(/^### (Human|Assistant):\s*(.*)$/);
            
            if (headerMatch) {
                // Save previous message if it exists
                if (currentMessage) {
                    currentMessage.content = currentContent.join('\n').trim();
                    if (currentMessage.content) {
                        messages.push(currentMessage);
                    }
                }

                // Start new message
                const role = headerMatch[1].toLowerCase() === 'human' ? 'user' : 'assistant';
                const contentOnHeaderLine = headerMatch[2].trim();
                
                currentMessage = {
                    sender: role,
                    role: role,
                    content: '',
                    timestamp: Date.now() + messages.length, // Ensure unique timestamps
                    metadata: {
                        originalFormat: 'oobabooga',
                        lineNumber: lineNumber
                    }
                };

                currentContent = contentOnHeaderLine ? [contentOnHeaderLine] : [];
            } else if (currentMessage) {
                // Add content to current message
                currentContent.push(line);
            }
        }

        // Add final message
        if (currentMessage) {
            currentMessage.content = currentContent.join('\n').trim();
            if (currentMessage.content) {
                messages.push(currentMessage);
            }
        }

        return messages;
    }

    /**
     * Parse Agnai format messages
     * @param {Object} data - Agnai format data
     * @returns {Array} Array of parsed messages
     */
    parseAgnaiMessages(data) {
        if (!data || typeof data !== 'object') {
            return [];
        }

        if (!Array.isArray(data.messages)) {
            return [];
        }

        const messages = [];
        let messageIndex = 0;

        for (const message of data.messages) {
            messageIndex++;
            
            // Validate required fields
            if (!message.id || !message.content || !message.role) {
                if (this.debugMode) {
                    console.log(`FormatImporter: Skipping invalid Agnai message at index ${messageIndex}`, message);
                }
                continue;
            }

            // Normalize role to standard format
            let normalizedRole = message.role.toLowerCase();
            if (normalizedRole === 'human') {
                normalizedRole = 'user';
            } else if (normalizedRole === 'assistant' || normalizedRole === 'character') {
                normalizedRole = 'assistant';
            }

            // Create parsed message object
            const parsedMessage = {
                id: message.id,
                sender: normalizedRole,
                role: normalizedRole,
                content: message.content.trim(),
                timestamp: message.timestamp || Date.now() + messageIndex, // Ensure unique timestamps
                metadata: {
                    originalFormat: 'agnai',
                    originalRole: message.role,
                    messageIndex: messageIndex,
                    agnaiId: message.id
                }
            };

            // Add additional metadata if available
            if (message.metadata) {
                parsedMessage.metadata.originalMetadata = message.metadata;
            }

            if (message.avatar) {
                parsedMessage.metadata.avatar = message.avatar;
            }

            if (message.name) {
                parsedMessage.metadata.originalName = message.name;
            }

            messages.push(parsedMessage);
        }

        if (this.debugMode) {
            console.log(`FormatImporter: Parsed ${messages.length} Agnai messages`);
        }

        return messages;
    }

    /**
     * Parse CAI Tools format messages
     * @param {Object} data - CAI Tools format data
     * @returns {Array} Array of parsed messages
     */
    parseCaiToolsMessages(data) {
        if (!data || typeof data !== 'object') {
            return [];
        }

        if (!Array.isArray(data.history)) {
            return [];
        }

        const messages = [];
        let messageIndex = 0;

        for (const message of data.history) {
            messageIndex++;
            
            // Validate required fields
            if (!message.id || !message.content || !message.role) {
                if (this.debugMode) {
                    console.log(`FormatImporter: Skipping invalid CAI Tools message at index ${messageIndex}`, message);
                }
                continue;
            }

            // Normalize role to standard format
            let normalizedRole = message.role.toLowerCase();
            if (normalizedRole === 'human' || normalizedRole === 'user') {
                normalizedRole = 'user';
            } else if (normalizedRole === 'assistant' || normalizedRole === 'character' || normalizedRole === 'ai') {
                normalizedRole = 'assistant';
            }

            // Create parsed message object
            const parsedMessage = {
                id: message.id,
                sender: normalizedRole,
                role: normalizedRole,
                content: message.content.trim(),
                timestamp: message.timestamp || Date.now() + messageIndex, // Ensure unique timestamps
                metadata: {
                    originalFormat: 'caiTools',
                    originalRole: message.role,
                    messageIndex: messageIndex,
                    caiToolsId: message.id
                }
            };

            // Add additional metadata if available
            if (message.metadata) {
                parsedMessage.metadata.originalMetadata = message.metadata;
            }

            // Add character attribution if available
            if (data.character_name && normalizedRole === 'assistant') {
                parsedMessage.metadata.characterName = data.character_name;
            }

            // Add user attribution if available
            if (data.user_name && normalizedRole === 'user') {
                parsedMessage.metadata.userName = data.user_name;
            }

            messages.push(parsedMessage);
        }

        if (this.debugMode) {
            console.log(`FormatImporter: Parsed ${messages.length} CAI Tools messages from ${data.history.length} history entries`);
        }

        return messages;
    }

    /**
     * Parse SillyTavern format messages (placeholder implementation)
     * @param {Object} data - SillyTavern format data
     * @returns {Array} Array of parsed messages
     */
    parseSillyTavernMessages(data) {
        // Placeholder implementation
        return [];
    }

    /**
     * Import chat from any supported format
     * @param {string|Object} data - Chat data to import
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importChat(data, options = {}) {
        if (data === null || data === undefined) {
            throw new Error('FormatImporter: Data is required for import');
        }

        // Check if format is explicitly specified
        const explicitFormat = options.format;
        if (explicitFormat) {
            if (!this.supportedFormats[explicitFormat]) {
                throw new Error(`FormatImporter: Import not implemented for ${explicitFormat}`);
            }
            const formatHandler = this.supportedFormats[explicitFormat];
            return await formatHandler.import(data, options);
        }

        const format = this.detectFormat(data);
        
        if (!format) {
            throw new Error('FormatImporter: Unable to detect format');
        }

        const formatHandler = this.supportedFormats[format];
        return await formatHandler.import(data, options);
    }

    /**
     * Import Oobabooga format chat
     * @param {string} data - Oobabooga format text
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importOobaboogaChat(data, options = {}) {
        if (typeof data !== 'string') {
            throw new Error('FormatImporter: Oobabooga format requires string data');
        }

        const messages = this.parseOobaboogaMessages(data);
        
        if (messages.length === 0) {
            throw new Error('FormatImporter: No valid messages found in Oobabooga data');
        }

        // Create chat session
        const { participants = ['user', 'assistant'], metadata = {} } = options;
        const session = await this.chatManager.createChat(participants, {
            title: metadata.title || 'Imported Chat',
            metadata: {
                importFormat: 'oobabooga',
                importTimestamp: Date.now(),
                originalMessageCount: messages.length,
                ...metadata
            }
        });

        // Add messages to session
        const importedMessages = [];
        for (const message of messages) {
            const importedMessage = await this.chatManager.addMessage(
                session.id,
                message.sender,
                message.content,
                {
                    role: message.role,
                    timestamp: message.timestamp,
                    metadata: {
                        ...message.metadata,
                        imported: true
                    }
                }
            );
            importedMessages.push(importedMessage);
        }

        // Emit import event
        this.eventBus.emit('chat:imported', {
            format: 'oobabooga',
            sessionId: session.id,
            messageCount: messages.length,
            metadata: metadata
        });

        return {
            format: 'oobabooga',
            session: session,
            messages: importedMessages,
            messageCount: messages.length
        };
    }

    /**
     * Import Agnai format chat
     * @param {Object} data - Agnai format data
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importAgnaiChat(data, options = {}) {
        if (!data || typeof data !== 'object') {
            throw new Error('FormatImporter: Agnai format requires object data');
        }
        if (!Array.isArray(data.messages)) {
            throw new Error('FormatImporter: Agnai format requires messages array');
        }

        const messages = this.parseAgnaiMessages(data);
        
        if (messages.length === 0) {
            throw new Error('FormatImporter: No valid messages found in Agnai data');
        }

        // Extract Agnai-specific metadata
        const agnaiMetadata = {
            userId: data.userId || null,
            characterId: data.characterId || null,
            characterName: data.characterName || null
        };

        // Determine participants from messages and metadata
        const participants = options.participants || this.extractParticipantsFromAgnaiData(data, messages);

        // Create chat session
        const session = await this.chatManager.createChat(participants, {
            title: options.metadata?.title || `Imported Agnai Chat${agnaiMetadata.characterName ? ` - ${agnaiMetadata.characterName}` : ''}`,
            metadata: {
                importFormat: 'agnai',
                importTimestamp: Date.now(),
                originalMessageCount: messages.length,
                agnaiData: agnaiMetadata,
                ...options.metadata
            }
        });

        // Add messages to session
        const importedMessages = [];
        for (const message of messages) {
            const importedMessage = await this.chatManager.addMessage(
                session.id,
                message.sender,
                message.content,
                {
                    role: message.role,
                    timestamp: message.timestamp,
                    metadata: {
                        ...message.metadata,
                        imported: true,
                        agnaiId: message.id
                    }
                }
            );
            importedMessages.push(importedMessage);
        }

        // Emit import event
        this.eventBus.emit('chat:imported', {
            format: 'agnai',
            sessionId: session.id,
            messageCount: messages.length,
            metadata: {
                ...agnaiMetadata,
                ...options.metadata
            }
        });

        return {
            format: 'agnai',
            session: session,
            messages: importedMessages,
            messageCount: messages.length,
            agnaiMetadata: agnaiMetadata
        };
    }

    /**
     * Extract participants from Agnai data
     * @param {Object} data - Agnai format data
     * @param {Array} messages - Parsed messages
     * @returns {Array} Array of participant IDs
     */
    extractParticipantsFromAgnaiData(data, messages) {
        const participants = new Set();
        
        // Add character name if available
        if (data.characterName) {
            participants.add(data.characterName);
        }
        
        // Add user identifier
        if (data.userId) {
            participants.add(data.userId);
        } else {
            // Fallback to 'user' if no userId
            participants.add('user');
        }
        
        // Add participants from messages
        for (const message of messages) {
            if (message.sender && message.sender !== 'system') {
                participants.add(message.sender);
            }
        }
        
        return Array.from(participants);
    }

    /**
     * Import CAI Tools format chat
     * @param {Object} data - CAI Tools format data
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importCaiToolsChat(data, options = {}) {
        if (!data || typeof data !== 'object') {
            throw new Error('FormatImporter: CAI Tools format requires object data');
        }
        if (!Array.isArray(data.history)) {
            throw new Error('FormatImporter: CAI Tools format requires history array');
        }

        const messages = this.parseCaiToolsMessages(data);
        
        if (messages.length === 0) {
            throw new Error('FormatImporter: No valid messages found in CAI Tools data');
        }

        // Extract CAI Tools-specific metadata
        const caiMetadata = {
            characterName: data.character_name || null,
            userName: data.user_name || null
        };

        // Determine participants from messages and metadata
        const participants = options.participants || this.extractParticipantsFromCaiToolsData(data, messages);

        // Create chat session
        const session = await this.chatManager.createChat(participants, {
            title: options.metadata?.title || `Imported CAI Tools Chat${caiMetadata.characterName ? ` - ${caiMetadata.characterName}` : ''}`,
            metadata: {
                importFormat: 'caiTools',
                importTimestamp: Date.now(),
                originalMessageCount: messages.length,
                caiData: caiMetadata,
                ...options.metadata
            }
        });

        // Add messages to session with batch processing support
        const importedMessages = [];
        const batchSize = options.batchSize || 10; // Default batch size for performance
        
        try {
            // Process messages in batches for better performance and error recovery
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);
                
                // Process batch
                for (const message of batch) {
                    try {
                        const importedMessage = await this.chatManager.addMessage(
                            session.id,
                            message.sender,
                            message.content,
                            {
                                role: message.role,
                                timestamp: message.timestamp,
                                metadata: {
                                    ...message.metadata,
                                    imported: true,
                                    caiToolsId: message.id,
                                    batchIndex: Math.floor(i / batchSize)
                                }
                            }
                        );
                        importedMessages.push(importedMessage);
                    } catch (messageError) {
                        // Error recovery: log error but continue with other messages
                        if (this.debugMode) {
                            console.error(`FormatImporter: Failed to import CAI Tools message ${message.id}:`, messageError);
                        }
                        
                        // Emit error event for monitoring
                        this.eventBus.emit('chat:import:error', {
                            format: 'caiTools',
                            sessionId: session.id,
                            messageId: message.id,
                            error: messageError.message,
                            recoverable: true
                        });
                    }
                }
                
                // Emit batch progress event
                this.eventBus.emit('chat:import:progress', {
                    format: 'caiTools',
                    sessionId: session.id,
                    processed: Math.min(i + batchSize, messages.length),
                    total: messages.length,
                    batchIndex: Math.floor(i / batchSize)
                });
            }
        } catch (batchError) {
            // If batch processing fails completely, try individual message processing
            if (this.debugMode) {
                console.warn('FormatImporter: Batch processing failed, falling back to individual processing:', batchError);
            }
            
            // Clear any partially imported messages
            importedMessages.length = 0;
            
            // Process messages individually
            for (const message of messages) {
                try {
                    const importedMessage = await this.chatManager.addMessage(
                        session.id,
                        message.sender,
                        message.content,
                        {
                            role: message.role,
                            timestamp: message.timestamp,
                            metadata: {
                                ...message.metadata,
                                imported: true,
                                caiToolsId: message.id,
                                fallbackProcessing: true
                            }
                        }
                    );
                    importedMessages.push(importedMessage);
                } catch (messageError) {
                    if (this.debugMode) {
                        console.error(`FormatImporter: Failed to import CAI Tools message ${message.id} (fallback):`, messageError);
                    }
                }
            }
        }

        // Emit import completion event
        this.eventBus.emit('chat:imported', {
            format: 'caiTools',
            sessionId: session.id,
            messageCount: importedMessages.length,
            originalCount: messages.length,
            metadata: {
                ...caiMetadata,
                ...options.metadata
            }
        });

        return {
            format: 'caiTools',
            session: session,
            messages: importedMessages,
            messageCount: importedMessages.length,
            originalMessageCount: messages.length,
            caiMetadata: caiMetadata
        };
    }

    /**
     * Extract participants from CAI Tools data
     * @param {Object} data - CAI Tools format data
     * @param {Array} messages - Parsed messages
     * @returns {Array} Array of participant IDs
     */
    extractParticipantsFromCaiToolsData(data, messages) {
        const participants = new Set();
        
        // Add character name if available
        if (data.character_name) {
            participants.add(data.character_name);
        }
        
        // Add user name if available
        if (data.user_name) {
            participants.add(data.user_name);
        } else {
            // Fallback to 'user' if no user_name
            participants.add('user');
        }
        
        // Add participants from messages (fallback)
        for (const message of messages) {
            if (message.sender && message.sender !== 'system') {
                if (message.sender === 'user' && data.user_name) {
                    participants.add(data.user_name);
                } else if (message.sender === 'assistant' && data.character_name) {
                    participants.add(data.character_name);
                } else {
                    participants.add(message.sender);
                }
            }
        }
        
        return Array.from(participants);
    }

    /**
     * Import SillyTavern format chat (placeholder implementation)
     * @param {Object} data - SillyTavern format data
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importSillyTavernChat(data, options = {}) {
        if (!data || typeof data !== 'object') {
            throw new Error('FormatImporter: SillyTavern format requires messages array');
        }
        if (!Array.isArray(data.messages)) {
            throw new Error('FormatImporter: SillyTavern format requires messages array');
        }

        // Placeholder implementation for full SillyTavern import
        throw new Error('FormatImporter: SillyTavern format not yet implemented');
    }

    /**
     * Get supported formats
     * @returns {Object} Supported formats
     */
    getSupportedFormats() {
        return this.supportedFormats;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Validate import data for a specific format
     * @param {string|Object} data - Data to validate
     * @param {string} format - Format to validate against
     * @returns {boolean} True if valid
     */
    validateImportData(data, format) {
        if (data === null || data === undefined) {
            return false;
        }

        const formatHandler = this.supportedFormats[format];
        if (!formatHandler) {
            return false;
        }

        return formatHandler.detect(data);
    }
}

module.exports = { FormatImporter }; 