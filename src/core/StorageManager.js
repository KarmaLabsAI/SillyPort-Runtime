/**
 * StorageManager - IndexedDB-based storage for SillyTavern Browser Runtime
 * 
 * Provides persistent data management using IndexedDB for client-side storage,
 * ensuring data persistence across browser sessions while maintaining performance
 * and reliability.
 */
class StorageManager {
    constructor(eventBus = null) {
        this.eventBus = eventBus;
        this.db = null;
        this.dbName = 'SillyTavernRuntime';
        this.version = 1;
        this.objectStores = new Map();
        this.debugMode = false;
        this.initialized = false;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Initialize the IndexedDB database
     * @param {Object} options - Initialization options
     * @param {string} options.dbName - Database name
     * @param {number} options.version - Database version
     * @param {Array} options.objectStores - Object store configurations
     * @returns {Promise<boolean>} Success status
     */
    async init(options = {}) {
        const { 
            dbName = this.dbName, 
            version = this.version,
            objectStores = this.getDefaultObjectStores()
        } = options;

        this.dbName = dbName;
        this.version = version;

        try {
            if (this.debugMode) {
                console.log(`StorageManager: Initializing database '${this.dbName}' version ${this.version}`);
            }

            // Check if IndexedDB is available
            if (!this.isIndexedDBSupported()) {
                throw new Error('IndexedDB is not supported in this environment');
            }

            // Open database
            this.db = await this.openDatabase();
            
            // Configure object stores
            await this.configureObjectStores(objectStores);
            
            this.initialized = true;

            this.emitStorageEvent('storage:initialized', { 
                dbName: this.dbName, 
                version: this.version,
                objectStores: Array.from(this.objectStores.keys())
            });

            if (this.debugMode) {
                console.log(`StorageManager: Database initialized successfully`);
            }

            return true;
        } catch (error) {
            console.error('StorageManager: Database initialization failed:', error);
            this.emitStorageEvent('storage:init-error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get default object store configurations
     * @returns {Array} Default object store configurations
     */
    getDefaultObjectStores() {
        return [
            {
                name: 'characters',
                keyPath: 'id',
                indexes: [
                    { name: 'name', keyPath: 'name' },
                    { name: 'createdAt', keyPath: 'createdAt' },
                    { name: 'updatedAt', keyPath: 'updatedAt' }
                ]
            },
            {
                name: 'chats',
                keyPath: 'id',
                indexes: [
                    { name: 'characterId', keyPath: 'characterId' },
                    { name: 'createdAt', keyPath: 'createdAt' },
                    { name: 'updatedAt', keyPath: 'updatedAt' }
                ]
            },
            {
                name: 'cache',
                keyPath: 'key',
                indexes: [
                    { name: 'type', keyPath: 'type' },
                    { name: 'expiresAt', keyPath: 'expiresAt' }
                ]
            },
            {
                name: 'configuration',
                keyPath: 'key',
                indexes: [
                    { name: 'category', keyPath: 'category' },
                    { name: 'updatedAt', keyPath: 'updatedAt' }
                ]
            },
            {
                name: 'assets',
                keyPath: 'id',
                indexes: [
                    { name: 'type', keyPath: 'type' },
                    { name: 'characterId', keyPath: 'characterId' },
                    { name: 'createdAt', keyPath: 'createdAt' }
                ]
            }
        ];
    }

    /**
     * Open IndexedDB database with retry logic
     * @returns {Promise<IDBDatabase>} Database instance
     */
    async openDatabase() {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.openDatabaseRequest();
            } catch (error) {
                lastError = error;
                
                if (this.debugMode) {
                    console.log(`StorageManager: Database open attempt ${attempt} failed:`, error.message);
                }
                
                if (attempt < this.maxRetries) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }
        
        throw new Error(`Failed to open database after ${this.maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * Create IndexedDB open request
     * @returns {Promise<IDBDatabase>} Database instance
     */
    openDatabaseRequest() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                reject(new Error(`Database open failed: ${request.error.message}`));
            };
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onupgradeneeded = (event) => {
                this.handleUpgrade(event);
            };
        });
    }

    /**
     * Handle database upgrade
     * @param {IDBVersionChangeEvent} event - Upgrade event
     */
    handleUpgrade(event) {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;

        if (this.debugMode) {
            console.log(`StorageManager: Upgrading database from version ${oldVersion} to ${newVersion}`);
        }

        // Store upgrade information
        this.emitStorageEvent('storage:upgrading', { 
            oldVersion, 
            newVersion 
        });
    }

    /**
     * Configure object stores
     * @param {Array} objectStores - Object store configurations
     */
    async configureObjectStores(objectStores) {
        for (const storeConfig of objectStores) {
            await this.createObjectStore(storeConfig);
        }
    }

    /**
     * Create an object store
     * @param {Object} config - Object store configuration
     * @param {string} config.name - Store name
     * @param {string} config.keyPath - Key path
     * @param {Array} config.indexes - Index configurations
     * @returns {Promise<boolean>} Success status
     */
    async createObjectStore(config) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([config.name], 'readwrite');
            const store = transaction.objectStore(config.name);

            // Create indexes
            if (config.indexes) {
                for (const indexConfig of config.indexes) {
                    try {
                        store.createIndex(indexConfig.name, indexConfig.keyPath, {
                            unique: indexConfig.unique || false,
                            multiEntry: indexConfig.multiEntry || false
                        });
                    } catch (error) {
                        // Index might already exist
                        if (this.debugMode) {
                            console.log(`StorageManager: Index '${indexConfig.name}' might already exist:`, error.message);
                        }
                    }
                }
            }

            transaction.oncomplete = () => {
                this.objectStores.set(config.name, config);
                resolve(true);
            };

            transaction.onerror = () => {
                reject(new Error(`Failed to create object store '${config.name}': ${transaction.error.message}`));
            };
        });
    }

    /**
     * Save data to an object store
     * @param {string} storeName - Object store name
     * @param {Object} data - Data to save
     * @param {Object} options - Save options
     * @param {boolean} options.overwrite - Whether to overwrite existing data
     * @returns {Promise<string>} Saved data key
     */
    async save(storeName, data, options = {}) {
        const { overwrite = true } = options;

        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        if (!this.objectStores.has(storeName)) {
            throw new Error(`StorageManager: Object store '${storeName}' not found`);
        }

        try {
            const key = await this.performTransaction(storeName, 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = overwrite ? 
                        store.put(data) : 
                        store.add(data);

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = () => {
                        reject(new Error(`Save operation failed: ${request.error.message}`));
                    };
                });
            });

            this.emitStorageEvent('storage:saved', { 
                storeName, 
                key, 
                data 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Saved data to '${storeName}' with key:`, key);
            }

            return key;
        } catch (error) {
            console.error(`StorageManager: Save operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:save-error', { 
                storeName, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Load data from an object store
     * @param {string} storeName - Object store name
     * @param {string} key - Data key
     * @returns {Promise<Object|null>} Loaded data or null if not found
     */
    async load(storeName, key) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        if (!this.objectStores.has(storeName)) {
            throw new Error(`StorageManager: Object store '${storeName}' not found`);
        }

        try {
            const data = await this.performTransaction(storeName, 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.get(key);

                    request.onsuccess = () => {
                        resolve(request.result || null);
                    };

                    request.onerror = () => {
                        reject(new Error(`Load operation failed: ${request.error.message}`));
                    };
                });
            });

            this.emitStorageEvent('storage:loaded', { 
                storeName, 
                key, 
                data 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Loaded data from '${storeName}' with key:`, key);
            }

            return data;
        } catch (error) {
            console.error(`StorageManager: Load operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:load-error', { 
                storeName, 
                key, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Update data in an object store
     * @param {string} storeName - Object store name
     * @param {string} key - Data key
     * @param {Object} updates - Data updates
     * @returns {Promise<boolean>} Success status
     */
    async update(storeName, key, updates) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            // Load existing data
            const existingData = await this.load(storeName, key);
            if (!existingData) {
                throw new Error(`Data with key '${key}' not found in store '${storeName}'`);
            }

            // Merge updates
            const updatedData = { ...existingData, ...updates };
            
            // Save updated data
            await this.save(storeName, updatedData, { overwrite: true });

            this.emitStorageEvent('storage:updated', { 
                storeName, 
                key, 
                updates, 
                data: updatedData 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Updated data in '${storeName}' with key:`, key);
            }

            return true;
        } catch (error) {
            console.error(`StorageManager: Update operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:update-error', { 
                storeName, 
                key, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Delete data from an object store
     * @param {string} storeName - Object store name
     * @param {string} key - Data key
     * @returns {Promise<boolean>} Success status
     */
    async delete(storeName, key) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            const success = await this.performTransaction(storeName, 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(key);

                    request.onsuccess = () => {
                        resolve(true);
                    };

                    request.onerror = () => {
                        reject(new Error(`Delete operation failed: ${request.error.message}`));
                    };
                });
            });

            this.emitStorageEvent('storage:deleted', { 
                storeName, 
                key 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Deleted data from '${storeName}' with key:`, key);
            }

