/**
 * SillyTavernRuntime Tests
 * 
 * Tests for Task 1.5.1: Runtime Bootstrap
 * 
 * Acceptance Criteria:
 * - [x] Runtime class with initialization method
 * - [x] Component dependency management
 * - [x] Initialization error handling
 * - [x] Lifecycle event emission
 * - [x] Configuration loading
 */

const SillyTavernRuntime = require('../../src/core/SillyTavernRuntime');
const EventBus = require('../../src/core/EventBus');
const StateManager = require('../../src/core/StateManager');
const ConfigManager = require('../../src/core/ConfigManager');
const StorageManager = require('../../src/core/StorageManager');

describe('SillyTavernRuntime', () => {
    let runtime;

    beforeEach(() => {
        runtime = new SillyTavernRuntime();
    });

    afterEach(async () => {
        if (runtime && runtime.initialized) {
            await runtime.destroy();
        }
    });

    describe('Task 1.5.1: Runtime Bootstrap', () => {
        describe('Runtime class with initialization method', () => {
            test('should create runtime instance', () => {
                expect(runtime).toBeInstanceOf(SillyTavernRuntime);
                expect(runtime.version).toBe('1.0.0');
                expect(runtime.initialized).toBe(false);
                expect(runtime.initializing).toBe(false);
            });

            test('should have initialization method', () => {
                expect(typeof runtime.init).toBe('function');
                expect(runtime.init.constructor.name).toBe('AsyncFunction');
            });

            test('should initialize successfully with default options', async () => {
                const result = await runtime.init();
                expect(result).toBe(true);
                expect(runtime.initialized).toBe(true);
                expect(runtime.initializing).toBe(false);
            });

            test('should initialize with custom configuration', async () => {
                const config = {
                    debugMode: true,
                    storage: {
                        dbName: 'TestRuntime',
                        compressionEnabled: false
                    }
                };

                const result = await runtime.init({ config });
                expect(result).toBe(true);
                expect(runtime.initialized).toBe(true);
                expect(runtime.debugMode).toBe(true);
            });

            test('should prevent double initialization', async () => {
                await runtime.init();
                
                await expect(runtime.init()).rejects.toThrow(
                    'SillyTavernRuntime: Already initialized'
                );
            });

            test('should prevent concurrent initialization', async () => {
                const initPromise = runtime.init();
                runtime.initializing = true;
                
                await expect(runtime.init()).rejects.toThrow(
                    'SillyTavernRuntime: Initialization already in progress'
                );
                
                runtime.initializing = false;
                await initPromise;
            });
        });

        describe('Component dependency management', () => {
            test('should initialize components in correct order', async () => {
                const initOrder = [];
                
                // Mock component initialization to track order
                const originalInitEventBus = runtime.initializeEventBus.bind(runtime);
                const originalInitStateManager = runtime.initializeStateManager.bind(runtime);
                const originalInitConfigManager = runtime.initializeConfigManager.bind(runtime);
                const originalInitStorageManager = runtime.initializeStorageManager.bind(runtime);

                runtime.initializeEventBus = async (options) => {
                    initOrder.push('eventBus');
                    await originalInitEventBus(options);
                };

                runtime.initializeStateManager = async (options) => {
                    initOrder.push('stateManager');
                    await originalInitStateManager(options);
                };

                runtime.initializeConfigManager = async (options) => {
                    initOrder.push('configManager');
                    await originalInitConfigManager(options);
                };

                runtime.initializeStorageManager = async (options) => {
                    initOrder.push('storageManager');
                    await originalInitStorageManager(options);
                };

                await runtime.init();

                expect(initOrder).toEqual([
                    'eventBus',
                    'stateManager',
                    'configManager',
                    'storageManager'
                ]);
            });

            test('should have all core components after initialization', async () => {
                await runtime.init();

                expect(runtime.eventBus).toBeInstanceOf(EventBus);
                expect(runtime.stateManager).toBeInstanceOf(StateManager);
                expect(runtime.configManager).toBeInstanceOf(ConfigManager);
                expect(runtime.storageManager).toBeInstanceOf(StorageManager);
            });

            test('should track component initialization status', async () => {
                await runtime.init();

                const status = runtime.getInitStatus();
                expect(status.eventBus).toBe(true);
                expect(status.stateManager).toBe(true);
                expect(status.configManager).toBe(true);
                expect(status.storageManager).toBe(true);
            });

            test('should provide component access methods', async () => {
                await runtime.init();

                expect(runtime.getComponent('eventBus')).toBeInstanceOf(EventBus);
                expect(runtime.getComponent('stateManager')).toBeInstanceOf(StateManager);
                expect(runtime.getComponent('configManager')).toBeInstanceOf(ConfigManager);
                expect(runtime.getComponent('storageManager')).toBeInstanceOf(StorageManager);
                expect(runtime.getComponent('nonexistent')).toBeNull();
            });

            test('should check component initialization status', async () => {
                expect(runtime.isComponentInitialized('eventBus')).toBe(false);
                expect(runtime.isComponentInitialized('stateManager')).toBe(false);
                expect(runtime.isComponentInitialized('configManager')).toBe(false);
                expect(runtime.isComponentInitialized('storageManager')).toBe(false);

                await runtime.init();

                expect(runtime.isComponentInitialized('eventBus')).toBe(true);
                expect(runtime.isComponentInitialized('stateManager')).toBe(true);
                expect(runtime.isComponentInitialized('configManager')).toBe(true);
                expect(runtime.isComponentInitialized('storageManager')).toBe(true);
            });
        });

        describe('Initialization error handling', () => {
            test('should handle component dependency failures', async () => {
                // Mock EventBus to fail by temporarily replacing the require
                jest.doMock('../../src/core/EventBus', () => {
                    return class MockEventBus {
                        constructor() {
                            throw new Error('EventBus initialization failed');
                        }
                    };
                });

                // Create a new runtime instance to use the mocked EventBus
                const mockRuntime = new (require('../../src/core/SillyTavernRuntime'))();

                await expect(mockRuntime.init()).rejects.toThrow(
                    'Failed to initialize eventBus: EventBus initialization failed'
                );

                // Restore original EventBus
                jest.dontMock('../../src/core/EventBus');
            });

            test('should track initialization errors', async () => {
                // Mock EventBus to fail
                jest.doMock('../../src/core/EventBus', () => {
                    return class MockEventBus {
                        constructor() {
                            throw new Error('EventBus initialization failed');
                        }
                    };
                });

                const mockRuntime = new (require('../../src/core/SillyTavernRuntime'))();

                try {
                    await mockRuntime.init();
                } catch (error) {
                    // Expected to fail
                }

                const errors = mockRuntime.getInitErrors();
                expect(errors).toHaveLength(1);
                expect(errors[0].component).toBe('eventBus');
                expect(errors[0].error).toBe('EventBus initialization failed');
                expect(errors[0].timestamp).toBeDefined();

                jest.dontMock('../../src/core/EventBus');
            });
        });

        describe('Lifecycle event emission', () => {
            test('should emit initialization start event', async () => {
                const events = [];
                runtime.subscribe('runtime:init-start', (data) => {
                    events.push(data);
                });

                await runtime.init();

                expect(events).toHaveLength(1);
                expect(events[0].version).toBe('1.0.0');
                expect(events[0].config).toBeDefined();
            });

            test('should emit component initialization events', async () => {
                const componentEvents = [];
                runtime.subscribe('runtime:component-init', (data) => {
                    componentEvents.push(data);
                });

                await runtime.init();

                expect(componentEvents).toHaveLength(8); // 4 components * 2 events each (start + ready)
                
                const startEvents = componentEvents.filter(e => e.status === 'start');
                const readyEvents = componentEvents.filter(e => e.status === 'ready');
                
                expect(startEvents).toHaveLength(4);
                expect(readyEvents).toHaveLength(4);
                
                expect(startEvents.map(e => e.component)).toEqual([
                    'eventBus', 'stateManager', 'configManager', 'storageManager'
                ]);
            });

            test('should emit initialization complete event', async () => {
                const events = [];
                runtime.subscribe('runtime:init-complete', (data) => {
                    events.push(data);
                });

                await runtime.init();

                expect(events).toHaveLength(1);
                expect(events[0].version).toBe('1.0.0');
                expect(events[0].components).toHaveLength(4);
                expect(events[0].errors).toHaveLength(0);
            });

            test('should emit destruction events', async () => {
                await runtime.init();

                const events = [];
                runtime.subscribe('runtime:destroy-start', (data) => {
                    events.push({ type: 'destroy-start', data });
                });
                runtime.subscribe('runtime:destroy-complete', (data) => {
                    events.push({ type: 'destroy-complete', data });
                });

                await runtime.destroy();

                expect(events).toHaveLength(2);
                expect(events[0].type).toBe('destroy-start');
                expect(events[1].type).toBe('destroy-complete');
            });

            test('should provide lifecycle event subscription', async () => {
                const events = [];
                runtime.subscribeToLifecycle('runtime:init-complete', (data) => {
                    events.push(data);
                });

                await runtime.init();

                expect(events).toHaveLength(1);
                expect(events[0].version).toBe('1.0.0');
            });

            test('should reject invalid lifecycle events', () => {
                expect(() => {
                    runtime.subscribeToLifecycle('invalid-event', () => {});
                }).toThrow('Invalid lifecycle event: invalid-event');
            });
        });

        describe('Configuration loading', () => {
            test('should load configuration object', async () => {
                const config = {
                    debugMode: true,
                    performance: {
                        memoryCacheCapacity: 1000
                    }
                };

                await runtime.init({ config });

                expect(runtime.getConfig('debugMode')).toBe(true);
                expect(runtime.getConfig('performance.memoryCacheCapacity')).toBe(1000);
            });

            test('should set initial state from configuration', async () => {
                const config = {
                    ui: {
                        theme: 'dark',
                        sidebarOpen: false
                    }
                };

                await runtime.init({ config });

                expect(runtime.getState('ui.theme')).toBe('dark');
                expect(runtime.getState('ui.sidebarOpen')).toBe(false);
            });

            test('should provide configuration access methods', async () => {
                await runtime.init();

                runtime.setConfig('test.value', 'test');
                expect(runtime.getConfig('test.value')).toBe('test');
            });

            test('should provide state access methods', async () => {
                await runtime.init();

                runtime.setState('test.value', 'test');
                expect(runtime.getState('test.value')).toBe('test');
            });
        });

        describe('Runtime statistics and debugging', () => {
            test('should provide runtime statistics', async () => {
                await runtime.init();

                const stats = runtime.getStats();
                expect(stats.version).toBe('1.0.0');
                expect(stats.initialized).toBe(true);
                expect(stats.initializing).toBe(false);
                expect(stats.components).toBeDefined();
                expect(stats.errors).toBeDefined();
                expect(stats.debugMode).toBeDefined();
            });

            test('should enable debug mode for all components', async () => {
                await runtime.init();

                runtime.setDebugMode(true);

                expect(runtime.debugMode).toBe(true);
                expect(runtime.eventBus.debugMode).toBe(true);
                expect(runtime.stateManager.debugMode).toBe(true);
                expect(runtime.configManager.debugMode).toBe(true);
                expect(runtime.storageManager.debugMode).toBe(true);
            });

            test('should disable debug mode for all components', async () => {
                await runtime.init();

                runtime.setDebugMode(false);

                expect(runtime.debugMode).toBe(false);
                expect(runtime.eventBus.debugMode).toBe(false);
                expect(runtime.stateManager.debugMode).toBe(false);
                expect(runtime.configManager.debugMode).toBe(false);
                expect(runtime.storageManager.debugMode).toBe(false);
            });
        });

        describe('Runtime destruction', () => {
            test('should destroy runtime and clean up resources', async () => {
                await runtime.init();

                expect(runtime.initialized).toBe(true);
                expect(runtime.eventBus).toBeDefined();
                expect(runtime.stateManager).toBeDefined();
                expect(runtime.configManager).toBeDefined();
                expect(runtime.storageManager).toBeDefined();

                await runtime.destroy();

                expect(runtime.initialized).toBe(false);
                expect(runtime.eventBus).toBeNull();
                expect(runtime.stateManager).toBeNull();
                expect(runtime.configManager).toBeNull();
                expect(runtime.storageManager).toBeNull();
            });

            test('should handle destruction when not initialized', async () => {
                // Should not throw when destroying uninitialized runtime
                await expect(runtime.destroy()).resolves.toBeUndefined();
            });

            test('should destroy components in reverse order', async () => {
                await runtime.init();

                const destroyOrder = [];
                const originalDestroyStorage = runtime.destroyComponent.bind(runtime);
                const originalDestroyConfig = runtime.destroyComponent.bind(runtime);
                const originalDestroyState = runtime.destroyComponent.bind(runtime);
                const originalDestroyEvent = runtime.destroyComponent.bind(runtime);

                runtime.destroyComponent = (componentName) => {
                    destroyOrder.push(componentName);
                    return originalDestroyStorage(componentName);
                };

                await runtime.destroy();

                expect(destroyOrder).toEqual([
                    'storageManager',
                    'configManager', 
                    'stateManager',
                    'eventBus'
                ]);
            });
        });
    });

    describe('Console Test Compatibility', () => {
        test('should work with console test example', async () => {
            // Test the console example from task breakdown
            const runtime = new SillyTavernRuntime();
            await runtime.init();
            
            expect(runtime.initialized).toBe(true);
            
            await runtime.destroy();
        });

        test('should provide global access in browser environment', async () => {
            // Simulate browser environment
            const originalWindow = global.window;
            global.window = {};

            await runtime.init();

            expect(global.window.SillyTavernRuntime).toBe(SillyTavernRuntime);
            expect(global.window.STRuntime).toBeDefined();
            expect(global.window.STRuntimeEventBus).toBeInstanceOf(EventBus);

            await runtime.destroy();

            expect(global.window.STRuntimeEventBus).toBeUndefined();

            global.window = originalWindow;
        });
    });
}); 