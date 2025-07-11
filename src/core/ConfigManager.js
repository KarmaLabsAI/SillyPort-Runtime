/**
 * ConfigManager - Configuration management for SillyTavern Browser Runtime
 * 
 * Provides hierarchical configuration management with validation, persistence,
 * and runtime updates. Supports YAML and JSON configuration files with
 * dot notation path access and default value management.
 */
class ConfigManager {
    constructor(eventBus = null) {
        this.eventBus = eventBus;
        this.config = {};
        this.defaults = {};
        this.validationRules = new Map();
        this.watchers = new Map();
        this.debugMode = false;
        this.persistent = true;
        this.storageKey = 'sillytavern-config';
    }

    /**
     * Load configuration from a file
     * @param {string} filePath - Path to the configuration file
     * @param {Object} options - Loading options
     * @param {boolean} options.merge - Whether to merge with existing config
     * @param {boolean} options.validate - Whether to validate the configuration
     * @returns {Promise<Object>} Loaded configuration
     */
    async loadFromFile(filePath, options = {}) {
        const { merge = false, validate = true } = options;

        // Check file extension before attempting to fetch
        if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml') && !filePath.endsWith('.json')) {
            throw new Error(`Unsupported configuration file format: ${filePath}`);
        }

        try {
            if (this.debugMode) {
                console.log(`ConfigManager: Loading configuration from ${filePath}`);
            }

            // In a browser environment, we need to fetch the file
            let response;
            try {
                response = await fetch(filePath);
            } catch (fetchErr) {
                throw fetchErr;
            }
            if (!response || !response.ok) {
                throw new Error(`Failed to load configuration file: ${response ? response.statusText : 'No response'}`);
            }

            const content = await response.text();
            let config;

            if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
                config = this.parseYAML(content);
            } else if (filePath.endsWith('.json')) {
                config = JSON.parse(content);
            }

            // Validate configuration if requested
            if (validate) {
                this.validateConfiguration(config);
            }

            // Merge or replace configuration
            if (merge) {
                this.config = this.mergeConfig(this.config, config);
            } else {
                this.config = config;
            }

            // Apply defaults
            this.applyDefaults();

            // Persist configuration
            if (this.persistent) {
                this.persist();
            }

            // Emit load event
            this.emitConfigEvent('config:loaded', { filePath, config });

            if (this.debugMode) {
                console.log(`ConfigManager: Configuration loaded successfully from ${filePath}`);
            }

