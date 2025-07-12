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
            
            if (this.debugMode) {
                console.log(`ChatManager: Saved ${sessionsData.length} sessions to storage`);
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
                
                if (this.debugMode) {
                    console.log(`ChatManager: Loaded ${this.sessions.size} sessions from storage`);
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
        return {
            totalSessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
            totalParticipants: Array.from(this.participants.values()).reduce((sum, set) => sum + set.size, 0),
            autoSaveEnabled: this.autoSaveEnabled,
            autoSaveInterval: this.autoSaveInterval,
            maxMessagesPerSession: this.maxMessagesPerSession,
            maxMessageLength: this.maxMessageLength,
            debugMode: this.debugMode
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