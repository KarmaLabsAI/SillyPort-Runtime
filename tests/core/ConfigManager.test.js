/**
 * ConfigManager Tests
 * 
 * Tests for Task 1.3.1: Configuration Management
 * - Hierarchical configuration structure
 * - Default configuration values
 * - Configuration validation
 * - Runtime configuration updates
 * - Configuration persistence
 */

// Import ConfigManager
const { ConfigManager } = require('../../src/core/ConfigManager');

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

// Mock fetch for testing file loading
global.fetch = jest.fn();

describe('ConfigManager', () => {
    let configManager;
    let mockEventBus;

    beforeEach(() => {
        mockEventBus = new MockEventBus();
        configManager = new ConfigManager(mockEventBus);
        
        // Clear localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
        
        // Reset fetch mock
        fetch.mockClear();
    });

    describe('Task 1.3.1: Configuration Management', () => {
        describe('Hierarchical configuration structure', () => {
            test('should support dot notation path access', () => {
                configManager.set('server.port', 8000);
                configManager.set('server.host', 'localhost');
                configManager.set('database.url', 'mongodb://localhost:27017');

                expect(configManager.get('server.port')).toBe(8000);
                expect(configManager.get('server.host')).toBe('localhost');
                expect(configManager.get('database.url')).toBe('mongodb://localhost:27017');
            });

            test('should handle nested object creation', () => {
                configManager.set('deeply.nested.config.value', 'test');
                
                const config = configManager.getConfig();
                expect(config.deeply.nested.config.value).toBe('test');
            });

            test('should return undefined for non-existent paths', () => {
                expect(configManager.get('nonexistent.path')).toBeUndefined();
                expect(configManager.get('server.nonexistent')).toBeUndefined();
            });

            test('should handle default values', () => {
                expect(configManager.get('server.port', 3000)).toBe(3000);
                expect(configManager.get('nonexistent', 'default')).toBe('default');
            });
        });

        describe('Default configuration values', () => {
            test('should set and apply default values', () => {
                const defaults = {
                    server: {
                        port: 8000,
                        host: 'localhost'
                    },
                    database: {
                        url: 'mongodb://localhost:27017'
                    }
                };

                configManager.setDefaults(defaults);

                expect(configManager.get('server.port')).toBe(8000);
                expect(configManager.get('server.host')).toBe('localhost');
                expect(configManager.get('database.url')).toBe('mongodb://localhost:27017');
            });

            test('should merge default values with existing config', () => {
                // Set some existing config
                configManager.set('server.port', 9000);
                configManager.set('custom.setting', 'value');

                // Set defaults
                const defaults = {
                    server: {
                        port: 8000,
                        host: 'localhost'
                    },
                    database: {
                        url: 'mongodb://localhost:27017'
                    }
                };

                configManager.setDefaults(defaults, true);

                // Existing values should be preserved
                expect(configManager.get('server.port')).toBe(9000);
                expect(configManager.get('custom.setting')).toBe('value');
                
                // Default values should be applied
                expect(configManager.get('server.host')).toBe('localhost');
                expect(configManager.get('database.url')).toBe('mongodb://localhost:27017');
            });

            test('should replace defaults when merge is false', () => {
                // Set initial defaults
                configManager.setDefaults({ server: { port: 8000 } });

                // Set new defaults without merge
                configManager.setDefaults({ database: { url: 'test' } }, false);

                // Old defaults should be gone
                expect(configManager.get('server.port')).toBeUndefined();
                
                // New defaults should be applied
                expect(configManager.get('database.url')).toBe('test');
            });
        });

        describe('Configuration validation', () => {
            test('should validate values using custom rules', () => {
                // Add validation rule for port
                configManager.addValidationRule('server.port', 
                    (value) => typeof value === 'number' && value > 0 && value < 65536,
                    'Port must be a number between 1 and 65535'
                );

                // Valid value should work
                expect(() => configManager.set('server.port', 8000)).not.toThrow();

                // Invalid values should throw
                expect(() => configManager.set('server.port', -1)).toThrow('Port must be a number between 1 and 65535');
                expect(() => configManager.set('server.port', 'invalid')).toThrow('Port must be a number between 1 and 65535');
                expect(() => configManager.set('server.port', 70000)).toThrow('Port must be a number between 1 and 65535');
            });

            test('should support wildcard validation rules', () => {
                // Add wildcard rule for all string values
                configManager.addValidationRule('*.name', 
                    (value) => typeof value === 'string' && value.length > 0,
                    'Name must be a non-empty string'
                );

                // Valid values should work
                expect(() => configManager.set('server.name', 'test-server')).not.toThrow();
                expect(() => configManager.set('database.name', 'test-db')).not.toThrow();

                // Invalid values should throw
                expect(() => configManager.set('server.name', '')).toThrow('Name must be a non-empty string');
                expect(() => configManager.set('database.name', 123)).toThrow('Name must be a non-empty string');
            });

            test('should allow bypassing validation', () => {
                configManager.addValidationRule('server.port', 
                    (value) => typeof value === 'number',
                    'Port must be a number'
                );

                // Should be able to bypass validation
                expect(() => configManager.set('server.port', 'invalid', { validate: false })).not.toThrow();
            });

            test('should remove validation rules', () => {
                configManager.addValidationRule('server.port', 
                    (value) => typeof value === 'number',
                    'Port must be a number'
                );

                // Remove the rule
                expect(configManager.removeValidationRule('server.port')).toBe(true);

                // Should no longer validate
                expect(() => configManager.set('server.port', 'invalid')).not.toThrow();
            });
        });

        describe('Runtime configuration updates', () => {
            test('should emit events on configuration changes', () => {
                configManager.set('server.port', 8000);

                const events = mockEventBus.getEvents();
                expect(events).toHaveLength(1);
                expect(events[0].eventName).toBe('config:changed');
                expect(events[0].data.path).toBe('server.port');
                expect(events[0].data.newValue).toBe(8000);
                expect(events[0].data.oldValue).toBeUndefined();
            });

            test('should support watchers for specific paths', () => {
                const watcher = jest.fn();
                configManager.watch('server.port', watcher);

                configManager.set('server.port', 8000);
                configManager.set('server.host', 'localhost');

                expect(watcher).toHaveBeenCalledTimes(1);
                expect(watcher).toHaveBeenCalledWith(8000, undefined, 'server.port');
            });

            test('should support multiple watchers for the same path', () => {
                const watcher1 = jest.fn();
                const watcher2 = jest.fn();

                configManager.watch('server.port', watcher1);
                configManager.watch('server.port', watcher2);

                configManager.set('server.port', 8000);

                expect(watcher1).toHaveBeenCalledWith(8000, undefined, 'server.port');
                expect(watcher2).toHaveBeenCalledWith(8000, undefined, 'server.port');
            });

            test('should allow unwatching specific callbacks', () => {
                const watcher1 = jest.fn();
                const watcher2 = jest.fn();

                configManager.watch('server.port', watcher1);
                configManager.watch('server.port', watcher2);

                // Unwatch watcher1
                configManager.unwatch('server.port', watcher1);

                configManager.set('server.port', 8000);

                expect(watcher1).not.toHaveBeenCalled();
                expect(watcher2).toHaveBeenCalledWith(8000, undefined, 'server.port');
            });

            test('should allow unwatching all callbacks for a path', () => {
                const watcher1 = jest.fn();
                const watcher2 = jest.fn();

                configManager.watch('server.port', watcher1);
                configManager.watch('server.port', watcher2);

                // Unwatch all
                const removed = configManager.unwatch('server.port');
                expect(removed).toBe(2);

                configManager.set('server.port', 8000);

                expect(watcher1).not.toHaveBeenCalled();
                expect(watcher2).not.toHaveBeenCalled();
            });

            test('should handle watcher errors gracefully', () => {
                const errorWatcher = jest.fn().mockImplementation(() => {
                    throw new Error('Watcher error');
                });

                configManager.watch('server.port', errorWatcher);

                // Should not throw
                expect(() => configManager.set('server.port', 8000)).not.toThrow();
            });
        });

        describe('Configuration persistence', () => {
            test('should persist configuration to localStorage', () => {
                configManager.set('server.port', 8000);
                configManager.set('server.host', 'localhost');

                // Check if localStorage was updated
                const stored = localStorage.getItem('sillytavern-config');
                expect(stored).toBeTruthy();

                const parsed = JSON.parse(stored);
                expect(parsed.server.port).toBe(8000);
                expect(parsed.server.host).toBe('localhost');
            });

            test('should load configuration from localStorage', async () => {
                // Set some configuration
                configManager.set('server.port', 8000);
                configManager.set('server.host', 'localhost');

                // Create new instance
                const newConfigManager = new ConfigManager();

                // Load from storage
                const loaded = await newConfigManager.load();

                expect(loaded).toBe(true);
                expect(newConfigManager.get('server.port')).toBe(8000);
                expect(newConfigManager.get('server.host')).toBe('localhost');
            });

            test('should handle missing localStorage gracefully', async () => {
                // Mock localStorage as undefined
                const originalLocalStorage = global.localStorage;
                delete global.localStorage;

                const newConfigManager = new ConfigManager();
                const loaded = await newConfigManager.load();

                expect(loaded).toBe(false);

                // Restore localStorage
                global.localStorage = originalLocalStorage;
            });

            test('should allow disabling persistence', () => {
                configManager.persistent = false;
                configManager.set('server.port', 8000);

                // localStorage should not be updated
                const stored = localStorage.getItem('sillytavern-config');
                expect(stored).toBeNull();
            });

            test('should allow bypassing persistence for individual sets', () => {
                configManager.set('server.port', 8000, { persist: false });

                // localStorage should not be updated
                const stored = localStorage.getItem('sillytavern-config');
                expect(stored).toBeNull();
            });

            test('should clear persistent storage', () => {
                configManager.set('server.port', 8000);
                
                // Verify it was stored
                expect(localStorage.getItem('sillytavern-config')).toBeTruthy();

                // Clear it
                const cleared = configManager.clear();
                expect(cleared).toBe(true);
                expect(localStorage.getItem('sillytavern-config')).toBeNull();
            });
        });

        describe('File loading capabilities', () => {
            test('should load JSON configuration files', async () => {
                const jsonConfig = {
                    server: {
                        port: 8000,
                        host: 'localhost'
                    }
                };

                fetch.mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify(jsonConfig))
                });

                const result = await configManager.loadFromFile('config.json');

                expect(result).toEqual(jsonConfig);
                expect(configManager.get('server.port')).toBe(8000);
                expect(configManager.get('server.host')).toBe('localhost');
            });

            test('should load YAML configuration files', async () => {
                const yamlContent = `
server:
  port: 8000
  host: localhost
database:
  url: mongodb://localhost:27017
`;

                fetch.mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(yamlContent)
                });

                const result = await configManager.loadFromFile('config.yaml');

                expect(result.server.port).toBe(8000);
                expect(result.server.host).toBe('localhost');
                expect(result.database.url).toBe('mongodb://localhost:27017');
            });

            test('should handle file loading errors', async () => {
                fetch.mockRejectedValueOnce(new Error('Network error'));

                await expect(configManager.loadFromFile('config.json')).rejects.toThrow('Network error');
            });

            test('should handle unsupported file formats', async () => {
                await expect(configManager.loadFromFile('config.txt')).rejects.toThrow('Unsupported configuration file format');
            });

            test('should merge configurations when merge option is true', async () => {
                // Set existing config
                configManager.set('server.port', 9000);
                configManager.set('custom.setting', 'value');

                const jsonConfig = {
                    server: {
                        port: 8000,
                        host: 'localhost'
                    }
                };

                fetch.mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify(jsonConfig))
                });

                await configManager.loadFromFile('config.json', { merge: true });

                // Existing values should be preserved
                expect(configManager.get('custom.setting')).toBe('value');
                
                // New values should be applied
                expect(configManager.get('server.host')).toBe('localhost');
                
                // Merged values should be correct
                expect(configManager.get('server.port')).toBe(8000); // New value overrides old
            });
        });

        describe('Utility methods', () => {
            test('should provide configuration statistics', () => {
                configManager.set('server.port', 8000);
                configManager.addValidationRule('server.port', () => true);
                configManager.watch('server.port', () => {});

                const stats = configManager.getStats();

                expect(stats.configSize).toBeGreaterThan(0);
                expect(stats.validationRulesCount).toBe(1);
                expect(stats.watchersCount).toBe(1);
                expect(stats.debugMode).toBe(false);
                expect(stats.persistent).toBe(true);
            });

            test('should support debug mode', () => {
                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

                configManager.setDebugMode(true);
                configManager.set('server.port', 8000);

                expect(consoleSpy).toHaveBeenCalledWith('ConfigManager: Set \'server.port\' =', 8000);

                consoleSpy.mockRestore();
            });

            test('should reset configuration to defaults', () => {
                configManager.setDefaults({ server: { port: 8000 } });
                configManager.set('server.port', 9000);
                configManager.set('custom.setting', 'value');

                configManager.reset();

                expect(configManager.get('server.port')).toBe(8000);
                expect(configManager.get('custom.setting')).toBeUndefined();
            });

            test('should get deep copy of configuration', () => {
                configManager.set('server.port', 8000);

                const deepCopy = configManager.getConfig(true);
                deepCopy.server.port = 9000;

                // Original should be unchanged
                expect(configManager.get('server.port')).toBe(8000);
            });
        });

        describe('Error handling', () => {
            test('should handle invalid paths', () => {
                expect(() => configManager.get('')).toThrow('Path must be a non-empty string');
                expect(() => configManager.get(null)).toThrow('Path must be a non-empty string');
                expect(() => configManager.set('', 'value')).toThrow('Path must be a non-empty string');
            });

            test('should handle invalid defaults', () => {
                expect(() => configManager.setDefaults(null)).toThrow('Defaults must be an object');
                expect(() => configManager.setDefaults('invalid')).toThrow('Defaults must be an object');
            });

            test('should handle invalid validation rules', () => {
                expect(() => configManager.addValidationRule('', () => true)).toThrow('Path must be a non-empty string');
                expect(() => configManager.addValidationRule('path', null)).toThrow('Validator must be a function');
                expect(() => configManager.addValidationRule('path', 'invalid')).toThrow('Validator must be a function');
            });

            test('should handle invalid watchers', () => {
                expect(() => configManager.watch('', () => {})).toThrow('Path must be a non-empty string');
                expect(() => configManager.watch('path', null)).toThrow('Callback must be a function');
                expect(() => configManager.watch('path', 'invalid')).toThrow('Callback must be a function');
            });
        });
    });
}); 