/**
 * EventBus - Core event system for SillyTavern Browser Runtime
 * 
 * Provides a centralized event system for communication between runtime components.
 * Supports multiple listeners per event, proper cleanup, and error handling.
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - The name of the event to subscribe to
     * @param {Function} callback - The callback function to execute when the event is emitted
     * @param {Object} options - Optional configuration
     * @param {boolean} options.once - If true, the listener will be removed after first execution
     * @param {string} options.namespace - Optional namespace for event filtering
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback, options = {}) {
        if (!eventName || typeof eventName !== 'string') {
            throw new Error('EventBus: Event name must be a non-empty string');
        }

        if (!callback || typeof callback !== 'function') {
            throw new Error('EventBus: Callback must be a function');
        }

        const { once = false, namespace = null } = options;
        const targetMap = once ? this.onceListeners : this.listeners;
        
        if (!targetMap.has(eventName)) {
            targetMap.set(eventName, []);
        }

        const listener = {
            callback,
            namespace,
            id: this.generateListenerId()
        };

        targetMap.get(eventName).push(listener);

        if (this.debugMode) {
            console.log(`EventBus: Subscribed to '${eventName}'${namespace ? ` (namespace: ${namespace})` : ''}`);
        }

        // Return unsubscribe function
        return () => this.unsubscribe(eventName, callback);
    }

    /**
     * Subscribe to an event that will only fire once
     * @param {string} eventName - The name of the event to subscribe to
     * @param {Function} callback - The callback function to execute when the event is emitted
     * @param {Object} options - Optional configuration
     * @returns {Function} Unsubscribe function
     */
    once(eventName, callback, options = {}) {
        return this.subscribe(eventName, callback, { ...options, once: true });
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - The name of the event to unsubscribe from
     * @param {Function} callback - The specific callback to remove (optional)
     */
    unsubscribe(eventName, callback = null) {
        if (!eventName || typeof eventName !== 'string') {
            throw new Error('EventBus: Event name must be a non-empty string');
        }

        let removedCount = 0;

        // Remove from regular listeners
        if (this.listeners.has(eventName)) {
            const listeners = this.listeners.get(eventName);
            if (callback) {
                const initialLength = listeners.length;
                const filtered = listeners.filter(listener => listener.callback !== callback);
                removedCount += initialLength - filtered.length;
                this.listeners.set(eventName, filtered);
            } else {
                removedCount += listeners.length;
                this.listeners.delete(eventName);
            }
        }

        // Remove from once listeners
        if (this.onceListeners.has(eventName)) {
            const listeners = this.onceListeners.get(eventName);
            if (callback) {
                const initialLength = listeners.length;
                const filtered = listeners.filter(listener => listener.callback !== callback);
                removedCount += initialLength - filtered.length;
                this.onceListeners.set(eventName, filtered);
            } else {
                removedCount += listeners.length;
                this.onceListeners.delete(eventName);
            }
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`EventBus: Unsubscribed ${removedCount} listener(s) from '${eventName}'`);
        }

        return removedCount;
    }

    /**
     * Emit an event with optional data payload
     * @param {string} eventName - The name of the event to emit
     * @param {*} data - Optional data payload to pass to listeners
     * @param {Object} options - Optional configuration
     * @param {string} options.namespace - Optional namespace filter
     * @returns {Promise<void>}
     */
    async emit(eventName, data = null, options = {}) {
        if (!eventName || typeof eventName !== 'string') {
            throw new Error('EventBus: Event name must be a non-empty string');
        }

        const { namespace = null } = options;
        const timestamp = Date.now();
        const eventId = this.generateEventId();

        // Record event in history
        this.recordEvent(eventName, data, timestamp, eventId);

        if (this.debugMode) {
            console.log(`EventBus: Emitting '${eventName}'${namespace ? ` (namespace: ${namespace})` : ''}`, data);
        }

        const promises = [];

        // Process regular listeners
        if (this.listeners.has(eventName)) {
            const listeners = this.listeners.get(eventName);
            for (const listener of listeners) {
                if (!namespace || listener.namespace === namespace) {
                    promises.push(this.executeListener(listener, data, eventName));
                }
            }
        }

        // Process once listeners and remove them
        if (this.onceListeners.has(eventName)) {
            const listeners = this.onceListeners.get(eventName);
            const remainingListeners = [];
            
            for (const listener of listeners) {
                if (!namespace || listener.namespace === namespace) {
                    promises.push(this.executeListener(listener, data, eventName));
                } else {
                    remainingListeners.push(listener);
                }
            }
            
            if (remainingListeners.length > 0) {
                this.onceListeners.set(eventName, remainingListeners);
            } else {
                this.onceListeners.delete(eventName);
            }
        }

        // Wait for all listeners to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error(`EventBus: Error in event '${eventName}' listeners:`, error);
            throw error;
        }
    }

    /**
     * Execute a single listener with error handling
     * @param {Object} listener - The listener object
     * @param {*} data - The event data
     * @param {string} eventName - The event name for error reporting
     * @returns {Promise<void>}
     */
    async executeListener(listener, data, eventName) {
        try {
            const result = listener.callback(data);
            if (result && typeof result.then === 'function') {
                await result;
            }
        } catch (error) {
            console.error(`EventBus: Listener error for event '${eventName}':`, error);
            // Don't throw here to allow other listeners to execute
        }
    }

    /**
     * Get the number of listeners for an event
     * @param {string} eventName - The name of the event
     * @returns {number} The number of listeners
     */
    listenerCount(eventName) {
        if (!eventName || typeof eventName !== 'string') {
            return 0;
        }

        let count = 0;
        
        if (this.listeners.has(eventName)) {
            count += this.listeners.get(eventName).length;
        }
        
        if (this.onceListeners.has(eventName)) {
            count += this.onceListeners.get(eventName).length;
        }

        return count;
    }

    /**
     * Get all event names that have listeners
     * @returns {string[]} Array of event names
     */
    eventNames() {
        const events = new Set();
        
        for (const eventName of this.listeners.keys()) {
            events.add(eventName);
        }
        
        for (const eventName of this.onceListeners.keys()) {
            events.add(eventName);
        }
        
        return Array.from(events);
    }

    /**
     * Remove all listeners for all events
     */
    removeAllListeners() {
        this.listeners.clear();
        this.onceListeners.clear();
        
        if (this.debugMode) {
            console.log('EventBus: Removed all listeners');
        }
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Get event history
     * @param {number} limit - Maximum number of events to return
     * @returns {Array} Array of recent events
     */
    getEventHistory(limit = this.maxHistorySize) {
        return this.eventHistory.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearEventHistory() {
        this.eventHistory = [];
    }

    /**
     * Set maximum history size
     * @param {number} size - Maximum number of events to keep in history
     */
    setMaxHistorySize(size) {
        if (typeof size !== 'number' || size < 0) {
            throw new Error('EventBus: Max history size must be a non-negative number');
        }
        this.maxHistorySize = size;
        
        // Trim history if necessary
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Record an event in history
     * @param {string} eventName - The event name
     * @param {*} data - The event data
     * @param {number} timestamp - The event timestamp
     * @param {string} eventId - The event ID
     */
    recordEvent(eventName, data, timestamp, eventId) {
        this.eventHistory.push({
            id: eventId,
            name: eventName,
            data,
            timestamp,
            listenerCount: this.listenerCount(eventName)
        });

        // Trim history if it exceeds max size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Generate a unique listener ID
     * @returns {string} Unique listener ID
     */
    generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a unique event ID
     * @returns {string} Unique event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics about the EventBus
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            totalListeners: 0,
            totalOnceListeners: 0,
            totalEvents: 0,
            eventNames: this.eventNames(),
            historySize: this.eventHistory.length,
            maxHistorySize: this.maxHistorySize,
            debugMode: this.debugMode
        };

        for (const listeners of this.listeners.values()) {
            stats.totalListeners += listeners.length;
        }

        for (const listeners of this.onceListeners.values()) {
            stats.totalOnceListeners += listeners.length;
        }

        stats.totalEvents = this.eventHistory.length;

        return stats;
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
} else if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
}

// ES module export
if (typeof exports !== 'undefined') {
    exports.EventBus = EventBus;
    exports.default = EventBus;
} 