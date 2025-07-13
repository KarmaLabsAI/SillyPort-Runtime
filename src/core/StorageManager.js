/**
 * StorageManager - IndexedDB-based storage for SillyTavern Browser Runtime
 * 
 * Provides persistent data management using IndexedDB for client-side storage,
 * ensuring data persistence across browser sessions while maintaining performance
 * and reliability.
 */
const { compress, decompress } = require('../utils/Compressor.js');

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
        
        // Task 1.4.2: Storage Features
        this.compressionEnabled = true;
        this.compressionThreshold = 1024; // 1KB
        this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.maxStorageQuota = 50 * 1024 * 1024; // 50MB
        this.cleanupTimer = null;
        this.migrationVersion = 1;
    }

    /**
     * Initialize the IndexedDB database
     * @param {Object} options - Initialization options
     * @param {string} options.dbName - Database name
     * @param {number} options.version - Database version
     * @param {Array} options.objectStores - Object store configurations
     * @param {boolean} options.compressionEnabled - Enable data compression
     * @param {number} options.compressionThreshold - Compression threshold in bytes
     * @param {number} options.maxStorageQuota - Maximum storage quota in bytes
     * @returns {Promise<boolean>} Success status
     */
    async init(options = {}) {
        const { 
            dbName = this.dbName, 
            version = this.version,
            objectStores = this.getDefaultObjectStores(),
            compressionEnabled = this.compressionEnabled,
            compressionThreshold = this.compressionThreshold,
            maxStorageQuota = this.maxStorageQuota
        } = options;

        this.dbName = dbName;
        this.version = version;
        this.compressionEnabled = compressionEnabled;
        this.compressionThreshold = compressionThreshold;
        this.maxStorageQuota = maxStorageQuota;

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

            // Start automatic cleanup
            this.startCleanupRoutine();

            this.emitStorageEvent('storage:initialized', { 
                dbName: this.dbName, 
                version: this.version,
                objectStores: Array.from(this.objectStores.keys()),
                compressionEnabled: this.compressionEnabled,
                maxStorageQuota: this.maxStorageQuota
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
     * Save data to an object store with compression support
     * @param {string} storeName - Object store name
     * @param {Object} data - Data to save
     * @param {Object} options - Save options
     * @param {boolean} options.overwrite - Whether to overwrite existing data
     * @param {boolean} options.compress - Force compression (overrides threshold)
     * @returns {Promise<string>} Saved data key
     */
    async save(storeName, data, options = {}) {
        const { overwrite = true, compress = null } = options;

        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        if (!this.objectStores.has(storeName)) {
            throw new Error(`StorageManager: Object store '${storeName}' not found`);
        }

        try {
            // Check storage quota before saving
            await this.checkStorageQuota();

            // Prepare data for storage
            const dataToStore = await this.prepareDataForStorage(data, compress);

            const key = await this.performTransaction(storeName, 'readwrite', (store) => {
                return new Promise((resolve, reject) => {
                    const request = overwrite ? 
                        store.put(dataToStore) : 
                        store.add(dataToStore);

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
                data: dataToStore,
                compressed: dataToStore.compressed || false,
                originalSize: dataToStore.originalSize,
                compressedSize: dataToStore.compressedSize
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
     * Load data from an object store with decompression support
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
            const storedData = await this.performTransaction(storeName, 'readonly', (store) => {
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

            if (!storedData) {
                return null;
            }

            // Decompress data if needed
            const data = await this.prepareDataForUse(storedData);

            this.emitStorageEvent('storage:loaded', { 
                storeName, 
                key, 
                data,
                compressed: storedData.compressed || false
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
     * Prepare data for storage (compression)
     * @param {Object} data - Data to prepare
     * @param {boolean} forceCompress - Force compression
     * @returns {Promise<Object>} Prepared data
     */
    async prepareDataForStorage(data, forceCompress = null) {
        const dataString = JSON.stringify(data);
        const dataSize = new Blob([dataString]).size;
        
        let shouldCompress = forceCompress !== null ? forceCompress : 
            (this.compressionEnabled && dataSize > this.compressionThreshold);

        if (shouldCompress) {
            try {
                const compressed = await this.compressData(dataString);
                return {
                    compressed: true,
                    originalSize: dataSize,
                    compressedSize: compressed.length,
                    data: compressed,
                    timestamp: Date.now()
                };
            } catch (error) {
                if (this.debugMode) {
                    console.warn('StorageManager: Compression failed, storing uncompressed:', error.message);
                }
                // Fall back to uncompressed storage
                shouldCompress = false;
            }
        }

        return {
            compressed: false,
            originalSize: dataSize,
            compressedSize: dataSize,
            data: dataString,
            timestamp: Date.now()
        };
    }

    /**
     * Prepare data for use (decompression)
     * @param {Object} storedData - Stored data object
     * @returns {Promise<Object>} Decompressed data
     */
    async prepareDataForUse(storedData) {
        if (storedData.compressed) {
            try {
                const decompressed = await this.decompressData(storedData.data);
                return JSON.parse(decompressed);
            } catch (error) {
                console.error('StorageManager: Decompression failed:', error);
                throw new Error('Failed to decompress stored data');
            }
        } else {
            return JSON.parse(storedData.data);
        }
    }

    /**
     * Compress data using Compressor utility
     * @param {string} data - Data to compress
     * @returns {Promise<string>} Compressed data as base64
     */
    async compressData(data) {
        return await compress(data);
    }

    /**
     * Decompress data using Compressor utility
     * @param {string} compressedData - Compressed data as base64
     * @returns {Promise<string>} Decompressed data
     */
    async decompressData(compressedData) {
        return await decompress(compressedData);
    }

    /**
     * Check storage quota and cleanup if necessary
     * @returns {Promise<void>}
     */
    async checkStorageQuota() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || this.maxStorageQuota;
                
                if (usage > quota * 0.9) { // 90% of quota
                    if (this.debugMode) {
                        console.warn('StorageManager: Storage quota nearly exceeded, running cleanup');
                    }
                    await this.runCleanup();
                }
            } catch (error) {
                if (this.debugMode) {
                    console.warn('StorageManager: Could not check storage quota:', error.message);
                }
            }
        }
    }

    /**
     * Start automatic cleanup routine
     */
    startCleanupRoutine() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.runCleanup().catch(error => {
                console.error('StorageManager: Automatic cleanup failed:', error);
            });
        }, this.cleanupInterval);
    }

    /**
     * Stop automatic cleanup routine
     */
    stopCleanupRoutine() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Run cleanup routine
     * @param {Object} options - Cleanup options
     * @param {number} options.maxAge - Maximum age of data in milliseconds
     * @param {boolean} options.cleanupExpired - Clean up expired cache entries
     * @returns {Promise<Object>} Cleanup results
     */
    async runCleanup(options = {}) {
        const { maxAge = 30 * 24 * 60 * 60 * 1000, cleanupExpired = true } = options; // 30 days default
        
        if (!this.initialized) {
            return { cleaned: 0, errors: 0 };
        }

        const results = { cleaned: 0, errors: 0 };
        const cutoffTime = Date.now() - maxAge;

        try {
            // Clean up expired cache entries
            if (cleanupExpired && this.objectStores.has('cache')) {
                const expiredCache = await this.query('cache', {
                    index: 'expiresAt',
                    range: 'bound',
                    lowerBound: 0,
                    upperBound: cutoffTime
                });

                for (const item of expiredCache) {
                    try {
                        await this.delete('cache', item.key);
                        results.cleaned++;
                    } catch (error) {
                        results.errors++;
                        if (this.debugMode) {
                            console.warn('StorageManager: Failed to delete expired cache item:', error.message);
                        }
                    }
                }
            }

            // Clean up old data based on timestamp
            for (const storeName of this.objectStores.keys()) {
                if (storeName === 'cache') continue; // Already handled above
                
                try {
                    const oldData = await this.query(storeName, {
                        range: 'bound',
                        lowerBound: 0,
                        upperBound: cutoffTime
                    });

                    for (const item of oldData) {
                        if (item.timestamp && item.timestamp < cutoffTime) {
                            try {
                                await this.delete(storeName, item.id || item.key);
                                results.cleaned++;
                            } catch (error) {
                                results.errors++;
                                if (this.debugMode) {
                                    console.warn(`StorageManager: Failed to delete old item from ${storeName}:`, error.message);
                                }
                            }
                        }
                    }
                } catch (error) {
                    results.errors++;
                    if (this.debugMode) {
                        console.warn(`StorageManager: Failed to cleanup ${storeName}:`, error.message);
                    }
                }
            }

            this.emitStorageEvent('storage:cleanup-completed', results);

            if (this.debugMode) {
                console.log(`StorageManager: Cleanup completed. Cleaned: ${results.cleaned}, Errors: ${results.errors}`);
            }

            return results;
        } catch (error) {
            console.error('StorageManager: Cleanup failed:', error);
            this.emitStorageEvent('storage:cleanup-error', { error: error.message });
            throw error;
        }
    }

    /**
     * Create backup of all data
     * @param {Object} options - Backup options
     * @param {boolean} options.includeMetadata - Include metadata in backup
     * @returns {Promise<Object>} Backup data
     */
    async createBackup(options = {}) {
        const { includeMetadata = true } = options;

        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        try {
            const backup = {
                version: this.migrationVersion,
                timestamp: Date.now(),
                dbName: this.dbName,
                dbVersion: this.version,
                data: {}
            };

            if (includeMetadata) {
                backup.metadata = {
                    compressionEnabled: this.compressionEnabled,
                    compressionThreshold: this.compressionThreshold,
                    maxStorageQuota: this.maxStorageQuota,
                    objectStores: Array.from(this.objectStores.keys())
                };
            }

            // Backup all data from all object stores
            for (const storeName of this.objectStores.keys()) {
                try {
                    const allData = await this.getAll(storeName);
                    backup.data[storeName] = allData;
                } catch (error) {
                    if (this.debugMode) {
                        console.warn(`StorageManager: Failed to backup ${storeName}:`, error.message);
                    }
                    backup.data[storeName] = { error: error.message };
                }
            }

            this.emitStorageEvent('storage:backup-created', {
                timestamp: backup.timestamp,
                size: JSON.stringify(backup).length
            });

            if (this.debugMode) {
                console.log('StorageManager: Backup created successfully');
            }

            return backup;
        } catch (error) {
            console.error('StorageManager: Backup creation failed:', error);
            this.emitStorageEvent('storage:backup-error', { error: error.message });
            throw error;
        }
    }

    /**
     * Restore data from backup
     * @param {Object} backup - Backup data
     * @param {Object} options - Restore options
     * @param {boolean} options.clearExisting - Clear existing data before restore
     * @param {Array} options.stores - Specific stores to restore
     * @returns {Promise<Object>} Restore results
     */
    async restoreBackup(backup, options = {}) {
        const { clearExisting = false, stores = null } = options;

        if (!this.initialized) {
            throw new Error('StorageManager: Database not initialized');
        }

        if (!backup || !backup.data) {
            throw new Error('StorageManager: Invalid backup data');
        }

        try {
            const results = { restored: 0, errors: 0, migrated: 0 };

            // Clear existing data if requested
            if (clearExisting) {
                for (const storeName of this.objectStores.keys()) {
                    if (!stores || stores.includes(storeName)) {
                        await this.clear(storeName);
                    }
                }
            }

            // Restore data
            const storesToRestore = stores || Object.keys(backup.data);
            
            for (const storeName of storesToRestore) {
                if (!this.objectStores.has(storeName)) {
                    if (this.debugMode) {
                        console.warn(`StorageManager: Store ${storeName} not found, skipping`);
                    }
                    continue;
                }

                const storeData = backup.data[storeName];
                if (storeData.error) {
                    results.errors++;
                    continue;
                }

                // Handle migration if needed
                if (backup.version < this.migrationVersion) {
                    storeData = await this.migrateData(storeData, backup.version, this.migrationVersion);
                    results.migrated++;
                }

                for (const item of storeData) {
                    try {
                        await this.save(storeName, item, { overwrite: true });
                        results.restored++;
                    } catch (error) {
                        results.errors++;
                        if (this.debugMode) {
                            console.warn(`StorageManager: Failed to restore item in ${storeName}:`, error.message);
                        }
                    }
                }
            }

            this.emitStorageEvent('storage:backup-restored', results);

            if (this.debugMode) {
                console.log(`StorageManager: Backup restored. Restored: ${results.restored}, Errors: ${results.errors}, Migrated: ${results.migrated}`);
            }

            return results;
        } catch (error) {
            console.error('StorageManager: Backup restoration failed:', error);
            this.emitStorageEvent('storage:restore-error', { error: error.message });
            throw error;
        }
    }

    /**
     * Migrate data between versions
     * @param {Array} data - Data to migrate
     * @param {number} fromVersion - Source version
     * @param {number} toVersion - Target version
     * @returns {Promise<Array>} Migrated data
     */
    async migrateData(data, fromVersion, toVersion) {
        if (fromVersion === toVersion) {
            return data;
        }

        let migratedData = data;

        // Apply migrations in sequence
        for (let version = fromVersion; version < toVersion; version++) {
            migratedData = await this.applyMigration(migratedData, version, version + 1);
        }

        return migratedData;
    }

    /**
     * Apply specific migration
     * @param {Array} data - Data to migrate
     * @param {number} fromVersion - Source version
     * @param {number} toVersion - Target version
     * @returns {Promise<Array>} Migrated data
     */
    async applyMigration(data, fromVersion, toVersion) {
        // Example migration: v1 to v2
        if (fromVersion === 1 && toVersion === 2) {
            return data.map(item => ({
                ...item,
                version: 2,
                migratedAt: Date.now()
            }));
        }

        // Add more migrations as needed
        return data;
    }

    /**
     * Export backup to file
     * @param {Object} options - Export options
     * @returns {Promise<Blob>} Backup file as blob
     */
    async exportBackup(options = {}) {
        const backup = await this.createBackup(options);
        const backupString = JSON.stringify(backup, null, 2);
        return new Blob([backupString], { type: 'application/json' });
    }

    /**
     * Import backup from file
     * @param {Blob} file - Backup file
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Restore results
     */
    async importBackup(file, options = {}) {
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            return await this.restoreBackup(backup, options);
        } catch (error) {
            throw new Error(`Failed to import backup: ${error.message}`);
        }
    }

    /**
     * Get storage usage statistics
     * @returns {Promise<Object>} Storage usage statistics
     */
    async getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    usage: estimate.usage || 0,
                    quota: estimate.quota || this.maxStorageQuota,
                    usagePercent: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
                };
            } catch (error) {
                return { error: error.message };
            }
        }
        return { error: 'Storage API not supported' };
    }

    /**
     * Close the database connection
     * @returns {Promise<boolean>} Success status
     */
    async close() {
        // Stop cleanup routine
        this.stopCleanupRoutine();

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
    module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
} 