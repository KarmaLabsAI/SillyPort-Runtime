/**
 * SillyTavernRuntime - Main runtime class for SillyTavern Browser Runtime
 * 
 * Provides the primary interface for integrating the runtime into applications.
 * Orchestrates all core components and manages the runtime lifecycle.
 */

// Import core components
const EventBus = require('./EventBus');
const StateManager = require('./StateManager');
const ConfigManager = require('./ConfigManager');
const StorageManager = require('./StorageManager');

class SillyTavernRuntime {
    constructor(config = {}) {
        // Runtime state
        this.initialized = false;
        this.initializing = false;
        this.version = '1.0.0';
        this.config = config;
        
        // Core components (will be initialized during init)
        this.eventBus = null;
        this.stateManager = null;
        this.configManager = null;
        this.storageManager = null;
        
        // Component initialization order
        this.componentOrder = [
            'eventBus',
            'stateManager', 
            'configManager',
            'storageManager'
        ];
        
        // Initialization status tracking
        this.initStatus = {
            eventBus: false,
            stateManager: false,
            configManager: false,
            storageManager: false
        };
        
        // Error tracking
        this.initErrors = [];
        
        // Debug mode
        this.debugMode = config.debugMode || false;
        
        // Lifecycle events
        this.lifecycleEvents = [
            'runtime:init-start',
            'runtime:component-init',
            'runtime:component-ready',
            'runtime:init-complete',
            'runtime:init-error',
            'runtime:destroy-start',
            'runtime:destroy-complete'
        ];
    }

    /**
     * Initialize the runtime with all components
     * @param {Object} options - Initialization options
     * @param {Object} options.config - Configuration to load
     * @param {boolean} options.debugMode - Enable debug mode
     * @param {Object} options.storage - Storage configuration
     * @param {Object} options.state - Initial state
     * @returns {Promise<boolean>} Success status
     */
    async init(options = {}) {
        if (this.initialized) {
            throw new Error('SillyTavernRuntime: Already initialized');
        }

        if (this.initializing) {
            throw new Error('SillyTavernRuntime: Initialization already in progress');
        }

        this.initializing = true;
        this.initErrors = [];

        try {
            if (this.debugMode) {
                console.log('SillyTavernRuntime: Starting initialization...');
            }

            // Emit initialization start event
            this.emitLifecycleEvent('runtime:init-start', {
                version: this.version,
                config: this.config,
                options
            });

            // Initialize components in order
            await this.initializeComponents(options);

            // Load configuration if provided
            if (options.config) {
                await this.loadConfiguration(options.config);
            }

            // Set runtime as initialized
            this.initialized = true;
            this.initializing = false;

            // Update state
            if (this.stateManager) {
                this.stateManager.setState('runtime.initialized', true);
                this.stateManager.setState('runtime.lastUpdate', Date.now());
            }

            // Emit initialization complete event
            this.emitLifecycleEvent('runtime:init-complete', {
                version: this.version,
                components: Object.keys(this.initStatus).filter(key => this.initStatus[key]),
                errors: this.initErrors
            });

            if (this.debugMode) {
                console.log('SillyTavernRuntime: Initialization completed successfully');
                console.log('SillyTavernRuntime: Components initialized:', Object.keys(this.initStatus).filter(key => this.initStatus[key]));
            }

            return true;

        } catch (error) {
            this.initializing = false;
            this.initErrors.push({
                component: 'runtime',
                error: error.message,
                timestamp: Date.now()
            });

            // Emit initialization error event
            this.emitLifecycleEvent('runtime:init-error', {
                error: error.message,
                errors: this.initErrors
            });

            if (this.debugMode) {
                console.error('SillyTavernRuntime: Initialization failed:', error);
                console.error('SillyTavernRuntime: Init errors:', this.initErrors);
            }

            throw error;
        }
    }

