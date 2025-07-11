/**
 * StorageManager Tests
 * 
 * Tests for Task 1.4.1: IndexedDB Integration
 * - IndexedDB database initialization
 * - Object store creation and management
 * - Basic CRUD operations
 * - Transaction support
 * - Error handling and recovery
 */

// Import StorageManager
const { StorageManager } = require('../../src/core/StorageManager');

// Mock EventBus for testing
class MockEventBus {
    constructor() {
        this.events = [];
    }

    emit(eventName, data) {
        this.events.push({ eventName, data });
    }

    getEvents() {
        return this.events;
    }

    clear() {
        this.events = [];
    }
}

// Mock IndexedDB for testing
const mockIndexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn()
};

// Mock IDBDatabase
const mockDatabase = {
    close: jest.fn(),
    transaction: jest.fn(),
    createObjectStore: jest.fn(),
    objectStoreNames: {
        contains: jest.fn()
    }
};

// Mock IDBTransaction
const createMockTransaction = () => {
    return {
        objectStore: jest.fn(() => mockObjectStore),
        oncomplete: null,
        onerror: null,
        onabort: null,
        complete() {
            setTimeout(() => {
                if (this.oncomplete) this.oncomplete();
            }, 0);
        },
        error(err) {
            setTimeout(() => {
                if (this.onerror) this.onerror({ target: { error: err } });
            }, 0);
        },
        abort(err) {
            setTimeout(() => {
                if (this.onabort) this.onabort({ target: { error: err } });
            }, 0);
        }
    };
};

// Mock IDBObjectStore
const createMockObjectStore = () => {
    return {
        put: jest.fn((data) => {
            const req = createMockRequest(data.id);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: data.id } }), 0);
            return req;
        }),
        add: jest.fn((data) => {
            const req = createMockRequest(data.id);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: data.id } }), 0);
            return req;
        }),
        get: jest.fn((key) => {
            const req = createMockRequest(null);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: null } }), 0);
            return req;
        }),
        delete: jest.fn((key) => {
            const req = createMockRequest(true);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: true } }), 0);
            return req;
        }),
        clear: jest.fn(() => {
            const req = createMockRequest(true);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: true } }), 0);
            return req;
        }),
        count: jest.fn(() => {
            const req = createMockRequest(0);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: 0 } }), 0);
            return req;
        }),
        openCursor: jest.fn(() => {
            const req = createMockRequest(null);
            setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: null } }), 0);
            return req;
        }),
        createIndex: jest.fn(),
        index: jest.fn(() => mockIndex)
    };
};

// Mock IDBIndex
const mockIndex = {
    openCursor: jest.fn()
};

// Mock IDBRequest
const createMockRequest = (result, error = null) => {
    let _onsuccess = null;
    let _onerror = null;
    const req = {
        result,
        error,
        get onsuccess() { return _onsuccess; },
        set onsuccess(fn) {
            _onsuccess = fn;
            if (fn && error === null && result !== undefined) {
                setTimeout(() => fn({ target: { result } }), 0);
            }
        },
        get onerror() { return _onerror; },
        set onerror(fn) {
            _onerror = fn;
            if (fn && error !== null) {
                setTimeout(() => fn({ target: { error } }), 0);
            }
        }
    };
    return req;
};

// Mock IDBCursor
const createMockCursor = (value, key) => ({
    value,
    key,
    continue: jest.fn()
});

// Setup global IndexedDB mock
global.indexedDB = mockIndexedDB;

let mockTransaction;
let mockObjectStore;