            return config;
        } catch (error) {
            console.error(`ConfigManager: Error loading configuration from ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Get a configuration value using dot notation
     * @param {string} path - Dot notation path to the configuration property
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} The configuration value or default
     */
    get(path, defaultValue = undefined) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        const value = this.getValueByPath(path);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set a configuration value using dot notation
     * @param {string} path - Dot notation path to the configuration property
     * @param {*} value - Value to set
     * @param {Object} options - Setting options
     * @param {boolean} options.validate - Whether to validate the value
     * @param {boolean} options.persist - Whether to persist the change
     * @returns {boolean} Success status
     */
    set(path, value, options = {}) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        const { validate = true, persist = true } = options;
        const oldValue = this.get(path);

        // Validate the value if requested
        if (validate) {
            this.validateValue(path, value);
        }

        // Set the value
        const success = this.setValueByPath(path, value);
        
        if (success) {
            // Persist configuration if requested
            if (persist && this.persistent) {
                this.persist();
            }

            // Emit change event
            this.emitConfigEvent('config:changed', { path, oldValue, newValue: value });

            if (this.debugMode) {
                console.log(`ConfigManager: Set '${path}' =`, value);
            }
        }

        return success;
    }

    /**
     * Set default configuration values
     * @param {Object} defaults - Default configuration values
     * @param {boolean} merge - Whether to merge with existing defaults
     */
    setDefaults(defaults, merge = false) {
        if (!defaults || typeof defaults !== 'object') {
            throw new Error('ConfigManager: Defaults must be an object');
        }

        if (merge) {
            this.defaults = this.mergeConfig(this.defaults, defaults);
        } else {
            this.defaults = { ...defaults };
            // When not merging, reset config to new defaults
            this.config = JSON.parse(JSON.stringify(this.defaults));
        }

        // Apply defaults to current configuration
        this.applyDefaults();

        if (this.debugMode) {
            console.log('ConfigManager: Defaults updated');
        }
    }

    /**
     * Add a validation rule for a configuration path
     * @param {string} path - Dot notation path to validate
     * @param {Function} validator - Validation function that returns boolean
     * @param {string} errorMessage - Custom error message for validation failures
     */
    addValidationRule(path, validator, errorMessage = null) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        if (!validator || typeof validator !== 'function') {
            throw new Error('ConfigManager: Validator must be a function');
        }

        this.validationRules.set(path, {
            validator,
            errorMessage: errorMessage || `Invalid value for path '${path}'`
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Added validation rule for '${path}'`);
        }
    }

    /**
     * Remove a validation rule
     * @param {string} path - Dot notation path
     * @returns {boolean} Success status
     */
    removeValidationRule(path) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        const removed = this.validationRules.delete(path);
        
        if (this.debugMode && removed) {
            console.log(`ConfigManager: Removed validation rule for '${path}'`);
        }

        return removed;
    }

    /**
     * Watch for configuration changes
     * @param {string} path - Dot notation path to watch
     * @param {Function} callback - Callback function to execute on changes
     * @returns {Function} Unwatch function
     */
    watch(path, callback) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        if (!callback || typeof callback !== 'function') {
            throw new Error('ConfigManager: Callback must be a function');
        }

        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }

        this.watchers.get(path).push(callback);

        if (this.debugMode) {
            console.log(`ConfigManager: Added watcher for '${path}'`);
        }

        // Return unwatch function
        return () => this.unwatch(path, callback);
    }

    /**
     * Unwatch configuration changes
     * @param {string} path - Dot notation path
     * @param {Function} callback - Specific callback to remove (optional)
     * @returns {number} Number of watchers removed
     */
    unwatch(path, callback = null) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        if (!this.watchers.has(path)) {
            return 0;
        }

        const watchers = this.watchers.get(path);
        let removedCount = 0;

        if (callback) {
            const initialLength = watchers.length;
            const filtered = watchers.filter(watcher => watcher !== callback);
            removedCount = initialLength - filtered.length;
            this.watchers.set(path, filtered);
        } else {
            removedCount = watchers.length;
            this.watchers.delete(path);
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`ConfigManager: Removed ${removedCount} watcher(s) from '${path}'`);
        }

        return removedCount;
    }

    /**
     * Get the entire configuration object
     * @param {boolean} deep - If true, return a deep copy
     * @returns {Object} The configuration object
     */
    getConfig(deep = false) {
        if (deep) {
            return JSON.parse(JSON.stringify(this.config));
        }
        return { ...this.config };
    }

    /**
     * Reset configuration to defaults
     * @param {Object} newDefaults - Optional new defaults to set
     */
    reset(newDefaults = null) {
        if (newDefaults) {
            this.setDefaults(newDefaults, false);
        } else {
            this.config = JSON.parse(JSON.stringify(this.defaults));
        }
        
        if (this.persistent) {
            this.persist();
        }

        this.emitConfigEvent('config:reset', { config: this.config });

        if (this.debugMode) {
            console.log('ConfigManager: Configuration reset to defaults');
        }
    }

    /**
     * Load configuration from persistent storage
     * @returns {Promise<boolean>} Success status
     */
    async load() {
        try {
            if (typeof localStorage === 'undefined') {
                return false;
            }

            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                return false;
            }

            const config = JSON.parse(stored);
            this.config = this.mergeConfig(this.defaults, config);

            this.emitConfigEvent('config:loaded', { source: 'storage', config });

            if (this.debugMode) {
                console.log('ConfigManager: Configuration loaded from storage');
            }

            return true;
        } catch (error) {
            console.error('ConfigManager: Error loading from storage:', error);
            return false;
        }
    }

    /**
     * Save configuration to persistent storage
     * @returns {boolean} Success status
     */
    persist() {
        try {
            if (typeof localStorage === 'undefined') {
                return false;
            }

            localStorage.setItem(this.storageKey, JSON.stringify(this.config));

            if (this.debugMode) {
                console.log('ConfigManager: Configuration persisted to storage');
            }

            return true;
        } catch (error) {
            console.error('ConfigManager: Error persisting to storage:', error);
            return false;
        }
    }

    /**
     * Clear persistent storage
     * @returns {boolean} Success status
     */
    clear() {
        try {
            if (typeof localStorage === 'undefined') {
                return false;
            }

            localStorage.removeItem(this.storageKey);

            if (this.debugMode) {
                console.log('ConfigManager: Configuration cleared from storage');
            }

            return true;
        } catch (error) {
            console.error('ConfigManager: Error clearing storage:', error);
            return false;
        }
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        if (this.debugMode) {
            console.log('ConfigManager: Debug mode enabled');
        }
    }

    /**
     * Get configuration statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            configSize: JSON.stringify(this.config).length,
            defaultsSize: JSON.stringify(this.defaults).length,
            validationRulesCount: this.validationRules.size,
            watchersCount: Array.from(this.watchers.values())
                .reduce((total, watchers) => total + watchers.length, 0),
            debugMode: this.debugMode,
            persistent: this.persistent
        };
    }

    // Private helper methods

    /**
     * Parse YAML content (simplified implementation)
     * @param {string} content - YAML content
     * @returns {Object} Parsed object
     */
    parseYAML(content) {
        // This is a simplified YAML parser for basic key-value pairs
        // In a real implementation, you might want to use a proper YAML library
        const lines = content.split('\n');
        const result = {};
        let currentSection = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed === '') {
                continue;
            }

            // Check for section headers
            if (trimmed.endsWith(':')) {
                currentSection = trimmed.slice(0, -1);
                result[currentSection] = {};
                continue;
            }

            // Parse key-value pairs
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0) {
                const key = trimmed.substring(0, colonIndex).trim();
                let value = trimmed.substring(colonIndex + 1).trim();

                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                // Convert to appropriate type
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (value === 'null') value = null;
                else if (!isNaN(value) && value !== '') {
                    value = value.includes('.') ? parseFloat(value) : parseInt(value);
                }

                if (currentSection) {
                    result[currentSection][key] = value;
                } else {
                    result[key] = value;
                }
            }
        }

        return result;
    }

    /**
     * Get a value from the configuration using dot notation path
     * @param {string} path - Dot notation path
     * @returns {*} The value at the path or undefined
     */
    getValueByPath(path) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current === null || typeof current !== 'object' || !(key in current)) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Set a value in the configuration using dot notation path
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     * @returns {boolean} Success status
     */
    setValueByPath(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
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
     * Merge two configuration objects
     * @param {Object} target - Target configuration
     * @param {Object} source - Source configuration
     * @returns {Object} Merged configuration
     */
    mergeConfig(target, source) {
        const result = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfig(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Apply default values to the configuration
     */
    applyDefaults() {
        this.config = this.mergeConfig(this.defaults, this.config);
    }

    /**
     * Validate a configuration value
     * @param {string} path - Dot notation path
     * @param {*} value - Value to validate
     */
    validateValue(path, value) {
        // Check for exact path match
        if (this.validationRules.has(path)) {
            const rule = this.validationRules.get(path);
            if (!rule.validator(value)) {
                throw new Error(rule.errorMessage);
            }
        }

        // Check for wildcard rules
        for (const [rulePath, rule] of this.validationRules) {
            if (this.pathMatchesPattern(path, rulePath)) {
                if (!rule.validator(value)) {
                    throw new Error(rule.errorMessage);
                }
            }
        }
    }

    /**
     * Validate entire configuration
     * @param {Object} config - Configuration to validate
     */
    validateConfiguration(config) {
        for (const [path, rule] of this.validationRules) {
            const value = this.getValueByPath(path);
            if (value !== undefined && !rule.validator(value)) {
                throw new Error(rule.errorMessage);
            }
        }
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
     * Emit configuration events
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    emitConfigEvent(eventName, data) {
        // Notify watchers
        const path = data.path;
        if (path && this.watchers.has(path)) {
            const watchers = this.watchers.get(path);
            for (const watcher of watchers) {
                try {
                    watcher(data.newValue, data.oldValue, path);
                } catch (error) {
                    console.error(`ConfigManager: Error in watcher for '${path}':`, error);
                }
            }
        }

        // Emit EventBus event if available
        if (this.eventBus) {
            this.eventBus.emit(eventName, {
                ...data,
                timestamp: Date.now()
            });
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigManager };
} else if (typeof window !== 'undefined') {
    window.ConfigManager = ConfigManager;
} 