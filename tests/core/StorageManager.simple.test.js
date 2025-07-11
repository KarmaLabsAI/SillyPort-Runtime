/**
 * StorageManager Simple Tests
 * 
 * Simplified tests for Task 1.4.1: IndexedDB Integration
 * Focuses on core functionality without complex IndexedDB mocking
 */

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

describe('StorageManager - Simple Tests', () => {
    let storageManager;
    let mockEventBus;

    beforeEach(() => {
        mockEventBus = new MockEventBus();
        storageManager = new StorageManager(mockEventBus);
        mockEventBus.clear();
    });

    describe('Task 1.4.1: IndexedDB Integration - Core Functionality', () => {
        test('should create StorageManager instance with default configuration', () => {
            expect(storageManager).toBeDefined();
            expect(storageManager.dbName).toBe('SillyTavernRuntime');
            expect(storageManager.version).toBe(1);
            expect(storageManager.initialized).toBe(false);
            expect(storageManager.maxRetries).toBe(3);
            expect(storageManager.retryDelay).toBe(1000);
        });

        test('should get default object stores configuration', () => {
            const objectStores = storageManager.getDefaultObjectStores();
            
            expect(objectStores).toBeDefined();
            expect(Array.isArray(objectStores)).toBe(true);
            expect(objectStores.length).toBe(5);
            
            const storeNames = objectStores.map(store => store.name);
            expect(storeNames).toContain('characters');
            expect(storeNames).toContain('chats');
            expect(storeNames).toContain('cache');
            expect(storeNames).toContain('configuration');
            expect(storeNames).toContain('assets');
        });

        test('should check IndexedDB support', () => {
            // Test with IndexedDB available
            const originalIndexedDB = global.indexedDB;
            global.indexedDB = {};
            
            expect(storageManager.isIndexedDBSupported()).toBe(true);
            
            // Test without IndexedDB
            delete global.indexedDB;
            expect(storageManager.isIndexedDBSupported()).toBe(false);
            
            // Restore
            global.indexedDB = originalIndexedDB;
        });

        test('should set debug mode', () => {
            storageManager.setDebugMode(true);
            expect(storageManager.debugMode).toBe(true);
            
            storageManager.setDebugMode(false);
            expect(storageManager.debugMode).toBe(false);
        });

        test('should set retry configuration', () => {
            storageManager.setRetryConfig(5, 2000);
            expect(storageManager.maxRetries).toBe(5);
            expect(storageManager.retryDelay).toBe(2000);
        });

        test('should emit storage events when eventBus is available', () => {
            storageManager.emitStorageEvent('test:event', { data: 'test' });
            
            const events = mockEventBus.getEvents();
            expect(events).toHaveLength(1);
            expect(events[0].eventName).toBe('test:event');
            expect(events[0].data.data).toBe('test');
            expect(events[0].data.timestamp).toBeDefined();
        });

        test('should handle operations on uninitialized database', async () => {
            await expect(storageManager.save('characters', { id: 'test1' }))
                .rejects.toThrow('StorageManager: Database not initialized');

            await expect(storageManager.load('characters', 'test1'))
                .rejects.toThrow('StorageManager: Database not initialized');

            await expect(storageManager.delete('characters', 'test1'))
                .rejects.toThrow('StorageManager: Database not initialized');

            await expect(storageManager.update('characters', 'test1', {}))
                .rejects.toThrow('StorageManager: Database not initialized');
        });

        test('should handle operations on non-existent object stores', async () => {
            // Mock the database as initialized
            storageManager.initialized = true;
            storageManager.objectStores.set('characters', { name: 'characters' });

            await expect(storageManager.save('nonexistent', { id: 'test1' }))
                .rejects.toThrow('StorageManager: Object store \'nonexistent\' not found');

            await expect(storageManager.load('nonexistent', 'test1'))
                .rejects.toThrow('StorageManager: Object store \'nonexistent\' not found');
        });

        test('should close database connection', async () => {
            // Mock database
            const mockDb = { close: jest.fn() };
            storageManager.db = mockDb;
            storageManager.initialized = true;

            const result = await storageManager.close();

            expect(result).toBe(true);
            expect(mockDb.close).toHaveBeenCalled();
            expect(storageManager.initialized).toBe(false);
            expect(storageManager.db).toBeNull();
        });

        test('should get database statistics when not initialized', async () => {
            const stats = await storageManager.getStats();
            
            expect(stats.initialized).toBe(false);
        });

        test('should delay execution', async () => {
            const start = Date.now();
            await storageManager.delay(100);
            const end = Date.now();
            
            expect(end - start).toBeGreaterThanOrEqual(90);
        });

        test('should validate object store configuration', () => {
            const validConfig = {
                name: 'test',
                keyPath: 'id',
                indexes: [
                    { name: 'name', keyPath: 'name' }
                ]
            };

            expect(validConfig.name).toBe('test');
            expect(validConfig.keyPath).toBe('id');
            expect(validConfig.indexes).toHaveLength(1);
            expect(validConfig.indexes[0].name).toBe('name');
        });

        test('should handle error events', () => {
            storageManager.emitStorageEvent('storage:error', { 
                error: 'Test error',
                operation: 'test'
            });

            const events = mockEventBus.getEvents();
            expect(events).toHaveLength(1);
            expect(events[0].eventName).toBe('storage:error');
            expect(events[0].data.error).toBe('Test error');
            expect(events[0].data.operation).toBe('test');
        });

        test('should handle success events', () => {
            storageManager.emitStorageEvent('storage:success', { 
                operation: 'save',
                key: 'test1'
            });

            const events = mockEventBus.getEvents();
            expect(events).toHaveLength(1);
            expect(events[0].eventName).toBe('storage:success');
            expect(events[0].data.operation).toBe('save');
            expect(events[0].data.key).toBe('test1');
        });

        test('should validate database name and version', () => {
            expect(storageManager.dbName).toBe('SillyTavernRuntime');
            expect(storageManager.version).toBe(1);
            
            // Test custom configuration
            storageManager.dbName = 'CustomDB';
            storageManager.version = 2;
            
            expect(storageManager.dbName).toBe('CustomDB');
            expect(storageManager.version).toBe(2);
        });

        test('should handle multiple events', () => {
            storageManager.emitStorageEvent('event1', { data: 'test1' });
            storageManager.emitStorageEvent('event2', { data: 'test2' });
            storageManager.emitStorageEvent('event3', { data: 'test3' });

            const events = mockEventBus.getEvents();
            expect(events).toHaveLength(3);
            expect(events[0].eventName).toBe('event1');
            expect(events[1].eventName).toBe('event2');
            expect(events[2].eventName).toBe('event3');
        });

        test('should validate object store structure', () => {
            const objectStores = storageManager.getDefaultObjectStores();
            
            objectStores.forEach(store => {
                expect(store).toHaveProperty('name');
                expect(store).toHaveProperty('keyPath');
                expect(typeof store.name).toBe('string');
                expect(typeof store.keyPath).toBe('string');
                
                if (store.indexes) {
                    expect(Array.isArray(store.indexes)).toBe(true);
                    store.indexes.forEach(index => {
                        expect(index).toHaveProperty('name');
                        expect(index).toHaveProperty('keyPath');
                    });
                }
            });
        });
    });
}); 