            return success;
        } catch (error) {
            console.error(`StorageManager: Delete operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:delete-error', { 
                storeName, 
                key, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Query data from an object store
     * @param {string} storeName - Object store name
     * @param {Object} query - Query parameters
     * @param {string} query.index - Index name to query
     * @param {*} query.value - Value to match
     * @param {string} query.range - Range type ('equals', 'startsWith', 'bound')
     * @param {*} query.lowerBound - Lower bound for range queries
     * @param {*} query.upperBound - Upper bound for range queries
     * @param {number} query.limit - Maximum number of results
     * @returns {Promise<Array>} Query results
     */
    async query(storeName, query = {}) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            const results = await this.performTransaction(storeName, 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    let request;
                    const results = [];

                    // Determine query strategy
                    if (query.index) {
                        const index = store.index(query.index);
                        
                        if (query.range === 'bound' && query.lowerBound !== undefined && query.upperBound !== undefined) {
                            request = index.openCursor(IDBKeyRange.bound(query.lowerBound, query.upperBound));
                        } else if (query.range === 'startsWith' && query.value !== undefined) {
                            request = index.openCursor(IDBKeyRange.lowerBound(query.value));
                        } else {
                            request = index.openCursor(query.value);
                        }
                    } else {
                        request = store.openCursor();
                    }

                    request.onsuccess = () => {
                        const cursor = request.result;
                        if (cursor) {
                            results.push(cursor.value);
                            
                            // Apply limit
                            if (query.limit && results.length >= query.limit) {
                                resolve(results);
                                return;
                            }
                            
                            cursor.continue();
                        } else {
                            resolve(results);
                        }
                    };

                    request.onerror = () => {
                        reject(new Error(`Query operation failed: ${request.error.message}`));
                    };
                });
            });

            this.emitStorageEvent('storage:queried', { 
                storeName, 
                query, 
                results: results.length 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Queried '${storeName}' with ${results.length} results`);
            }

            return results;
        } catch (error) {
            console.error(`StorageManager: Query operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:query-error', { 
                storeName, 
                query, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get all data from an object store
     * @param {string} storeName - Object store name
     * @returns {Promise<Array>} All data
     */
    async getAll(storeName) {
        return this.query(storeName);
    }

    /**
     * Count records in an object store
     * @param {string} storeName - Object store name
     * @returns {Promise<number>} Record count
     */
    async count(storeName) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            const count = await this.performTransaction(storeName, 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.count();

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = () => {
                        reject(new Error(`Count operation failed: ${request.error.message}`));
                    };
                });
            });

            if (this.debugMode) {
                console.log(`StorageManager: Counted ${count} records in '${storeName}'`);
            }

            return count;
        } catch (error) {
            console.error(`StorageManager: Count operation failed for '${storeName}':`, error);
            throw error;
        }
    }

    /**
     * Clear all data from an object store
     * @param {string} storeName - Object store name
     * @returns {Promise<boolean>} Success status
     */
    async clear(storeName) {
        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            const success = await this.performTransaction(storeName, 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.clear();

                    request.onsuccess = () => {
                        resolve(true);
                    };

                    request.onerror = () => {
                        reject(new Error(`Clear operation failed: ${request.error.message}`));
                    };
                });
            });

            this.emitStorageEvent('storage:cleared', { 
                storeName 
            });

            if (this.debugMode) {
                console.log(`StorageManager: Cleared all data from '${storeName}'`);
            }

            return success;
        } catch (error) {
            console.error(`StorageManager: Clear operation failed for '${storeName}':`, error);
            this.emitStorageEvent('storage:clear-error', { 
                storeName, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Perform a database transaction
     * @param {string} storeName - Object store name
     * @param {string} mode - Transaction mode ('readonly', 'readwrite')
     * @param {Function} operation - Operation to perform
     * @returns {Promise<*>} Operation result
     */
    async performTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
                // Transaction completed successfully
            };

            transaction.onerror = () => {
                reject(new Error(`Transaction failed: ${transaction.error.message}`));
            };

            transaction.onabort = () => {
                reject(new Error(`Transaction aborted: ${transaction.error?.message || 'Unknown error'}`));
            };

            // Perform the operation
            operation(store).then(resolve).catch(reject);
        });
    }

    /**
     * Check if IndexedDB is supported
     * @returns {boolean} Support status
     */
    isIndexedDBSupported() {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Database statistics
     */
    async getStats() {
        if (!this.initialized) {
            return { initialized: false };
        }

        const stats = {
            initialized: this.initialized,
            dbName: this.dbName,
            version: this.version,
            objectStores: Array.from(this.objectStores.keys()),
            storeStats: {}
        };

        // Get statistics for each object store
        for (const storeName of this.objectStores.keys()) {
            try {
                const count = await this.count(storeName);
                stats.storeStats[storeName] = { count };
            } catch (error) {
                stats.storeStats[storeName] = { error: error.message };
            }
        }

        return stats;
    }

    /**
     * Close the database connection
     * @returns {Promise<boolean>} Success status
     */
    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;

            this.emitStorageEvent('storage:closed', {});

            if (this.debugMode) {
                console.log('StorageManager: Database connection closed');
            }

            return true;
        }
        return false;
    }

    /**
     * Delete the database
     * @returns {Promise<boolean>} Success status
     */
    async deleteDatabase() {
        if (this.db) {
            await this.close();
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);

            request.onsuccess = () => {
                this.emitStorageEvent('storage:deleted', { dbName: this.dbName });
                
                if (this.debugMode) {
                    console.log(`StorageManager: Database '${this.dbName}' deleted`);
                }
                
                resolve(true);
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete database: ${request.error.message}`));
            };
        });
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        
        if (this.debugMode) {
            console.log('StorageManager: Debug mode enabled');
        }
    }

    /**
     * Set retry configuration
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} retryDelay - Delay between retries in milliseconds
     */
    setRetryConfig(maxRetries, retryDelay) {
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    /**
     * Emit storage events
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    emitStorageEvent(eventName, data) {
        if (this.eventBus) {
            this.eventBus.emit(eventName, {
                ...data,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager };
} else if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
} 