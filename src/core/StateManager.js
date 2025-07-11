/**
 * StateManager - Central state management for SillyTavern Browser Runtime
 * 
 * Provides centralized state management with reactive updates across the runtime.
 * Implements a reactive pattern where components can subscribe to state changes
 * and receive notifications when relevant data is updated.
 */
class StateManager {
    constructor(eventBus = null) {
        this.state = {
            characters: {},
            activeCharacter: null,
            chatSessions: {},
            activeChat: null,
            messages: {},
            config: {},
            ui: {
                theme: 'default',
                sidebarOpen: true,
                loading: false
            },
            runtime: {
                initialized: false,
                version: '1.0.0',
                lastUpdate: null
            }
        };
        
        this.eventBus = eventBus;
        this.subscribers = new Map();
        this.validationRules = new Map();
        this.stateHistory = [];
        this.maxHistorySize = 50;
        this.debugMode = false;
        
        // Batch update support
        this.batchMode = false;
        this.batchUpdates = new Map();
        this.batchCallbacks = [];
        
        // Rollback support
        this.rollbackStack = [];
        this.maxRollbackStack = 20;
        
        // Diff detection
        this.lastStateSnapshot = null;
        this.diffCache = new Map();
    }

    /**
     * Set a state value using dot notation path
     * @param {string} path - Dot notation path to the state property
     * @param {*} value - Value to set
     * @param {Object} options - Optional configuration
     * @param {boolean} options.silent - If true, don't emit events
     * @param {boolean} options.validate - If true, validate the value before setting
     * @returns {boolean} Success status
     */
    setState(path, value, options = {}) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        const { silent = false, validate = true } = options;
        
        // If in batch mode, queue the update
        if (this.batchMode) {
            this.batchUpdates.set(path, value);
            return true;
        }

        const oldValue = this.getState(path);
        
        // Validate the value if requested
        if (validate) {
            const validationResult = this.validateValue(path, value);
            if (!validationResult.valid) {
                throw new Error(validationResult.errorMessage || `StateManager: Invalid value for path '${path}'`);
            }
        }

        // Set the value using the path
        const success = this.setValueByPath(path, value);
        
        if (success) {
            // Record in history
            this.recordStateChange(path, oldValue, value);
            
            // Emit change event if not silent
            if (!silent) {
                this.emitStateChange(path, oldValue, value);
            }

            if (this.debugMode) {
                console.log(`StateManager: Set '${path}' =`, value);
            }
        }