    /**
     * Initialize all core components in the correct order
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeComponents(options = {}) {
        for (const componentName of this.componentOrder) {
            try {
                await this.initializeComponent(componentName, options);
            } catch (error) {
                this.initErrors.push({
                    component: componentName,
                    error: error.message,
                    timestamp: Date.now()
                });

                // Emit component initialization error
                this.emitLifecycleEvent('runtime:component-init', {
                    component: componentName,
                    status: 'error',
                    error: error.message
                });

                throw new Error(`Failed to initialize ${componentName}: ${error.message}`);
            }
        }
    }

    /**
     * Initialize a specific component
     * @param {string} componentName - Name of the component to initialize
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeComponent(componentName, options = {}) {
        if (this.debugMode) {
            console.log(`SillyTavernRuntime: Initializing ${componentName}...`);
        }

        // Emit component initialization start event
        this.emitLifecycleEvent('runtime:component-init', {
            component: componentName,
            status: 'start'
        });

        switch (componentName) {
            case 'eventBus':
                await this.initializeEventBus(options);
                break;
            case 'stateManager':
                await this.initializeStateManager(options);
                break;
            case 'configManager':
                await this.initializeConfigManager(options);
                break;
            case 'storageManager':
                await this.initializeStorageManager(options);
                break;
            default:
                throw new Error(`Unknown component: ${componentName}`);
        }

        this.initStatus[componentName] = true;

        // Emit component ready event
        this.emitLifecycleEvent('runtime:component-ready', {
            component: componentName,
            status: 'ready'
        });

        if (this.debugMode) {
            console.log(`SillyTavernRuntime: ${componentName} initialized successfully`);
        }
    }

    /**
     * Initialize EventBus component
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeEventBus(options = {}) {
        this.eventBus = new EventBus();
        
        if (options.debugMode !== undefined) {
            this.eventBus.setDebugMode(options.debugMode);
        }

        // Set up global event bus for components that don't have direct access
        if (typeof window !== 'undefined') {
            window.STRuntimeEventBus = this.eventBus;
        }
    }

    /**
     * Initialize StateManager component
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeStateManager(options = {}) {
        if (!this.eventBus) {
            throw new Error('EventBus must be initialized before StateManager');
        }

        this.stateManager = new StateManager(this.eventBus);
        
        if (options.debugMode !== undefined) {
            this.stateManager.setDebugMode(options.debugMode);
        }

        // Set initial state if provided
        if (options.state) {
            for (const [path, value] of Object.entries(options.state)) {
                this.stateManager.setState(path, value, { silent: true });
            }
        }

        // Set runtime state
        this.stateManager.setState('runtime.version', this.version);
        this.stateManager.setState('runtime.initialized', false);
    }

    /**
     * Initialize ConfigManager component
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeConfigManager(options = {}) {
        if (!this.eventBus) {
            throw new Error('EventBus must be initialized before ConfigManager');
        }

        this.configManager = new ConfigManager(this.eventBus);
        
        if (options.debugMode !== undefined) {
            this.configManager.setDebugMode(options.debugMode);
        }

        // Load default configuration
        await this.configManager.load();

        // Set initial configuration if provided
        if (options.config) {
            this.configManager.setDefaults(options.config, true);
        }
    }

    /**
     * Initialize StorageManager component
     * @param {Object} options - Initialization options
     * @returns {Promise<void>}
     */
    async initializeStorageManager(options = {}) {
        if (!this.eventBus) {
            throw new Error('EventBus must be initialized before StorageManager');
        }

        this.storageManager = new StorageManager(this.eventBus);
        
        if (options.debugMode !== undefined) {
            this.storageManager.setDebugMode(options.debugMode);
        }

        // Initialize storage with provided options
        const storageOptions = {
            dbName: options.storage?.dbName,
            version: options.storage?.version,
            objectStores: options.storage?.objectStores,
            compressionEnabled: options.storage?.compressionEnabled,
            compressionThreshold: options.storage?.compressionThreshold,
            maxStorageQuota: options.storage?.maxStorageQuota
        };

        await this.storageManager.init(storageOptions);
    }

    /**
     * Load configuration from file or object
     * @param {Object|string} config - Configuration object or file path
     * @returns {Promise<void>}
     */
    async loadConfiguration(config) {
        if (!this.configManager) {
            throw new Error('ConfigManager not initialized');
        }

        if (typeof config === 'string') {
            // Load from file
            await this.configManager.loadFromFile(config);
        } else if (typeof config === 'object') {
            // Set configuration object
            this.configManager.setDefaults(config, true);
        } else {
            throw new Error('Invalid configuration format');
        }

        if (this.debugMode) {
            console.log('SillyTavernRuntime: Configuration loaded successfully');
        }
    }

    /**
     * Get a component by name
     * @param {string} componentName - Name of the component
     * @returns {Object|null} Component instance or null if not found
     */
    getComponent(componentName) {
        return this[componentName] || null;
    }

    /**
     * Check if a component is initialized
     * @param {string} componentName - Name of the component
     * @returns {boolean} True if component is initialized
     */
    isComponentInitialized(componentName) {
        return this.initStatus[componentName] || false;
    }

    /**
     * Get initialization status for all components
     * @returns {Object} Status object for all components
     */
    getInitStatus() {
        return { ...this.initStatus };
    }

    /**
     * Get initialization errors
     * @returns {Array} Array of initialization errors
     */
    getInitErrors() {
        return [...this.initErrors];
    }

    /**
     * Set debug mode for all components
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;

        if (this.eventBus) {
            this.eventBus.setDebugMode(enabled);
        }

        if (this.stateManager) {
            this.stateManager.setDebugMode(enabled);
        }

        if (this.configManager) {
            this.configManager.setDebugMode(enabled);
        }

        if (this.storageManager) {
            this.storageManager.setDebugMode(enabled);
        }
    }

    /**
     * Get runtime statistics
     * @returns {Object} Runtime statistics
     */
    getStats() {
        const stats = {
            version: this.version,
            initialized: this.initialized,
            initializing: this.initializing,
            components: this.getInitStatus(),
            errors: this.getInitErrors(),
            debugMode: this.debugMode
        };

        // Add component-specific stats
        if (this.eventBus) {
            stats.eventBus = this.eventBus.getStats();
        }

        if (this.stateManager) {
            stats.stateManager = this.stateManager.getStats();
        }

        if (this.configManager) {
            stats.configManager = this.configManager.getStats();
        }

        if (this.storageManager) {
            stats.storageManager = this.storageManager.getStats();
        }

        return stats;
    }

