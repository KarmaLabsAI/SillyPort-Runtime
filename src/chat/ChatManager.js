/**
 * ChatManager - Chat session management for SillyTavern Browser Runtime
 * 
 * Manages chat sessions, message handling, and multi-character conversations.
 * Provides session creation, participant management, and message storage.
 */
class ChatManager {
    constructor(eventBus = null, stateManager = null, storageManager = null) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.storageManager = storageManager;
        
        this.sessions = new Map();
        this.sessionCounter = 0;
        this.debugMode = false;
        
        // Message counter for unique message IDs
        this.messageCounter = 0;
        
        // Session metadata
        this.sessionMetadata = new Map();
        
        // Participant tracking
        this.participants = new Map();
        
        // Message storage - Map of sessionId -> Array of messages
        this.messages = new Map();
        
        // Auto-save configuration
        this.autoSaveEnabled = true;
        this.autoSaveInterval = 30000; // 30 seconds
        this.autoSaveTimer = null;
        
        // Message history limits
        this.maxMessagesPerSession = 1000;
        this.maxMessageLength = 10000;
        
        // Initialize auto-save if enabled
        if (this.autoSaveEnabled) {
            this.startAutoSave();
        }
    }

    /**
     * Create a new chat session
     * @param {Array} participantIds - Array of character IDs participating in the chat
     * @param {Object} options - Optional configuration
     * @param {string} options.title - Custom session title
     * @param {Object} options.metadata - Additional session metadata
     * @param {boolean} options.autoActivate - Whether to activate this session immediately
     * @returns {Promise<Object>} The created chat session
     */
    async createChat(participantIds = [], options = {}) {
        if (!Array.isArray(participantIds)) {
            throw new Error('ChatManager: Participant IDs must be an array');
        }

        const { title = null, metadata = {}, autoActivate = true } = options;
        
        // Generate unique session ID
        const sessionId = this.generateSessionId();
        
        // Create session object
        const session = {
            id: sessionId,
            title: title || this.generateDefaultTitle(participantIds),
            participantIds: [...participantIds],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            isActive: false,
            metadata: {
                ...metadata,
                createdBy: 'ChatManager',
                version: '1.0.0'
            }
        };

        // Store session
        this.sessions.set(sessionId, session);
        
        // Initialize participant tracking
        this.participants.set(sessionId, new Set(participantIds));
        
        // Initialize session metadata
        this.sessionMetadata.set(sessionId, {
            lastMessageTime: null,
            totalMessages: 0,
            participantActivity: new Map(),
            customSettings: {}
        });

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:created', {
                sessionId,
                session,
                participantIds
            });
        }

        // Auto-activate if requested
        if (autoActivate) {
            await this.activateChat(sessionId);
        }

        if (this.debugMode) {
            console.log(`ChatManager: Created chat session '${sessionId}' with ${participantIds.length} participants`);
        }

        return session;
    }

    /**
     * Activate a chat session
     * @param {string} sessionId - The session ID to activate
     * @returns {Promise<boolean>} Success status
     */
    async activateChat(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        if (!this.sessions.has(sessionId)) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        // Deactivate current active session
        const currentActive = this.getActiveChat();
        if (currentActive) {
            currentActive.isActive = false;
            this.sessions.set(currentActive.id, currentActive);
            
            if (this.stateManager) {
                this.stateManager.setState(`chatSessions.${currentActive.id}`, currentActive);
            }
        }

        // Activate new session
        const session = this.sessions.get(sessionId);
        session.isActive = true;
        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
            this.stateManager.setState('activeChat', sessionId);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:activated', {
                sessionId,
                session,
                previousActive: currentActive?.id
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Activated chat session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Get the currently active chat session
     * @returns {Object|null} The active session or null
     */
    getActiveChat() {
        for (const session of this.sessions.values()) {
            if (session.isActive) {
                return session;
            }
        }
        return null;
    }

    /**
     * Get a chat session by ID
     * @param {string} sessionId - The session ID
     * @returns {Object|null} The session or null if not found
     */
    getChat(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            return null;
        }
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get all chat sessions
     * @param {Object} options - Optional filters
     * @param {boolean} options.activeOnly - Return only active sessions
     * @param {Array} options.participantIds - Filter by participant IDs
     * @returns {Array} Array of chat sessions
     */
    getAllChats(options = {}) {
        const { activeOnly = false, participantIds = null } = options;
        
        let sessions = Array.from(this.sessions.values());
        
        if (activeOnly) {
            sessions = sessions.filter(session => session.isActive);
        }
        
        if (participantIds && Array.isArray(participantIds)) {
            sessions = sessions.filter(session => 
                participantIds.some(id => session.participantIds.includes(id))
            );
        }
        
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Add participants to a chat session
     * @param {string} sessionId - The session ID
     * @param {Array} participantIds - Array of character IDs to add
     * @returns {Promise<boolean>} Success status
     */
    async addParticipants(sessionId, participantIds) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        if (!Array.isArray(participantIds)) {
            throw new Error('ChatManager: Participant IDs must be an array');
        }

        const session = this.getChat(sessionId);
        if (!session) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        // Add new participants
        const newParticipants = participantIds.filter(id => !session.participantIds.includes(id));
        if (newParticipants.length === 0) {
            return true; // No new participants to add
        }

        session.participantIds.push(...newParticipants);
        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update participant tracking
        const participantSet = this.participants.get(sessionId) || new Set();
        newParticipants.forEach(id => participantSet.add(id));
        this.participants.set(sessionId, participantSet);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:participants:added', {
                sessionId,
                session,
                addedParticipants: newParticipants
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Added ${newParticipants.length} participants to session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Remove participants from a chat session
     * @param {string} sessionId - The session ID
     * @param {Array} participantIds - Array of character IDs to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeParticipants(sessionId, participantIds) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        if (!Array.isArray(participantIds)) {
            throw new Error('ChatManager: Participant IDs must be an array');
        }

        const session = this.getChat(sessionId);
        if (!session) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        // Remove participants
        const removedParticipants = [];
        session.participantIds = session.participantIds.filter(id => {
            if (participantIds.includes(id)) {
                removedParticipants.push(id);
                return false;
            }
            return true;
        });

        if (removedParticipants.length === 0) {
            return true; // No participants to remove
        }

        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update participant tracking
        const participantSet = this.participants.get(sessionId) || new Set();
        removedParticipants.forEach(id => participantSet.delete(id));
        this.participants.set(sessionId, participantSet);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:participants:removed', {
                sessionId,
                session,
                removedParticipants
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Removed ${removedParticipants.length} participants from session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Delete a chat session
     * @param {string} sessionId - The session ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteChat(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        const session = this.getChat(sessionId);
        if (!session) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        // Remove from collections
        this.sessions.delete(sessionId);
        this.participants.delete(sessionId);
        this.sessionMetadata.delete(sessionId);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, undefined);
            
            // If this was the active chat, clear active chat
            if (this.stateManager.getState('activeChat') === sessionId) {
                this.stateManager.setState('activeChat', null);
            }
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:deleted', {
                sessionId,
                session
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Deleted chat session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Update session metadata
     * @param {string} sessionId - The session ID
     * @param {Object} metadata - Metadata to update
     * @returns {Promise<boolean>} Success status
     */
    async updateSessionMetadata(sessionId, metadata) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        const session = this.getChat(sessionId);
        if (!session) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        // Update metadata
        session.metadata = {
            ...session.metadata,
            ...metadata,
            lastUpdated: Date.now()
        };
        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:metadata:updated', {
                sessionId,
                session,
                updatedMetadata: metadata
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Updated metadata for session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Get session statistics
     * @param {string} sessionId - The session ID (optional, returns all if not provided)
     * @returns {Object} Session statistics
     */
    getSessionStats(sessionId = null) {
        if (sessionId) {
            const session = this.getChat(sessionId);
            if (!session) {
                return null;
            }

            const metadata = this.sessionMetadata.get(sessionId) || {};
            return {
                sessionId,
                participantCount: session.participantIds.length,
                messageCount: session.messageCount,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                isActive: session.isActive,
                totalMessages: metadata.totalMessages || 0,
                lastMessageTime: metadata.lastMessageTime
            };
        }

        // Return stats for all sessions
        const sessions = Array.from(this.sessions.values());
        return {
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.isActive).length,
            totalParticipants: sessions.reduce((sum, s) => sum + s.participantIds.length, 0),
            totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
            averageParticipants: sessions.length > 0 ? 
                sessions.reduce((sum, s) => sum + s.participantIds.length, 0) / sessions.length : 0
        };
    }

    /**
     * Start auto-save functionality
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(async () => {
            await this.saveSessions();
        }, this.autoSaveInterval);

        if (this.debugMode) {
            console.log(`ChatManager: Auto-save started (${this.autoSaveInterval}ms interval)`);
        }
    }

    /**
     * Stop auto-save functionality
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        if (this.debugMode) {
            console.log('ChatManager: Auto-save stopped');
        }
    }

    /**
     * Save all sessions to storage
     * @returns {Promise<boolean>} Success status
     */
    async saveSessions() {
        if (!this.storageManager) {
            return false;
        }

        try {
            const sessionsData = Array.from(this.sessions.entries());
            await this.storageManager.save('chatSessions', sessionsData);
            
            // Save messages for each session
            for (const [sessionId, messages] of this.messages) {
                await this.storageManager.save('chatMessages', sessionId, messages);
            }
            
            if (this.debugMode) {
                console.log(`ChatManager: Saved ${sessionsData.length} sessions and ${this.messages.size} message collections to storage`);
            }
            
            return true;
        } catch (error) {
            console.error('ChatManager: Error saving sessions:', error);
            return false;
        }
    }

    /**
     * Load sessions from storage
     * @returns {Promise<boolean>} Success status
     */
    async loadSessions() {
        if (!this.storageManager) {
            return false;
        }

        try {
            const sessionsData = await this.storageManager.load('chatSessions');
            if (sessionsData) {
                this.sessions = new Map(sessionsData);
                
                // Rebuild participant tracking
                this.participants.clear();
                for (const [sessionId, session] of this.sessions) {
                    this.participants.set(sessionId, new Set(session.participantIds));
                }
                
                // Load messages for each session
                this.messages.clear();
                for (const [sessionId, session] of this.sessions) {
                    const messages = await this.storageManager.load('chatMessages', sessionId);
                    if (messages && Array.isArray(messages)) {
                        this.messages.set(sessionId, messages);
                    } else {
                        this.messages.set(sessionId, []);
                    }
                }
                
                if (this.debugMode) {
                    console.log(`ChatManager: Loaded ${this.sessions.size} sessions and ${this.messages.size} message collections from storage`);
                }
            }
            
            return true;
        } catch (error) {
            console.error('ChatManager: Error loading sessions:', error);
            return false;
        }
    }

    /**
     * Generate a unique session ID
     * @returns {string} Unique session ID
     */
    generateSessionId() {
        this.sessionCounter++;
        return `chat_${Date.now()}_${this.sessionCounter}`;
    }

    /**
     * Generate a default title for a chat session
     * @param {Array} participantIds - Array of participant IDs
     * @returns {string} Default title
     */
    generateDefaultTitle(participantIds) {
        if (participantIds.length === 0) {
            return 'Empty Chat';
        }
        
        if (participantIds.length === 1) {
            return `Chat with ${participantIds[0]}`;
        }
        
        if (participantIds.length === 2) {
            return `Chat: ${participantIds[0]} & ${participantIds[1]}`;
        }
        
        return `Group Chat (${participantIds.length} participants)`;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (this.debugMode) {
            console.log('ChatManager: Debug mode enabled');
        }
    }

    /**
     * Get runtime statistics
     * @returns {Object} Runtime statistics
     */
    getStats() {
        const totalMessages = Array.from(this.messages.values()).reduce((sum, messages) => sum + messages.length, 0);
        return {
            totalSessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
            totalParticipants: Array.from(this.participants.values()).reduce((sum, set) => sum + set.size, 0),
            totalMessages: totalMessages,
            autoSaveEnabled: this.autoSaveEnabled,
            autoSaveInterval: this.autoSaveInterval,
            maxMessagesPerSession: this.maxMessagesPerSession,
            maxMessageLength: this.maxMessageLength,
            debugMode: this.debugMode
        };
    }

    /**
     * Create and add a message to a chat session
     * @param {string} sessionId - The session ID
     * @param {string} senderId - The sender's ID (character or user)
     * @param {string} content - The message content
     * @param {Object} options - Optional message options
     * @param {string} options.role - Message role (user, assistant, system)
     * @param {Object} options.metadata - Additional message metadata
     * @param {boolean} options.isFormatted - Whether content is pre-formatted
     * @param {string} options.avatar - Sender avatar URL or data
     * @returns {Promise<Object>} The created message
     */
    async addMessage(sessionId, senderId, content, options = {}) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('ChatManager: Session ID must be a non-empty string');
        }

        if (!this.sessions.has(sessionId)) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        if (!senderId || typeof senderId !== 'string') {
            throw new Error('ChatManager: Sender ID must be a non-empty string');
        }

        if (!content || typeof content !== 'string') {
            throw new Error('ChatManager: Message content must be a non-empty string');
        }

        if (content.length > this.maxMessageLength) {
            throw new Error(`ChatManager: Message content exceeds maximum length of ${this.maxMessageLength} characters`);
        }

        const { role = 'user', metadata = {}, isFormatted = false, avatar = null } = options;

        // Generate unique message ID
        this.messageCounter++;
        const messageId = `msg_${Date.now()}_${this.messageCounter}`;

        // Create message object
        const message = {
            id: messageId,
            sessionId: sessionId,
            senderId: senderId,
            content: content,
            role: role,
            timestamp: Date.now(),
            isFormatted: isFormatted,
            avatar: avatar,
            metadata: {
                ...metadata,
                createdBy: 'ChatManager',
                version: '1.0.0'
            }
        };

        // Add message to storage
        if (!this.messages.has(sessionId)) {
            this.messages.set(sessionId, []);
        }
        
        const sessionMessages = this.messages.get(sessionId);
        sessionMessages.push(message);

        // Enforce message limit
        if (sessionMessages.length > this.maxMessagesPerSession) {
            sessionMessages.shift(); // Remove oldest message
        }

        // Update session metadata
        const session = this.sessions.get(sessionId);
        session.messageCount = sessionMessages.length;
        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update session metadata
        const sessionMeta = this.sessionMetadata.get(sessionId) || {};
        sessionMeta.totalMessages = sessionMessages.length;
        sessionMeta.lastMessageTime = message.timestamp;
        
        // Update participant activity
        if (!sessionMeta.participantActivity) {
            sessionMeta.participantActivity = new Map();
        }
        sessionMeta.participantActivity.set(senderId, message.timestamp);
        this.sessionMetadata.set(sessionId, sessionMeta);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
            this.stateManager.setState(`chatMessages.${sessionId}`, sessionMessages);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:message:added', {
                sessionId,
                message,
                session,
                totalMessages: sessionMessages.length
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Added message '${messageId}' to session '${sessionId}' from '${senderId}'`);
        }

        return message;
    }

    /**
     * Get messages from a chat session
     * @param {string} sessionId - The session ID
     * @param {Object} options - Optional filters
     * @param {number} options.limit - Maximum number of messages to return
     * @param {number} options.offset - Number of messages to skip
     * @param {string} options.senderId - Filter by sender ID
     * @param {string} options.role - Filter by message role
     * @param {boolean} options.reverse - Return messages in reverse order (newest first)
     * @returns {Array} Array of messages
     */
    getMessages(sessionId, options = {}) {
        if (!sessionId || typeof sessionId !== 'string') {
            return [];
        }

        if (!this.sessions.has(sessionId)) {
            return [];
        }

        const { limit = null, offset = 0, senderId = null, role = null, reverse = false } = options;
        
        let messages = this.messages.get(sessionId) || [];

        // Apply filters
        if (senderId) {
            messages = messages.filter(msg => msg.senderId === senderId);
        }

        if (role) {
            messages = messages.filter(msg => msg.role === role);
        }

        // Apply ordering
        if (reverse) {
            messages = [...messages].reverse();
        }

        // Apply offset and limit
        if (offset > 0) {
            messages = messages.slice(offset);
        }

        if (limit && limit > 0) {
            messages = messages.slice(0, limit);
        }

        return messages;
    }

    /**
     * Get a specific message by ID
     * @param {string} sessionId - The session ID
     * @param {string} messageId - The message ID
     * @returns {Object|null} The message or null if not found
     */
    getMessage(sessionId, messageId) {
        if (!sessionId || !messageId) {
            return null;
        }

        const messages = this.messages.get(sessionId) || [];
        return messages.find(msg => msg.id === messageId) || null;
    }

    /**
     * Update a message
     * @param {string} sessionId - The session ID
     * @param {string} messageId - The message ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object|null>} The updated message or null if not found
     */
    async updateMessage(sessionId, messageId, updates) {
        if (!sessionId || !messageId) {
            throw new Error('ChatManager: Session ID and Message ID are required');
        }

        const messages = this.messages.get(sessionId);
        if (!messages) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            throw new Error(`ChatManager: Message '${messageId}' not found in session '${sessionId}'`);
        }

        const originalMessage = messages[messageIndex];
        const updatedMessage = {
            ...originalMessage,
            ...updates,
            metadata: {
                ...originalMessage.metadata,
                ...(updates.metadata || {})
            },
            updatedAt: Date.now()
        };

        // Validate content length if being updated
        if (updates.content && updates.content.length > this.maxMessageLength) {
            throw new Error(`ChatManager: Message content exceeds maximum length of ${this.maxMessageLength} characters`);
        }

        messages[messageIndex] = updatedMessage;

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatMessages.${sessionId}`, messages);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:message:updated', {
                sessionId,
                message: updatedMessage,
                originalMessage
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Updated message '${messageId}' in session '${sessionId}'`);
        }

        return updatedMessage;
    }

    /**
     * Delete a message
     * @param {string} sessionId - The session ID
     * @param {string} messageId - The message ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteMessage(sessionId, messageId) {
        if (!sessionId || !messageId) {
            throw new Error('ChatManager: Session ID and Message ID are required');
        }

        const messages = this.messages.get(sessionId);
        if (!messages) {
            throw new Error(`ChatManager: Session '${sessionId}' not found`);
        }

        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            throw new Error(`ChatManager: Message '${messageId}' not found in session '${sessionId}'`);
        }

        const deletedMessage = messages[messageIndex];
        messages.splice(messageIndex, 1);

        // Update session metadata
        const session = this.sessions.get(sessionId);
        session.messageCount = messages.length;
        session.updatedAt = Date.now();
        this.sessions.set(sessionId, session);

        // Update state manager
        if (this.stateManager) {
            this.stateManager.setState(`chatSessions.${sessionId}`, session);
            this.stateManager.setState(`chatMessages.${sessionId}`, messages);
        }

        // Emit event
        if (this.eventBus) {
            await this.eventBus.emit('chat:message:deleted', {
                sessionId,
                message: deletedMessage,
                session,
                totalMessages: messages.length
            });
        }

        if (this.debugMode) {
            console.log(`ChatManager: Deleted message '${messageId}' from session '${sessionId}'`);
        }

        return true;
    }

    /**
     * Format a message for display
     * @param {Object} message - The message object
     * @param {Object} options - Formatting options
     * @param {boolean} options.includeTimestamp - Whether to include timestamp
     * @param {boolean} options.includeMetadata - Whether to include metadata
     * @param {string} options.dateFormat - Date format string
     * @returns {Object} Formatted message object
     */
    formatMessage(message, options = {}) {
        const { includeTimestamp = true, includeMetadata = false, dateFormat = 'ISO' } = options;

        const formatted = {
            id: message.id,
            senderId: message.senderId,
            content: message.content,
            role: message.role,
            isFormatted: message.isFormatted,
            avatar: message.avatar
        };

        if (includeTimestamp) {
            if (dateFormat === 'ISO') {
                formatted.timestamp = new Date(message.timestamp).toISOString();
            } else if (dateFormat === 'relative') {
                formatted.timestamp = this.getRelativeTime(message.timestamp);
            } else {
                formatted.timestamp = new Date(message.timestamp).toLocaleString();
            }
        }

        if (includeMetadata) {
            formatted.metadata = message.metadata;
        }

        return formatted;
    }

    /**
     * Get relative time string
     * @param {number} timestamp - The timestamp
     * @returns {string} Relative time string
     */
    getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (seconds > 0) {
            return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
        } else {
            return 'just now';
        }
    }

    /**
     * Get message statistics for a session
     * @param {string} sessionId - The session ID
     * @returns {Object|null} Message statistics or null if session not found
     */
    getMessageStats(sessionId) {
        if (!sessionId || !this.sessions.has(sessionId)) {
            return null;
        }

        const messages = this.messages.get(sessionId) || [];
        const participants = this.participants.get(sessionId) || new Set();

        // Count messages by sender
        const senderCounts = {};
        const roleCounts = {};
        let totalLength = 0;

        messages.forEach(msg => {
            senderCounts[msg.senderId] = (senderCounts[msg.senderId] || 0) + 1;
            roleCounts[msg.role] = (roleCounts[msg.role] || 0) + 1;
            totalLength += msg.content.length;
        });

        return {
            sessionId,
            totalMessages: messages.length,
            uniqueSenders: Object.keys(senderCounts).length,
            totalParticipants: participants.size,
            averageMessageLength: messages.length > 0 ? Math.round(totalLength / messages.length) : 0,
            senderBreakdown: senderCounts,
            roleBreakdown: roleCounts,
            firstMessageTime: messages.length > 0 ? messages[0].timestamp : null,
            lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopAutoSave();
        this.sessions.clear();
        this.participants.clear();
        this.sessionMetadata.clear();
        this.messages.clear();
        
        if (this.debugMode) {
            console.log('ChatManager: Destroyed');
        }
    }
}

// Export for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatManager;
} else if (typeof window !== 'undefined') {
    window.ChatManager = ChatManager;
} 