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
        
        // Task 1.3.2: Configuration Features
        this.templates = new Map();
        this.environment = this.detectEnvironment();
        this.environmentOverrides = new Map();
        this.validationSchemas = new Map();
        this.hotReloadEnabled = true;
        this.importExportHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Detect the current environment
     * @returns {string} Environment name
     */
    detectEnvironment() {
        // Detect environment based on various indicators
        if (typeof window !== 'undefined' && window.location && window.location.hostname) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'development';
            } else if (window.location.hostname.includes('staging') || window.location.hostname.includes('test')) {
                return 'staging';
            } else {
                return 'production';
            }
        }
        return 'development'; // Default to development in Node.js environment
    }

    /**
     * Set environment-specific configuration overrides
     * @param {string} environment - Environment name
     * @param {Object} overrides - Configuration overrides
     */
    setEnvironmentOverrides(environment, overrides) {
        if (!environment || typeof environment !== 'string') {
            throw new Error('ConfigManager: Environment must be a non-empty string');
        }

        if (!overrides || typeof overrides !== 'object') {
            throw new Error('ConfigManager: Overrides must be an object');
        }

        this.environmentOverrides.set(environment, overrides);
        this.applyEnvironmentOverrides();

        if (this.debugMode) {
            console.log(`ConfigManager: Set environment overrides for '${environment}'`);
        }
    }

    /**
     * Apply environment-specific overrides to current configuration
     */
    applyEnvironmentOverrides() {
        const overrides = this.environmentOverrides.get(this.environment);
        if (overrides) {
            this.config = this.mergeConfig(this.config, overrides);
            
            if (this.persistent) {
                this.persist();
            }

            this.emitConfigEvent('config:environment-applied', { 
                environment: this.environment, 
                overrides 
            });

            if (this.debugMode) {
                console.log(`ConfigManager: Applied environment overrides for '${this.environment}'`);
            }
        }
    }

    /**
     * Get the current environment
     * @returns {string} Current environment
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Set the current environment
     * @param {string} environment - Environment name
     */
    setEnvironment(environment) {
        if (!environment || typeof environment !== 'string') {
            throw new Error('ConfigManager: Environment must be a non-empty string');
        }

        const oldEnvironment = this.environment;
        this.environment = environment;
        this.applyEnvironmentOverrides();

        this.emitConfigEvent('config:environment-changed', { 
            oldEnvironment, 
            newEnvironment: environment 
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Environment changed from '${oldEnvironment}' to '${environment}'`);
        }
    }

    /**
     * Add a configuration template
     * @param {string} name - Template name
     * @param {Object} template - Template configuration
     * @param {string} description - Template description
     */
    addTemplate(name, template, description = '') {
        if (!name || typeof name !== 'string') {
            throw new Error('ConfigManager: Template name must be a non-empty string');
        }

        if (!template || typeof template !== 'object') {
            throw new Error('ConfigManager: Template must be an object');
        }

        this.templates.set(name, {
            config: template,
            description,
            createdAt: Date.now()
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Added template '${name}'`);
        }
    }

    /**
     * Get a configuration template
     * @param {string} name - Template name
     * @returns {Object|null} Template object or null if not found
     */
    getTemplate(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('ConfigManager: Template name must be a non-empty string');
        }

        return this.templates.get(name) || null;
    }

    /**
     * Get all available templates
     * @returns {Array} Array of template names
     */
    getTemplateNames() {
        return Array.from(this.templates.keys());
    }

    /**
     * Apply a configuration template
     * @param {string} name - Template name
     * @param {Object} options - Application options
     * @param {boolean} options.merge - Whether to merge with existing config
     * @param {boolean} options.validate - Whether to validate the template
     * @returns {boolean} Success status
     */
    applyTemplate(name, options = {}) {
        const { merge = false, validate = true } = options;

        const template = this.getTemplate(name);
        if (!template) {
            throw new Error(`ConfigManager: Template '${name}' not found`);
        }

        if (validate) {
            this.validateConfiguration(template.config);
        }

        if (merge) {
            this.config = this.mergeConfig(this.config, template.config);
        } else {
            this.config = JSON.parse(JSON.stringify(template.config));
        }

        // Apply defaults and environment overrides
        this.applyDefaults();
        this.applyEnvironmentOverrides();

        if (this.persistent) {
            this.persist();
        }

        this.emitConfigEvent('config:template-applied', { 
            templateName: name, 
            template: template.config,
            merge 
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Applied template '${name}'`);
        }

        return true;
    }

    /**
     * Remove a configuration template
     * @param {string} name - Template name
     * @returns {boolean} Success status
     */
    removeTemplate(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('ConfigManager: Template name must be a non-empty string');
        }

        const removed = this.templates.delete(name);
        
        if (this.debugMode && removed) {
            console.log(`ConfigManager: Removed template '${name}'`);
        }

        return removed;
    }

    /**
     * Export configuration to various formats
     * @param {Object} options - Export options
     * @param {string} options.format - Export format ('json', 'yaml', 'env')
     * @param {boolean} options.includeDefaults - Whether to include default values
     * @param {boolean} options.includeEnvironment - Whether to include environment info
     * @returns {string} Exported configuration
     */
    exportConfig(options = {}) {
        const { 
            format = 'json', 
            includeDefaults = false, 
            includeEnvironment = true 
        } = options;

        let exportData = {
            config: this.config,
            metadata: {
                exportedAt: new Date().toISOString(),
                environment: this.environment,
                version: '1.0.0'
            }
        };

        if (includeDefaults) {
            exportData.defaults = this.defaults;
        }

        if (includeEnvironment) {
            exportData.environment = this.environment;
            exportData.environmentOverrides = Object.fromEntries(this.environmentOverrides);
        }

        let result;
        switch (format.toLowerCase()) {
            case 'json':
                result = JSON.stringify(exportData, null, 2);
                break;
            case 'yaml':
                result = this.toYAML(exportData);
                break;
            case 'env':
                result = this.toEnvFormat(exportData.config);
                break;
            default:
                throw new Error(`ConfigManager: Unsupported export format '${format}'`);
        }

        // Add to import/export history
        this.addToHistory('export', { format, timestamp: Date.now() });

        if (this.debugMode) {
            console.log(`ConfigManager: Exported configuration in ${format} format`);
        }

        return result;
    }

    /**
     * Import configuration from various formats
     * @param {string} data - Configuration data
     * @param {Object} options - Import options
     * @param {string} options.format - Import format ('json', 'yaml', 'env')
     * @param {boolean} options.merge - Whether to merge with existing config
     * @param {boolean} options.validate - Whether to validate the imported config
     * @returns {Object} Imported configuration
     */
    importConfig(data, options = {}) {
        const { 
            format = 'json', 
            merge = false, 
            validate = true 
        } = options;

        if (!data || typeof data !== 'string') {
            throw new Error('ConfigManager: Import data must be a non-empty string');
        }

        let importData;
        switch (format.toLowerCase()) {
            case 'json':
                try {
                    importData = JSON.parse(data);
                } catch (error) {
                    throw new Error(`ConfigManager: Invalid JSON format: ${error.message}`);
                }
                break;
            case 'yaml':
                importData = this.parseYAML(data);
                break;
            case 'env':
                importData = this.parseEnvFormat(data);
                break;
            default:
                throw new Error(`ConfigManager: Unsupported import format '${format}'`);
        }

        // Extract configuration from import data
        const config = importData.config || importData;
        const metadata = importData.metadata || {};

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

        // Apply defaults and environment overrides
        this.applyDefaults();
        this.applyEnvironmentOverrides();

        if (this.persistent) {
            this.persist();
        }

        // Add to import/export history
        this.addToHistory('import', { 
            format, 
            timestamp: Date.now(),
            metadata 
        });

        this.emitConfigEvent('config:imported', { 
            config, 
            metadata, 
            merge 
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Imported configuration in ${format} format`);
        }

        return config;
    }

    /**
     * Add validation schema for configuration paths
     * @param {string} path - Dot notation path
     * @param {Object} schema - JSON Schema object
     */
    addValidationSchema(path, schema) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        if (!schema || typeof schema !== 'object') {
            throw new Error('ConfigManager: Schema must be an object');
        }

        this.validationSchemas.set(path, schema);

        if (this.debugMode) {
            console.log(`ConfigManager: Added validation schema for '${path}'`);
        }
    }

    /**
     * Remove validation schema
     * @param {string} path - Dot notation path
     * @returns {boolean} Success status
     */
    removeValidationSchema(path) {
        if (!path || typeof path !== 'string') {
            throw new Error('ConfigManager: Path must be a non-empty string');
        }

        const removed = this.validationSchemas.delete(path);
        
        if (this.debugMode && removed) {
            console.log(`ConfigManager: Removed validation schema for '${path}'`);
        }

        return removed;
    }

    /**
     * Validate configuration against schemas
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateWithSchemas(config) {
        const errors = [];
        const warnings = [];

        for (const [path, schema] of this.validationSchemas) {
            const value = this.getValueByPath(path);
            if (value !== undefined) {
                const result = this.validateAgainstSchema(value, schema);
                if (result.valid === false) {
                    errors.push({
                        path,
                        errors: result.errors,
                        value
                    });
                } else if (result.warnings && result.warnings.length > 0) {
                    warnings.push({
                        path,
                        warnings: result.warnings,
                        value
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a value against a JSON Schema
     * @param {*} value - Value to validate
     * @param {Object} schema - JSON Schema
     * @returns {Object} Validation result
     */
    validateAgainstSchema(value, schema) {
        // Simple JSON Schema validation (basic implementation)
        const errors = [];
        const warnings = [];

        // Type validation
        if (schema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== schema.type) {
                errors.push(`Expected type '${schema.type}', got '${actualType}'`);
            }
        }

        // Required fields for objects
        if (schema.type === 'object' && schema.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
                if (!(field in value)) {
                    errors.push(`Missing required field '${field}'`);
                }
            }
        }

        // Minimum/maximum for numbers
        if (schema.type === 'number' || schema.type === 'integer') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push(`Value ${value} is less than minimum ${schema.minimum}`);
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push(`Value ${value} is greater than maximum ${schema.maximum}`);
            }
        }

        // String length validation
        if (schema.type === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push(`String length ${value.length} is less than minimum ${schema.minLength}`);
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push(`String length ${value.length} is greater than maximum ${schema.maxLength}`);
            }
        }

        // Pattern validation for strings
        if (schema.type === 'string' && schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
                errors.push(`String does not match pattern '${schema.pattern}'`);
            }
        }

        // Enum validation
        if (schema.enum && Array.isArray(schema.enum)) {
            if (!schema.enum.includes(value)) {
                errors.push(`Value '${value}' is not in allowed values: [${schema.enum.join(', ')}]`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Enable or disable hot-reloading
     * @param {boolean} enabled - Whether to enable hot-reloading
     */
    setHotReloadEnabled(enabled) {
        this.hotReloadEnabled = enabled;
        
        if (this.debugMode) {
            console.log(`ConfigManager: Hot-reloading ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Check if hot-reloading is enabled
     * @returns {boolean} Hot-reload status
     */
    isHotReloadEnabled() {
        return this.hotReloadEnabled;
    }

    /**
     * Hot-reload configuration from file
     * @param {string} filePath - Path to configuration file
     * @returns {Promise<Object>} Reloaded configuration
     */
    async hotReload(filePath) {
        if (!this.hotReloadEnabled) {
            throw new Error('ConfigManager: Hot-reloading is disabled');
        }

        const oldConfig = { ...this.config };
        const newConfig = await this.loadFromFile(filePath, { merge: false, validate: true });

        this.emitConfigEvent('config:hot-reloaded', { 
            filePath, 
            oldConfig, 
            newConfig 
        });

        if (this.debugMode) {
            console.log(`ConfigManager: Hot-reloaded configuration from ${filePath}`);
        }

        return newConfig;
    }

    /**
     * Get import/export history
     * @returns {Array} History of import/export operations
     */
    getImportExportHistory() {
        return [...this.importExportHistory];
    }

    /**
     * Clear import/export history
     */
    clearImportExportHistory() {
        this.importExportHistory = [];
        
        if (this.debugMode) {
            console.log('ConfigManager: Cleared import/export history');
        }
    }

    /**
     * Add operation to history
     * @param {string} operation - Operation type ('import' or 'export')
     * @param {Object} details - Operation details
     */
    addToHistory(operation, details) {
        this.importExportHistory.push({
            operation,
            ...details,
            timestamp: Date.now()
        });

        // Keep history size manageable
        if (this.importExportHistory.length > this.maxHistorySize) {
            this.importExportHistory.shift();
        }
    }

    /**
     * Convert object to YAML format
     * @param {Object} obj - Object to convert
     * @returns {string} YAML string
     */
    toYAML(obj) {
        // Simple YAML conversion (basic implementation)
        const lines = [];
        
        const convertValue = (value, indent = 0) => {
            const spaces = '  '.repeat(indent);
            
            if (value === null) {
                return `${spaces}null`;
            } else if (typeof value === 'string') {
                return `${spaces}${value}`;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                return `${spaces}${value}`;
            } else if (Array.isArray(value)) {
                if (value.length === 0) {
                    return `${spaces}[]`;
                }
                const arrayLines = [];
                for (const item of value) {
                    arrayLines.push(`${spaces}- ${convertValue(item, 0).trim()}`);
                }
                return arrayLines.join('\n');
            } else if (typeof value === 'object') {
                const objectLines = [];
                for (const [key, val] of Object.entries(value)) {
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        objectLines.push(`${spaces}${key}:`);
                        objectLines.push(convertValue(val, indent + 1));
                    } else {
                        objectLines.push(`${spaces}${key}: ${convertValue(val, 0).trim()}`);
                    }
                }
                return objectLines.join('\n');
            }
            
            return `${spaces}${value}`;
        };

        return convertValue(obj);
    }

    /**
     * Convert configuration to environment variable format
     * @param {Object} config - Configuration object
     * @returns {string} Environment variable format
     */
    toEnvFormat(config) {
        const lines = [];
        
        const flattenObject = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenObject(value, fullKey);
                } else {
                    const envValue = Array.isArray(value) ? value.join(',') : String(value);
                    lines.push(`${fullKey}=${envValue}`);
                }
            }
        };

        flattenObject(config);
        return lines.join('\n');
    }

    /**
     * Parse environment variable format
     * @param {string} envData - Environment variable data
     * @returns {Object} Parsed configuration
     */
    parseEnvFormat(envData) {
        const config = {};
        
        const lines = envData.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=');
                    
                    // Convert key back to nested structure
                    const keys = key.toLowerCase().split('_');
                    let current = config;
                    
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (!(keys[i] in current)) {
                            current[keys[i]] = {};
                        }
                        current = current[keys[i]];
                    }
                    
                    // Parse value
                    let parsedValue = value;
                    if (value === 'true') parsedValue = true;
                    else if (value === 'false') parsedValue = false;
                    else if (value === 'null') parsedValue = null;
                    else if (!isNaN(value) && value !== '') {
                        parsedValue = value.includes('.') ? parseFloat(value) : parseInt(value);
                    } else if (value.includes(',')) {
                        parsedValue = value.split(',').map(v => v.trim());
                    }
                    
                    current[keys[keys.length - 1]] = parsedValue;
                }
            }
        }
        
        return config;
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
            persistent: this.persistent,
            // Task 1.3.2: Configuration Features
            environment: this.environment,
            templatesCount: this.templates.size,
            validationSchemasCount: this.validationSchemas.size,
            hotReloadEnabled: this.hotReloadEnabled,
            importExportHistorySize: this.importExportHistory.length,
            environmentOverridesCount: this.environmentOverrides.size
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
    module.exports = ConfigManager;
} else if (typeof window !== 'undefined') {
    window.ConfigManager = ConfigManager;
} 