    /**
     * Destroy the runtime and clean up resources
     * @returns {Promise<void>}
     */
    async destroy() {
        if (!this.initialized) {
            return;
        }

        if (this.debugMode) {
            console.log('SillyTavernRuntime: Starting destruction...');
        }

        // Emit destruction start event
        this.emitLifecycleEvent('runtime:destroy-start', {
            version: this.version
        });

        try {
            // Destroy components in reverse order
            const reverseOrder = [...this.componentOrder].reverse();
            
            for (const componentName of reverseOrder) {
                if (this.initStatus[componentName]) {
                    await this.destroyComponent(componentName);
                }
            }

            // Clear runtime state
            this.initialized = false;
            this.initializing = false;
            this.initStatus = {
                eventBus: false,
                stateManager: false,
                configManager: false,
                storageManager: false
            };

            // Clear global references
            if (typeof window !== 'undefined' && window.STRuntimeEventBus) {
                delete window.STRuntimeEventBus;
            }

            // Emit destruction complete event
            this.emitLifecycleEvent('runtime:destroy-complete', {
                version: this.version
            });

            if (this.debugMode) {
                console.log('SillyTavernRuntime: Destruction completed successfully');
            }

        } catch (error) {
            if (this.debugMode) {
                console.error('SillyTavernRuntime: Destruction failed:', error);
            }
            throw error;
        }
    }

    /**
     * Destroy a specific component
     * @param {string} componentName - Name of the component to destroy
     * @returns {Promise<void>}
     */
    async destroyComponent(componentName) {
        if (this.debugMode) {
            console.log(`SillyTavernRuntime: Destroying ${componentName}...`);
        }

        switch (componentName) {
            case 'storageManager':
                if (this.storageManager) {
                    await this.storageManager.close();
                    this.storageManager = null;
                }
                break;
            case 'configManager':
                if (this.configManager) {
                    this.configManager = null;
                }
                break;
            case 'stateManager':
                if (this.stateManager) {
                    this.stateManager = null;
                }
                break;
            case 'eventBus':
                if (this.eventBus) {
                    this.eventBus.removeAllListeners();
                    this.eventBus = null;
                }
                break;
        }

        this.initStatus[componentName] = false;
    }

    /**
     * Emit a lifecycle event
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    emitLifecycleEvent(eventName, data) {
        if (this.eventBus) {
            this.eventBus.emit(eventName, data);
        }

        if (this.debugMode) {
            console.log(`SillyTavernRuntime: Lifecycle event '${eventName}'`, data);
        }
    }

    /**
     * Subscribe to runtime events
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback, options = {}) {
        if (!this.eventBus) {
            throw new Error('EventBus not initialized');
        }

        return this.eventBus.subscribe(eventName, callback, options);
    }

    /**
     * Subscribe to a lifecycle event
     * @param {string} eventName - Lifecycle event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    subscribeToLifecycle(eventName, callback, options = {}) {
        if (!this.lifecycleEvents.includes(eventName)) {
            throw new Error(`Invalid lifecycle event: ${eventName}`);
        }

        return this.subscribe(eventName, callback, options);
    }

    /**
     * Get runtime configuration
     * @param {string} path - Configuration path (optional)
     * @param {*} defaultValue - Default value
     * @returns {*} Configuration value
     */
    getConfig(path, defaultValue = undefined) {
        if (!this.configManager) {
            throw new Error('ConfigManager not initialized');
        }

        return this.configManager.get(path, defaultValue);
    }

    /**
     * Set runtime configuration
     * @param {string} path - Configuration path
     * @param {*} value - Configuration value
     * @param {Object} options - Configuration options
     */
    setConfig(path, value, options = {}) {
        if (!this.configManager) {
            throw new Error('ConfigManager not initialized');
        }

        return this.configManager.set(path, value, options);
    }

    /**
     * Get runtime state
     * @param {string} path - State path (optional)
     * @param {*} defaultValue - Default value
     * @returns {*} State value
     */
    getState(path, defaultValue = undefined) {
        if (!this.stateManager) {
            throw new Error('StateManager not initialized');
        }

        return this.stateManager.getState(path, defaultValue);
    }

    /**
     * Set runtime state
     * @param {string} path - State path
     * @param {*} value - State value
     * @param {Object} options - State options
     */
    setState(path, value, options = {}) {
        if (!this.stateManager) {
            throw new Error('StateManager not initialized');
        }

        return this.stateManager.setState(path, value, options);
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SillyTavernRuntime;
}

// Export for browser environments
if (typeof window !== 'undefined') {
    window.SillyTavernRuntime = SillyTavernRuntime;
} 