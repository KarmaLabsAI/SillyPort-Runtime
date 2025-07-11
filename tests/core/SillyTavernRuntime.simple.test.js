/**
 * SillyTavernRuntime Simple Tests
 * 
 * Simplified tests for Task 1.5.1: Runtime Bootstrap
 * Focuses on core functionality without complex StorageManager initialization
 */

const SillyTavernRuntime = require('../../src/core/SillyTavernRuntime');
const EventBus = require('../../src/core/EventBus');
const StateManager = require('../../src/core/StateManager');
const ConfigManager = require('../../src/core/ConfigManager');

describe('SillyTavernRuntime - Simple Tests', () => {
    let runtime;

    beforeEach(() => {
        runtime = new SillyTavernRuntime();
    });

    afterEach(async () => {
        if (runtime && runtime.initialized) {
            await runtime.destroy();
        }
    });

    describe('Task 1.5.1: Runtime Bootstrap - Core Functionality', () => {
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

            test('should prevent double initialization', () => {
                // Test the logic without actually initializing
                runtime.initialized = true;
                expect(() => runtime.init()).rejects.toThrow(
                    'SillyTavernRuntime: Already initialized'
                );
            });

            test('should prevent concurrent initialization', () => {
                // Test the logic without actually initializing
                runtime.initializing = true;
                expect(() => runtime.init()).rejects.toThrow(
                    'SillyTavernRuntime: Initialization already in progress'
                );
            });
        });

        describe('Component dependency management', () => {
            test('should have correct component initialization order', () => {
                expect(runtime.componentOrder).toEqual([
                    'eventBus',
                    'stateManager',
                    'configManager',
                    'storageManager'
                ]);
            });

            test('should track component initialization status', () => {
                expect(runtime.isComponentInitialized('eventBus')).toBe(false);
                expect(runtime.isComponentInitialized('stateManager')).toBe(false);
                expect(runtime.isComponentInitialized('configManager')).toBe(false);
                expect(runtime.isComponentInitialized('storageManager')).toBe(false);

                // Test setting status
                runtime.initStatus.eventBus = true;
                expect(runtime.isComponentInitialized('eventBus')).toBe(true);
            });

            test('should provide component access methods', () => {
                expect(runtime.getComponent('eventBus')).toBeNull();
                expect(runtime.getComponent('nonexistent')).toBeNull();
            });

            test('should get initialization status', () => {
                const status = runtime.getInitStatus();
                expect(status.eventBus).toBe(false);
                expect(status.stateManager).toBe(false);
                expect(status.configManager).toBe(false);
                expect(status.storageManager).toBe(false);
            });
        });

        describe('Initialization error handling', () => {
            test('should track initialization errors', () => {
                const error = {
                    component: 'test',
                    error: 'Test error',
                    timestamp: Date.now()
                };

                runtime.initErrors.push(error);
                const errors = runtime.getInitErrors();
                expect(errors).toHaveLength(1);
                expect(errors[0].component).toBe('test');
                expect(errors[0].error).toBe('Test error');
            });
        });

        describe('Lifecycle event emission', () => {
            test('should have lifecycle events defined', () => {
                expect(runtime.lifecycleEvents).toContain('runtime:init-start');
                expect(runtime.lifecycleEvents).toContain('runtime:init-complete');
                expect(runtime.lifecycleEvents).toContain('runtime:init-error');
                expect(runtime.lifecycleEvents).toContain('runtime:destroy-start');
                expect(runtime.lifecycleEvents).toContain('runtime:destroy-complete');
            });

            test('should reject invalid lifecycle events', () => {
                expect(() => {
                    runtime.subscribeToLifecycle('invalid-event', () => {});
                }).toThrow('Invalid lifecycle event: invalid-event');
            });

            test('should validate lifecycle events', () => {
                expect(runtime.lifecycleEvents.includes('runtime:init-start')).toBe(true);
                expect(runtime.lifecycleEvents.includes('invalid-event')).toBe(false);
            });
        });

        describe('Configuration loading', () => {
            test('should handle configuration object', () => {
                const config = {
                    debugMode: true,
                    performance: {
                        memoryCacheCapacity: 1000
                    }
                };

                runtime.config = config;
                expect(runtime.config.debugMode).toBe(true);
                expect(runtime.config.performance.memoryCacheCapacity).toBe(1000);
            });

            test('should set debug mode', () => {
                runtime.setDebugMode(true);
                expect(runtime.debugMode).toBe(true);
            });
        });

        describe('Runtime statistics and debugging', () => {
            test('should provide runtime statistics', () => {
                const stats = runtime.getStats();
                expect(stats.version).toBe('1.0.0');
                expect(stats.initialized).toBe(false);
                expect(stats.initializing).toBe(false);
                expect(stats.components).toBeDefined();
                expect(stats.errors).toBeDefined();
                expect(stats.debugMode).toBeDefined();
            });

            test('should enable debug mode', () => {
                runtime.setDebugMode(true);
                expect(runtime.debugMode).toBe(true);
            });

            test('should disable debug mode', () => {
                runtime.setDebugMode(false);
                expect(runtime.debugMode).toBe(false);
            });
        });

        describe('Runtime destruction', () => {
            test('should handle destruction when not initialized', async () => {
                // Should not throw when destroying uninitialized runtime
                await expect(runtime.destroy()).resolves.toBeUndefined();
            });

            test('should have destroy method', () => {
                expect(typeof runtime.destroy).toBe('function');
                expect(runtime.destroy.constructor.name).toBe('AsyncFunction');
            });
        });
    });

    describe('Component Initialization Methods', () => {
        test('should have EventBus initialization method', () => {
            expect(typeof runtime.initializeEventBus).toBe('function');
            expect(runtime.initializeEventBus.constructor.name).toBe('AsyncFunction');
        });

        test('should have StateManager initialization method', () => {
            expect(typeof runtime.initializeStateManager).toBe('function');
            expect(runtime.initializeStateManager.constructor.name).toBe('AsyncFunction');
        });

        test('should have ConfigManager initialization method', () => {
            expect(typeof runtime.initializeConfigManager).toBe('function');
            expect(runtime.initializeConfigManager.constructor.name).toBe('AsyncFunction');
        });

        test('should have StorageManager initialization method', () => {
            expect(typeof runtime.initializeStorageManager).toBe('function');
            expect(runtime.initializeStorageManager.constructor.name).toBe('AsyncFunction');
        });
    });

    describe('Utility Methods', () => {
        test('should have emitLifecycleEvent method', () => {
            expect(typeof runtime.emitLifecycleEvent).toBe('function');
        });

        test('should have subscribe method', () => {
            expect(typeof runtime.subscribe).toBe('function');
        });

        test('should have subscribeToLifecycle method', () => {
            expect(typeof runtime.subscribeToLifecycle).toBe('function');
        });

        test('should have getConfig method', () => {
            expect(typeof runtime.getConfig).toBe('function');
        });

        test('should have setConfig method', () => {
            expect(typeof runtime.setConfig).toBe('function');
        });

        test('should have getState method', () => {
            expect(typeof runtime.getState).toBe('function');
        });

        test('should have setState method', () => {
            expect(typeof runtime.setState).toBe('function');
        });
    });

    describe('Console Test Compatibility', () => {
        test('should work with console test example structure', () => {
            // Test the console example structure from task breakdown
            const runtime = new SillyTavernRuntime();
            expect(runtime).toBeInstanceOf(SillyTavernRuntime);
            expect(runtime.initialized).toBe(false);
        });

        test('should provide global access structure', () => {
            // Test the global access structure
            expect(typeof SillyTavernRuntime).toBe('function');
            expect(SillyTavernRuntime.name).toBe('SillyTavernRuntime');
        });
    });
}); 