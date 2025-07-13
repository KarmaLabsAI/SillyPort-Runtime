/**
 * Test Console API for Task 6.1.1
 * 
 * This file tests the console helper functions that should be available
 * in the browser environment for easy testing and development.
 */

// Mock browser environment for testing
global.window = {};
global.fetch = jest.fn();
global.File = jest.fn();
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('Console API - Task 6.1.1', () => {
    let STRuntime;
    
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Reset window object
        global.window = {};
        
        // Load the index file to set up STRuntime
        require('../../src/index.js');
        STRuntime = global.window.STRuntime;
    });
    
    describe('STRuntime namespace', () => {
        it('should expose all required classes globally', () => {
            expect(global.window.STRuntime).toBeDefined();
            expect(global.window.STRuntime.EventBus).toBeDefined();
            expect(global.window.STRuntime.StateManager).toBeDefined();
            expect(global.window.STRuntime.ConfigManager).toBeDefined();
            expect(global.window.STRuntime.StorageManager).toBeDefined();
            expect(global.window.STRuntime.SillyTavernRuntime).toBeDefined();
        });
        
        it('should expose console helper functions', () => {
            expect(typeof STRuntime.init).toBe('function');
            expect(typeof STRuntime.loadCharacterFromURL).toBe('function');
            expect(typeof STRuntime.loadPresetsFromURL).toBe('function');
            expect(typeof STRuntime.createTestChat).toBe('function');
            expect(typeof STRuntime.getStats).toBe('function');
            expect(typeof STRuntime.setDebugMode).toBe('function');
            expect(typeof STRuntime.destroy).toBe('function');
            expect(typeof STRuntime.getRuntime).toBe('function');
        });
        
        it('should log helpful console messages', () => {
            expect(console.log).toHaveBeenCalledWith('🚀 SillyTavern Runtime loaded!');
            expect(console.log).toHaveBeenCalledWith('Available classes:', expect.any(Array));
            expect(console.log).toHaveBeenCalledWith('Console helpers: STRuntime.init(), STRuntime.loadCharacterFromURL(), STRuntime.createTestChat(), STRuntime.getStats()');
        });
    });
    
    describe('STRuntime.init()', () => {
        it('should be an async function', () => {
            expect(STRuntime.init.constructor.name).toBe('AsyncFunction');
        });
        
        it('should accept a config parameter', () => {
            expect(STRuntime.init.length).toBe(1);
        });
    });
    
    describe('STRuntime.loadCharacterFromURL()', () => {
        it('should be an async function', () => {
            expect(STRuntime.loadCharacterFromURL.constructor.name).toBe('AsyncFunction');
        });
        
        it('should accept a URL parameter', () => {
            expect(STRuntime.loadCharacterFromURL.length).toBe(1);
        });
        
        it('should handle runtime not initialized error', async () => {
            await expect(STRuntime.loadCharacterFromURL('test-url')).rejects.toThrow(
                'Runtime not initialized. Call STRuntime.init() first.'
            );
        });
    });
    
    describe('STRuntime.loadPresetsFromURL()', () => {
        it('should be an async function', () => {
            expect(STRuntime.loadPresetsFromURL.constructor.name).toBe('AsyncFunction');
        });
        
        it('should accept a directory parameter', () => {
            expect(STRuntime.loadPresetsFromURL.length).toBe(1);
        });
        
        it('should return context presets for context directory', async () => {
            const presets = await STRuntime.loadPresetsFromURL('test-data/presets/context/');
            
            expect(Array.isArray(presets)).toBe(true);
            expect(presets.length).toBe(3);
            expect(presets[0].name).toBe('ChatML');
            expect(presets[1].name).toBe('Llama');
            expect(presets[2].name).toBe('Mistral');
        });
        
        it('should return instruction presets for instruct directory', async () => {
            const presets = await STRuntime.loadPresetsFromURL('test-data/presets/instruct/');
            
            expect(Array.isArray(presets)).toBe(true);
            expect(presets.length).toBe(3);
            expect(presets[0].name).toBe('Alpaca');
            expect(presets[1].name).toBe('Vicuna');
            expect(presets[2].name).toBe('OpenChat');
        });
    });
    
    describe('STRuntime.createTestChat()', () => {
        it('should be an async function', () => {
            expect(STRuntime.createTestChat.constructor.name).toBe('AsyncFunction');
        });
        
        it('should accept no parameters', () => {
            expect(STRuntime.createTestChat.length).toBe(0);
        });
        
        it('should handle runtime not initialized error', async () => {
            await expect(STRuntime.createTestChat()).rejects.toThrow(
                'Runtime not initialized. Call STRuntime.init() first.'
            );
        });
    });
    
    describe('STRuntime.getStats()', () => {
        it('should be a synchronous function', () => {
            expect(typeof STRuntime.getStats).toBe('function');
            expect(STRuntime.getStats.constructor.name).toBe('Function');
        });
        
        it('should accept no parameters', () => {
            expect(STRuntime.getStats.length).toBe(0);
        });
        
        it('should return error when runtime not initialized', () => {
            const stats = STRuntime.getStats();
            
            expect(stats).toBeDefined();
            expect(stats.error).toBe('Runtime not initialized. Call STRuntime.init() first.');
        });
    });
    
    describe('STRuntime.setDebugMode()', () => {
        it('should be a synchronous function', () => {
            expect(typeof STRuntime.setDebugMode).toBe('function');
            expect(STRuntime.setDebugMode.constructor.name).toBe('Function');
        });
        
        it('should accept one parameter', () => {
            expect(STRuntime.setDebugMode.length).toBe(1);
        });
        
        it('should warn when runtime not initialized', () => {
            STRuntime.setDebugMode(true);
            
            expect(console.warn).toHaveBeenCalledWith('⚠️ Runtime not initialized. Call STRuntime.init() first.');
        });
    });
    
    describe('STRuntime.destroy()', () => {
        it('should be an async function', () => {
            expect(STRuntime.destroy.constructor.name).toBe('AsyncFunction');
        });
        
        it('should accept no parameters', () => {
            expect(STRuntime.destroy.length).toBe(0);
        });
    });
    
    describe('STRuntime.getRuntime()', () => {
        it('should be a synchronous function', () => {
            expect(typeof STRuntime.getRuntime).toBe('function');
            expect(STRuntime.getRuntime.constructor.name).toBe('Function');
        });
        
        it('should accept no parameters', () => {
            expect(STRuntime.getRuntime.length).toBe(0);
        });
        
        it('should return null when runtime not initialized', () => {
            const runtime = STRuntime.getRuntime();
            expect(runtime).toBeNull();
        });
    });
    
    describe('Error handling', () => {
        it('should provide clear error messages for uninitialized runtime', async () => {
            // Test all functions that require initialization
            await expect(STRuntime.loadCharacterFromURL('test')).rejects.toThrow(
                'Runtime not initialized. Call STRuntime.init() first.'
            );
            
            await expect(STRuntime.createTestChat()).rejects.toThrow(
                'Runtime not initialized. Call STRuntime.init() first.'
            );
            
            const stats = STRuntime.getStats();
            expect(stats.error).toBe('Runtime not initialized. Call STRuntime.init() first.');
        });
    });
    
    describe('Function signatures', () => {
        it('should have correct function signatures for all helper functions', () => {
            // Verify all console helper functions exist and have correct signatures
            const expectedFunctions = [
                'init',
                'loadCharacterFromURL', 
                'loadPresetsFromURL',
                'createTestChat',
                'getStats',
                'setDebugMode',
                'destroy',
                'getRuntime'
            ];
            
            expectedFunctions.forEach(funcName => {
                expect(STRuntime[funcName]).toBeDefined();
                expect(typeof STRuntime[funcName]).toBe('function');
            });
        });
    });
}); 