        return success;
    }

    /**
     * Get a state value using dot notation path
     * @param {string} path - Dot notation path to the state property
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} The value at the path or default value
     */
    getState(path, defaultValue = undefined) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        return this.getValueByPath(path, defaultValue);
    }

    /**
     * Subscribe to state changes for a specific path
     * @param {string} path - Dot notation path to subscribe to
     * @param {Function} callback - Callback function to execute on changes
     * @param {Object} options - Optional configuration
     * @param {boolean} options.immediate - If true, call callback immediately with current value
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback, options = {}) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        if (!callback || typeof callback !== 'function') {
            throw new Error('StateManager: Callback must be a function');
        }

        const { immediate = false } = options;

        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, []);
        }

        const subscriber = {
            callback,
            id: this.generateSubscriberId()
        };

        this.subscribers.get(path).push(subscriber);

        // Call immediately if requested
        if (immediate) {
            const currentValue = this.getState(path);
            try {
                callback(currentValue, currentValue, path);
            } catch (error) {
                console.error(`StateManager: Error in immediate callback for '${path}':`, error);
            }
        }

        if (this.debugMode) {
            console.log(`StateManager: Subscribed to '${path}'`);
        }

        // Return unsubscribe function
        return () => this.unsubscribe(path, callback);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} path - Dot notation path to unsubscribe from
     * @param {Function} callback - Specific callback to remove (optional)
     * @returns {number} Number of subscribers removed
     */
    unsubscribe(path, callback = null) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        if (!this.subscribers.has(path)) {
            return 0;
        }

        const subscribers = this.subscribers.get(path);
        let removedCount = 0;

        if (callback) {
            const initialLength = subscribers.length;
            const filtered = subscribers.filter(sub => sub.callback !== callback);
            removedCount = initialLength - filtered.length;
            this.subscribers.set(path, filtered);
        } else {
            removedCount = subscribers.length;
            this.subscribers.delete(path);
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`StateManager: Unsubscribed ${removedCount} subscriber(s) from '${path}'`);
        }

        return removedCount;
    }

    /**
     * Add a validation rule for a specific path
     * @param {string} path - Dot notation path to validate
     * @param {Function} validator - Validation function that returns boolean
     * @param {string} errorMessage - Custom error message for validation failures
     */
    addValidationRule(path, validator, errorMessage = null) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        if (!validator || typeof validator !== 'function') {
            throw new Error('StateManager: Validator must be a function');
        }

        this.validationRules.set(path, {
            validator,
            errorMessage: errorMessage || `Invalid value for path '${path}'`
        });

        if (this.debugMode) {
            console.log(`StateManager: Added validation rule for '${path}'`);
        }
    }

    /**
     * Remove a validation rule for a specific path
     * @param {string} path - Dot notation path
     * @returns {boolean} Success status
     */
    removeValidationRule(path) {
        if (!path || typeof path !== 'string') {
            throw new Error('StateManager: Path must be a non-empty string');
        }

        const removed = this.validationRules.delete(path);
        
        if (this.debugMode && removed) {
            console.log(`StateManager: Removed validation rule for '${path}'`);
        }

        return removed;
    }

    /**
     * Get the entire state object
     * @param {boolean} deep - If true, return a deep copy
     * @returns {Object} The state object
     */
    getFullState(deep = false) {
        if (deep) {
            return JSON.parse(JSON.stringify(this.state));
        }
        return { ...this.state };
    }

    /**
     * Reset the state to initial values
     * @param {Object} newState - Optional new state to set
     */
    reset(newState = null) {
        const oldState = this.getFullState(true);
        
        if (newState) {
            this.state = { ...newState };
        } else {
            this.state = {
                characters: {},
                activeCharacter: null,
                chatSessions: {},
                activeChat: null,
                messages: {},
                config: {},
                ui: {
                    theme: 'default',
                    sidebarOpen: true,
                    loading: false
                },
                runtime: {
                    initialized: false,
                    version: '1.0.0',
                    lastUpdate: null
                }
            };
        }

        // Clear history
        this.stateHistory = [];
        
        // Emit reset event
        this.emitStateChange('*', oldState, this.state);
        
        if (this.debugMode) {
            console.log('StateManager: State reset');
        }
    }

    /**
     * Get state change history
     * @param {number} limit - Maximum number of history entries to return
     * @returns {Array} Array of state change records
     */
    getHistory(limit = this.maxHistorySize) {
        return this.stateHistory.slice(-limit);
    }

    /**
     * Clear state change history
     */
    clearHistory() {
        this.stateHistory = [];
        
        if (this.debugMode) {
            console.log('StateManager: History cleared');
        }
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        if (this.debugMode) {
            console.log('StateManager: Debug mode enabled');
        }
    }

    /**
     * Start a batch update operation
     * @param {Function} callback - Function to execute in batch mode
     * @returns {Promise<void>}
     */
    async batchUpdate(callback) {
        if (this.batchMode) {
            throw new Error('StateManager: Already in batch mode');
        }

        this.batchMode = true;
        this.batchUpdates.clear();
        this.batchCallbacks = [];

        try {
            await callback();
            await this.commitBatch();
        } catch (error) {
            this.batchMode = false;
            this.batchUpdates.clear();
            this.batchCallbacks = [];
            throw error;
        }
    }

    /**
     * Commit all pending batch updates
     * @returns {Promise<void>}
     */
    async commitBatch() {
        if (!this.batchMode) {
            return;
        }

        const updates = Array.from(this.batchUpdates.entries());
        const oldValues = new Map();
        const newValues = new Map();

        // Collect all old and new values
        for (const [path, value] of updates) {
            oldValues.set(path, this.getState(path));
            newValues.set(path, value);
        }

        // Apply all updates silently
        for (const [path, value] of updates) {
            this.setValueByPath(path, value);
        }

        // Record batch in history
        this.recordBatchChange(updates, oldValues, newValues);

        // Emit batch events
        await this.emitBatchChanges(updates, oldValues, newValues);

        // Clear batch state
        this.batchMode = false;
        this.batchUpdates.clear();
        this.batchCallbacks = [];

        if (this.debugMode) {
            console.log(`StateManager: Committed ${updates.length} batch updates`);
        }
    }

    /**
     * Rollback to a previous state
     * @param {number|string} target - Number of steps to rollback, checkpoint ID, or label
     * @returns {boolean} Success status
     */
    rollback(target = 1) {
        let rollbackPoint;

        if (typeof target === 'number') {
            // Rollback by steps
            if (target <= 0 || target > this.rollbackStack.length) {
                return false;
            }
            rollbackPoint = this.rollbackStack[this.rollbackStack.length - target];
        } else if (typeof target === 'string') {
            // Find by ID or label
            rollbackPoint = this.rollbackStack.find(cp => cp.id === target || cp.label === target);
        }

        if (!rollbackPoint) {
            return false;
        }

        const oldState = this.getFullState(true);
        this.state = JSON.parse(JSON.stringify(rollbackPoint.state));
        
        // Remove rolled back entries from history
        this.stateHistory = this.stateHistory.slice(0, rollbackPoint.historyIndex);
        
        // Emit rollback event
        this.emitStateChange('*', oldState, this.state);

        if (this.debugMode) {
            console.log(`StateManager: Rolled back to checkpoint '${rollbackPoint.id}'${rollbackPoint.label ? ` (${rollbackPoint.label})` : ''}`);
        }

        return true;
    }

    /**
     * Create a rollback checkpoint
     * @param {string} label - Optional label for the checkpoint
     * @returns {string} Checkpoint ID
     */
    createCheckpoint(label = null) {
        const checkpoint = {
            id: this.generateCheckpointId(),
            label,
            state: JSON.parse(JSON.stringify(this.state)),
            historyIndex: this.stateHistory.length,
            timestamp: Date.now()
        };

        this.rollbackStack.push(checkpoint);

        // Trim rollback stack if it exceeds max size
        if (this.rollbackStack.length > this.maxRollbackStack) {
            this.rollbackStack.shift();
        }

        if (this.debugMode) {
            console.log(`StateManager: Created checkpoint '${checkpoint.id}'${label ? ` (${label})` : ''}`);
        }

        return checkpoint.id;
    }

    /**
     * Get differences between current state and a previous state
     * @param {string|number} target - Checkpoint ID, label, or number of steps back
     * @returns {Object} Diff object with added, modified, and removed properties
     */
    getDiff(target) {
        let targetState;

        if (typeof target === 'number') {
            // Rollback by steps
            if (target <= 0 || target > this.rollbackStack.length) {
                return null;
            }
            targetState = this.rollbackStack[this.rollbackStack.length - target].state;
        } else if (typeof target === 'string') {
            // Find by ID or label
            const checkpoint = this.rollbackStack.find(cp => cp.id === target || cp.label === target);
            if (!checkpoint) {
                return null;
            }
            targetState = checkpoint.state;
        } else {
            return null;
        }

        return this.computeDiff(targetState, this.state);
    }

    /**
     * Get differences between two arbitrary states
     * @param {Object} state1 - First state object
     * @param {Object} state2 - Second state object
     * @returns {Object} Diff object
     */
    getDiffBetween(state1, state2) {
        return this.computeDiff(state1, state2);
    }

    /**
     * Subscribe to state changes with filtering
     * @param {string|Array} paths - Path or array of paths to subscribe to
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @param {Function} options.filter - Optional filter function for selective updates
     * @returns {Function} Unsubscribe function
     */
    subscribeWithFilter(paths, callback, options = {}) {
        if (!Array.isArray(paths)) {
            paths = [paths];
        }

        const { filter = null, immediate = false } = options;
        const subscriptions = [];

        for (const path of paths) {
            const subscription = this.subscribe(path, (newValue, oldValue, changedPath) => {
                // Apply filter if provided
                if (filter && !filter(newValue, oldValue, changedPath)) {
                    return;
                }
                callback(newValue, oldValue, changedPath);
            }, { immediate });
            
            subscriptions.push(subscription);
        }

        // Return function to unsubscribe from all
        return () => {
            subscriptions.forEach(unsubscribe => unsubscribe());
        };
    }

    /**
     * Get statistics about the state manager
     * @returns {Object} Statistics object
     */
    getStats() {
        const subscriberCount = Array.from(this.subscribers.values())
            .reduce((total, subscribers) => total + subscribers.length, 0);
        
        const validationRuleCount = this.validationRules.size;
        const historySize = this.stateHistory.length;
        
        return {
            subscriberCount,
            validationRuleCount,
            historySize,
            maxHistorySize: this.maxHistorySize,
            debugMode: this.debugMode,
            stateSize: JSON.stringify(this.state).length,
            batchMode: this.batchMode,
            rollbackStackSize: this.rollbackStack.length,
            maxRollbackStack: this.maxRollbackStack,
            diffCacheSize: this.diffCache.size
        };
    }

    // Private helper methods

    /**
     * Set a value in the state using dot notation path
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     * @returns {boolean} Success status
     */
    setValueByPath(path, value) {
        const keys = path.split('.');
        let current = this.state;
        
        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            
            if (!(key in current)) {
                current[key] = {};
            }
            
            if (typeof current[key] !== 'object' || current[key] === null) {
                current[key] = {};
            }
            
            current = current[key];
        }
        
        // Set the final value
        const finalKey = keys[keys.length - 1];
        current[finalKey] = value;
        
        return true;
    }

    /**
     * Get a value from the state using dot notation path
     * @param {string} path - Dot notation path
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} The value at the path or default value
     */
    getValueByPath(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current === null || typeof current !== 'object' || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Validate a value against registered validation rules
     * @param {string} path - Dot notation path
     * @param {*} value - Value to validate
     * @returns {Object} Validation result with valid boolean and errorMessage string
     */
    validateValue(path, value) {
        // Check for exact path match
        if (this.validationRules.has(path)) {
            const rule = this.validationRules.get(path);
            const isValid = rule.validator(value);
            return {
                valid: isValid,
                errorMessage: isValid ? null : rule.errorMessage
            };
        }
        
        // Check for wildcard rules (e.g., "characters.*")
        for (const [rulePath, rule] of this.validationRules) {
            if (this.pathMatchesPattern(path, rulePath)) {
                const isValid = rule.validator(value);
                if (!isValid) {
                    if (this.debugMode) {
                        console.error(`StateManager: Validation failed for '${path}':`, rule.errorMessage);
                    }
                    return {
                        valid: false,
                        errorMessage: rule.errorMessage
                    };
                }
            }
        }
        
        return { valid: true, errorMessage: null };
    }

    /**
     * Check if a path matches a pattern (supports wildcards)
     * @param {string} path - Path to check
     * @param {string} pattern - Pattern with wildcards
     * @returns {boolean} Match result
     */
    pathMatchesPattern(path, pattern) {
        if (pattern === '*' || pattern === path) {
            return true;
        }
        
        const pathParts = path.split('.');
        const patternParts = pattern.split('.');
        
        if (patternParts.length !== pathParts.length) {
            return false;
        }
        
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== '*' && patternParts[i] !== pathParts[i]) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Emit state change event to subscribers and EventBus
     * @param {string} path - Changed path
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    emitStateChange(path, oldValue, newValue) {
        // Notify subscribers
        if (this.subscribers.has(path)) {
            const subscribers = this.subscribers.get(path);
            for (const subscriber of subscribers) {
                try {
                    subscriber.callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`StateManager: Error in subscriber callback for '${path}':`, error);
                }
            }
        }
        
        // Emit EventBus event if available
        if (this.eventBus) {
            this.eventBus.emit('state:changed', {
                path,
                oldValue,
                newValue,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Record a state change in history
     * @param {string} path - Changed path
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    recordStateChange(path, oldValue, newValue) {
        const record = {
            path,
            oldValue,
            newValue,
            timestamp: Date.now()
        };
        
        this.stateHistory.push(record);
        
        // Trim history if it exceeds max size
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }

    /**
     * Record a batch change in history
     * @param {Array} updates - Array of [path, value] pairs
     * @param {Map} oldValues - Map of old values
     * @param {Map} newValues - Map of new values
     */
    recordBatchChange(updates, oldValues, newValues) {
        const record = {
            type: 'batch',
            updates: updates.map(([path, value]) => ({
                path,
                oldValue: oldValues.get(path),
                newValue: value
            })),
            timestamp: Date.now()
        };
        
        this.stateHistory.push(record);
        
        // Trim history if it exceeds max size
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }

    /**
     * Emit batch change events
     * @param {Array} updates - Array of [path, value] pairs
     * @param {Map} oldValues - Map of old values
     * @param {Map} newValues - Map of new values
     */
    async emitBatchChanges(updates, oldValues, newValues) {
        // Emit individual change events
        for (const [path, value] of updates) {
            const oldValue = oldValues.get(path);
            this.emitStateChange(path, oldValue, value);
        }

        // Emit batch event if EventBus is available
        if (this.eventBus) {
            await this.eventBus.emit('state:batch', {
                updates: updates.map(([path, value]) => ({
                    path,
                    oldValue: oldValues.get(path),
                    newValue: value
                })),
                timestamp: Date.now()
            });
        }
    }

    /**
     * Compute differences between two state objects
     * @param {Object} oldState - Previous state
     * @param {Object} newState - Current state
     * @returns {Object} Diff object with added, modified, and removed properties
     */
    computeDiff(oldState, newState) {
        const diff = {
            added: {},
            modified: {},
            removed: {}
        };

        this.computeObjectDiff('', oldState, newState, diff);
        return diff;
    }

    /**
     * Recursively compute differences between objects
     * @param {string} path - Current path
     * @param {*} oldValue - Old value
     * @param {*} newValue - New value
     * @param {Object} diff - Diff object to populate
     */
    computeObjectDiff(path, oldValue, newValue, diff) {
        // Handle primitive values
        if (oldValue === newValue) {
            return;
        }

        // Handle null/undefined cases
        if (oldValue == null && newValue != null) {
            diff.added[path] = newValue;
            return;
        }

        if (oldValue != null && newValue == null) {
            diff.removed[path] = oldValue;
            return;
        }

        // Handle different types
        if (typeof oldValue !== typeof newValue) {
            diff.modified[path] = { old: oldValue, new: newValue };
            return;
        }

        // Handle objects
        if (typeof oldValue === 'object' && !Array.isArray(oldValue)) {
            const oldKeys = Object.keys(oldValue || {});
            const newKeys = Object.keys(newValue || {});

            // Find added keys
            for (const key of newKeys) {
                if (!oldKeys.includes(key)) {
                    const fullPath = path ? `${path}.${key}` : key;
                    diff.added[fullPath] = newValue[key];
                }
            }

            // Find removed keys
            for (const key of oldKeys) {
                if (!newKeys.includes(key)) {
                    const fullPath = path ? `${path}.${key}` : key;
                    diff.removed[fullPath] = oldValue[key];
                }
            }

            // Check modified keys
            for (const key of oldKeys) {
                if (newKeys.includes(key)) {
                    const fullPath = path ? `${path}.${key}` : key;
                    this.computeObjectDiff(fullPath, oldValue[key], newValue[key], diff);
                }
            }
        } else if (Array.isArray(oldValue)) {
            // Handle arrays
            if (oldValue.length !== newValue.length) {
                diff.modified[path] = { old: oldValue, new: newValue };
            } else {
                for (let i = 0; i < oldValue.length; i++) {
                    const fullPath = `${path}[${i}]`;
                    this.computeObjectDiff(fullPath, oldValue[i], newValue[i], diff);
                }
            }
        } else {
            // Handle primitive values
            diff.modified[path] = { old: oldValue, new: newValue };
        }
    }

    /**
     * Generate a unique checkpoint ID
     * @returns {string} Unique checkpoint ID
     */
    generateCheckpointId() {
        return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a unique subscriber ID
     * @returns {string} Unique ID
     */
    generateSubscriberId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
} else if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
} 