describe('StorageManager', () => {
    let storageManager;
    let mockEventBus;

    beforeEach(() => {
        mockEventBus = new MockEventBus();
        storageManager = new StorageManager(mockEventBus);
        
        // Reset all mocks
        jest.clearAllMocks();
        mockEventBus.clear();
        
        // Setup default mock implementations
        mockObjectStore = createMockObjectStore();
        mockTransaction = createMockTransaction();
        mockDatabase.transaction.mockReturnValue(mockTransaction);
        mockTransaction.objectStore.mockReturnValue(mockObjectStore);
        mockObjectStore.index.mockReturnValue(mockIndex);
    });

    describe('Task 1.4.1: IndexedDB Integration', () => {
        describe('IndexedDB database initialization', () => {
            test('should initialize database successfully', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                const result = await storageManager.init();

                expect(result).toBe(true);
                expect(storageManager.initialized).toBe(true);
                expect(storageManager.db).toBe(mockDatabase);
            });

            test('should handle database initialization with custom options', async () => {
                const customOptions = {
                    dbName: 'TestDB',
                    version: 2,
                    objectStores: [
                        {
                            name: 'test',
                            keyPath: 'id',
                            indexes: [{ name: 'name', keyPath: 'name' }]
                        }
                    ]
                };

                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                await storageManager.init(customOptions);

                expect(storageManager.dbName).toBe('TestDB');
                expect(storageManager.version).toBe(2);
                expect(mockIndexedDB.open).toHaveBeenCalledWith('TestDB', 2);
            });

            test('should handle IndexedDB not supported', async () => {
                // Mock IndexedDB as undefined
                const originalIndexedDB = global.indexedDB;
                delete global.indexedDB;

                await expect(storageManager.init()).rejects.toThrow('IndexedDB is not supported');

                // Restore IndexedDB
                global.indexedDB = originalIndexedDB;
            });

            test('should handle database open errors', async () => {
                const request = createMockRequest(null, { message: 'Database error' });
                mockIndexedDB.open.mockReturnValue(request);
                request.onerror = () => {};

                await expect(storageManager.init()).rejects.toThrow('Database open failed: Database error');
            });

            test('should emit initialization events', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                await storageManager.init();

                const events = mockEventBus.getEvents();
                expect(events).toHaveLength(1);
                expect(events[0].eventName).toBe('storage:initialized');
                expect(events[0].data.dbName).toBe('SillyTavernRuntime');
                expect(events[0].data.version).toBe(1);
            });

            test('should handle database upgrade events', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                await storageManager.init();

                // Simulate upgrade event
                const upgradeEventData = {
                    target: { result: mockDatabase },
                    oldVersion: 0,
                    newVersion: 1
                };

                storageManager.handleUpgrade(upgradeEventData);

                const events = mockEventBus.getEvents();
                const upgradeEvent = events.find(e => e.eventName === 'storage:upgrading');
                expect(upgradeEvent).toBeDefined();
                expect(upgradeEvent.data.oldVersion).toBe(0);
                expect(upgradeEvent.data.newVersion).toBe(1);
            });

            test('should retry database connection on failure', async () => {
                storageManager.setRetryConfig(2, 100);

                // First attempt fails, second succeeds
                const failRequest = createMockRequest(null, { message: 'Connection failed' });
                const successRequest = createMockRequest(mockDatabase);
                
                mockIndexedDB.open
                    .mockReturnValueOnce(failRequest)
                    .mockReturnValueOnce(successRequest);
                failRequest.onerror = () => {};
                successRequest.onsuccess = () => {};

                const result = await storageManager.init();

                expect(result).toBe(true);
                expect(mockIndexedDB.open).toHaveBeenCalledTimes(2);
            });
        });

        describe('Object store creation and management', () => {
            test('should create default object stores', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                await storageManager.init();

                const defaultStores = storageManager.getDefaultObjectStores();
                expect(defaultStores).toHaveLength(5);
                expect(defaultStores.map(s => s.name)).toContain('characters');
                expect(defaultStores.map(s => s.name)).toContain('chats');
                expect(defaultStores.map(s => s.name)).toContain('cache');
                expect(defaultStores.map(s => s.name)).toContain('configuration');
                expect(defaultStores.map(s => s.name)).toContain('assets');
            });

            test('should create object store with indexes', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                const storeConfig = {
                    name: 'test',
                    keyPath: 'id',
                    indexes: [
                        { name: 'name', keyPath: 'name' },
                        { name: 'createdAt', keyPath: 'createdAt' }
                    ]
                };

                await storageManager.createObjectStore(storeConfig);

                expect(mockDatabase.createObjectStore).toHaveBeenCalledWith('test', { keyPath: 'id' });
                expect(mockObjectStore.createIndex).toHaveBeenCalledWith('name', 'name', { unique: false, multiEntry: false });
                expect(mockObjectStore.createIndex).toHaveBeenCalledWith('createdAt', 'createdAt', { unique: false, multiEntry: false });
            });

            test('should handle object store creation errors', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};

                mockTransaction.onerror = () => mockTransaction.onerror({ error: { message: 'Store creation failed' } });

                const storeConfig = { name: 'test', keyPath: 'id' };
                await expect(storageManager.createObjectStore(storeConfig)).rejects.toThrow('Store creation failed');
            });
        });

        describe('Basic CRUD operations', () => {
            beforeEach(async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();
            });

            test('should save data to object store', async () => {
                const testData = { id: 'test1', name: 'Test Character' };
                const putRequest = createMockRequest('test1');
                mockObjectStore.put.mockReturnValue(putRequest);

                const key = await storageManager.save('characters', testData);

                expect(key).toBe('test1');
                expect(mockObjectStore.put).toHaveBeenCalledWith(testData);
            });

            test('should save data with overwrite option', async () => {
                const testData = { id: 'test1', name: 'Test Character' };
                const addRequest = createMockRequest('test1');
                mockObjectStore.add.mockReturnValue(addRequest);

                const key = await storageManager.save('characters', testData, { overwrite: false });

                expect(key).toBe('test1');
                expect(mockObjectStore.add).toHaveBeenCalledWith(testData);
            });

            test('should load data from object store', async () => {
                const testData = { id: 'test1', name: 'Test Character' };
                const getRequest = createMockRequest(testData);
                mockObjectStore.get.mockReturnValue(getRequest);

                const data = await storageManager.load('characters', 'test1');

                expect(data).toEqual(testData);
                expect(mockObjectStore.get).toHaveBeenCalledWith('test1');
            });

            test('should return null for non-existent data', async () => {
                const getRequest = createMockRequest(null);
                mockObjectStore.get.mockReturnValue(getRequest);

                const data = await storageManager.load('characters', 'nonexistent');

                expect(data).toBeNull();
            });

            test('should update existing data', async () => {
                const existingData = { id: 'test1', name: 'Old Name' };
                const updatedData = { id: 'test1', name: 'New Name' };
                
                const getRequest = createMockRequest(existingData);
                const putRequest = createMockRequest('test1');
                
                mockObjectStore.get.mockReturnValue(getRequest);
                mockObjectStore.put.mockReturnValue(putRequest);

                const result = await storageManager.update('characters', 'test1', { name: 'New Name' });

                expect(result).toBe(true);
                expect(mockObjectStore.put).toHaveBeenCalledWith(updatedData);
            });

            test('should handle update of non-existent data', async () => {
                const getRequest = createMockRequest(null);
                mockObjectStore.get.mockReturnValue(getRequest);

                await expect(storageManager.update('characters', 'nonexistent', { name: 'New Name' }))
                    .rejects.toThrow('Data with key \'nonexistent\' not found in store \'characters\'');
            });

            test('should delete data from object store', async () => {
                const deleteRequest = createMockRequest(true);
                mockObjectStore.delete.mockReturnValue(deleteRequest);

                const result = await storageManager.delete('characters', 'test1');

                expect(result).toBe(true);
                expect(mockObjectStore.delete).toHaveBeenCalledWith('test1');
            });

            test('should handle delete operation errors', async () => {
                const deleteRequest = createMockRequest(null, { message: 'Delete failed' });
                mockObjectStore.delete.mockReturnValue(deleteRequest);

                await expect(storageManager.delete('characters', 'test1'))
                    .rejects.toThrow('Delete operation failed: Delete failed');
            });

            test('should emit CRUD operation events', async () => {
                const testData = { id: 'test1', name: 'Test Character' };
                const putRequest = createMockRequest('test1');
                mockObjectStore.put.mockReturnValue(putRequest);

                await storageManager.save('characters', testData);

                const events = mockEventBus.getEvents();
                const saveEvent = events.find(e => e.eventName === 'storage:saved');
                expect(saveEvent).toBeDefined();
                expect(saveEvent.data.storeName).toBe('characters');
                expect(saveEvent.data.key).toBe('test1');
                expect(saveEvent.data.data).toEqual(testData);
            });
        });

        describe('Transaction support', () => {
            beforeEach(async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();
            });

            test('should perform read-only transactions', async () => {
                const testData = { id: 'test1', name: 'Test Character' };
                const getRequest = createMockRequest(testData);
                mockObjectStore.get.mockReturnValue(getRequest);

                const result = await storageManager.performTransaction('characters', 'readonly', (store) => {
                    return new Promise((resolve) => {
                        const request = store.get('test1');
                        request.onsuccess = () => resolve(request.result);
                    });
                });

                expect(result).toEqual(testData);
                expect(mockDatabase.transaction).toHaveBeenCalledWith(['characters'], 'readonly');
            });

            test('should perform read-write transactions', async () => {
                const putRequest = createMockRequest('test1');
                mockObjectStore.put.mockReturnValue(putRequest);

                const result = await storageManager.performTransaction('characters', 'readwrite', (store) => {
                    return new Promise((resolve) => {
                        const request = store.put({ id: 'test1', name: 'Test' });
                        request.onsuccess = () => resolve(request.result);
                    });
                });

                expect(result).toBe('test1');
                expect(mockDatabase.transaction).toHaveBeenCalledWith(['characters'], 'readwrite');
            });

            test('should handle transaction errors', async () => {
                await expect(storageManager.performTransaction('characters', 'readwrite', (store) => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => reject(new Error('Transaction error')), 0);
                    });
                })).rejects.toThrow('Transaction error');
            });

            test('should handle transaction abort', async () => {
                await expect(storageManager.performTransaction('characters', 'readwrite', (store) => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            mockTransaction.onabort();
                        }, 0);
                    });
                })).rejects.toThrow('Transaction aborted');
            });
        });

        describe('Error handling and recovery', () => {
            test('should handle database initialization errors', async () => {
                const request = createMockRequest(null, { message: 'Init failed' });
                mockIndexedDB.open.mockReturnValue(request);
                request.onerror = () => {};

                await expect(storageManager.init()).rejects.toThrow('Database open failed: Init failed');

                const events = mockEventBus.getEvents();
                const errorEvent = events.find(e => e.eventName === 'storage:init-error');
                expect(errorEvent).toBeDefined();
                expect(errorEvent.data.error).toBe('Init failed');
            });

            test('should handle save operation errors', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();

                const putRequest = createMockRequest(null, { message: 'Save failed' });
                mockObjectStore.put.mockReturnValue(putRequest);

                await expect(storageManager.save('characters', { id: 'test1' }))
                    .rejects.toThrow('Save operation failed: Save failed');

                const events = mockEventBus.getEvents();
                const errorEvent = events.find(e => e.eventName === 'storage:save-error');
                expect(errorEvent).toBeDefined();
                expect(errorEvent.data.error).toBe('Save failed');
            });

            test('should handle load operation errors', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();

                const getRequest = createMockRequest(null, { message: 'Load failed' });
                mockObjectStore.get.mockReturnValue(getRequest);

                await expect(storageManager.load('characters', 'test1'))
                    .rejects.toThrow('Load operation failed: Load failed');

                const events = mockEventBus.getEvents();
                const errorEvent = events.find(e => e.eventName === 'storage:load-error');
                expect(errorEvent).toBeDefined();
                expect(errorEvent.data.error).toBe('Load failed');
            });

            test('should handle update operation errors', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();

                const getRequest = createMockRequest({ id: 'test1' });
                const putRequest = createMockRequest(null, { message: 'Update failed' });
                mockObjectStore.get.mockReturnValue(getRequest);
                mockObjectStore.put.mockReturnValue(putRequest);

                await expect(storageManager.update('characters', 'test1', { name: 'New Name' }))
                    .rejects.toThrow('Save operation failed: Update failed');

                const events = mockEventBus.getEvents();
                const errorEvent = events.find(e => e.eventName === 'storage:save-error');
                expect(errorEvent).toBeDefined();
            });

            test('should handle delete operation errors', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();

                const deleteRequest = createMockRequest(null, { message: 'Delete failed' });
                mockObjectStore.delete.mockReturnValue(deleteRequest);

                await expect(storageManager.delete('characters', 'test1'))
                    .rejects.toThrow('Delete operation failed: Delete failed');

                const events = mockEventBus.getEvents();
                const errorEvent = events.find(e => e.eventName === 'storage:delete-error');
                expect(errorEvent).toBeDefined();
                expect(errorEvent.data.error).toBe('Delete failed');
            });

            test('should handle operations on uninitialized database', async () => {
                await expect(storageManager.save('characters', { id: 'test1' }))
                    .rejects.toThrow('StorageManager: Database not initialized');

                await expect(storageManager.load('characters', 'test1'))
                    .rejects.toThrow('StorageManager: Database not initialized');

                await expect(storageManager.delete('characters', 'test1'))
                    .rejects.toThrow('StorageManager: Database not initialized');
            });

            test('should handle operations on non-existent object stores', async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();

                await expect(storageManager.save('nonexistent', { id: 'test1' }))
                    .rejects.toThrow('StorageManager: Object store \'nonexistent\' not found');

                await expect(storageManager.load('nonexistent', 'test1'))
                    .rejects.toThrow('StorageManager: Object store \'nonexistent\' not found');
            });
        });

        describe('Additional CRUD operations', () => {
            beforeEach(async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();
            });

            test('should query data with index', async () => {
                const testData = [
                    { id: 'test1', name: 'Character 1' },
                    { id: 'test2', name: 'Character 2' }
                ];

                const cursor1 = createMockCursor(testData[0], 'test1');
                const cursor2 = createMockCursor(testData[1], 'test2');
                const cursor3 = createMockCursor(null, null); // End of cursor

                mockIndex.openCursor.mockReturnValue(createMockRequest(cursor1));
                cursor1.continue.mockImplementation(() => {
                    mockIndex.openCursor.mockReturnValue(createMockRequest(cursor2));
                });
                cursor2.continue.mockImplementation(() => {
                    mockIndex.openCursor.mockReturnValue(createMockRequest(cursor3));
                });

                const results = await storageManager.query('characters', { index: 'name' });

                expect(results).toEqual(testData);
            });

            test('should count records in object store', async () => {
                const countRequest = createMockRequest(5);
                mockObjectStore.count.mockReturnValue(countRequest);

                const count = await storageManager.count('characters');

                expect(count).toBe(5);
                expect(mockObjectStore.count).toHaveBeenCalled();
            });

            test('should clear all data from object store', async () => {
                const clearRequest = createMockRequest(true);
                mockObjectStore.clear.mockReturnValue(clearRequest);

                const result = await storageManager.clear('characters');

                expect(result).toBe(true);
                expect(mockObjectStore.clear).toHaveBeenCalled();
            });

            test('should get all data from object store', async () => {
                const testData = [
                    { id: 'test1', name: 'Character 1' },
                    { id: 'test2', name: 'Character 2' }
                ];

                const cursor1 = createMockCursor(testData[0], 'test1');
                const cursor2 = createMockCursor(testData[1], 'test2');
                const cursor3 = createMockCursor(null, null);

                mockObjectStore.openCursor.mockReturnValue(createMockRequest(cursor1));
                cursor1.continue.mockImplementation(() => {
                    mockObjectStore.openCursor.mockReturnValue(createMockRequest(cursor2));
                });
                cursor2.continue.mockImplementation(() => {
                    mockObjectStore.openCursor.mockReturnValue(createMockRequest(cursor3));
                });

                const results = await storageManager.getAll('characters');

                expect(results).toEqual(testData);
            });
        });

        describe('Database management', () => {
            beforeEach(async () => {
                const request = createMockRequest(mockDatabase);
                mockIndexedDB.open.mockReturnValue(request);
                request.onsuccess = () => {};
                await storageManager.init();
            });

            test('should close database connection', async () => {
                const result = await storageManager.close();

                expect(result).toBe(true);
                expect(mockDatabase.close).toHaveBeenCalled();
                expect(storageManager.initialized).toBe(false);
                expect(storageManager.db).toBeNull();
            });

            test('should delete database', async () => {
                const deleteRequest = createMockRequest(true);
                mockIndexedDB.deleteDatabase.mockReturnValue(deleteRequest);

                const result = await storageManager.deleteDatabase();

                expect(result).toBe(true);
                expect(mockIndexedDB.deleteDatabase).toHaveBeenCalledWith('SillyTavernRuntime');
            });

            test('should get database statistics', async () => {
                const countRequest = createMockRequest(3);
                mockObjectStore.count.mockReturnValue(countRequest);

                const stats = await storageManager.getStats();

                expect(stats.initialized).toBe(true);
                expect(stats.dbName).toBe('SillyTavernRuntime');
                expect(stats.version).toBe(1);
                expect(stats.objectStores).toContain('characters');
            });

            test('should set debug mode', () => {
                storageManager.setDebugMode(true);
                expect(storageManager.debugMode).toBe(true);
            });

            test('should set retry configuration', () => {
                storageManager.setRetryConfig(5, 2000);
                expect(storageManager.maxRetries).toBe(5);
                expect(storageManager.retryDelay).toBe(2000);
            });
        });
    });
}); 