/**
 * EventBus Test Suite
 * 
 * Tests for the EventBus implementation to verify all acceptance criteria
 */

// Import EventBus (adjust path as needed)
const EventBus = require('../src/core/EventBus.js');

describe('EventBus', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    afterEach(() => {
        eventBus.removeAllListeners();
        eventBus.clearEventHistory();
    });

    describe('Basic EventBus Implementation', () => {
        test('should create EventBus instance', () => {
            expect(eventBus).toBeInstanceOf(EventBus);
            expect(eventBus.listeners).toBeInstanceOf(Map);
            expect(eventBus.onceListeners).toBeInstanceOf(Map);
        });

        test('should subscribe to events', () => {
            const callback = jest.fn();
            const unsubscribe = eventBus.subscribe('test', callback);
            
            expect(typeof unsubscribe).toBe('function');
            expect(eventBus.listenerCount('test')).toBe(1);
        });

        test('should emit events with data payload', async () => {
            const callback = jest.fn();
            const testData = { message: 'Hello World' };
            
            eventBus.subscribe('test', callback);
            await eventBus.emit('test', testData);
            
            expect(callback).toHaveBeenCalledWith(testData);
        });

        test('should support multiple listeners per event', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const testData = { message: 'Hello World' };
            
            eventBus.subscribe('test', callback1);
            eventBus.subscribe('test', callback2);
            
            expect(eventBus.listenerCount('test')).toBe(2);
            
            await eventBus.emit('test', testData);
            
            expect(callback1).toHaveBeenCalledWith(testData);
            expect(callback2).toHaveBeenCalledWith(testData);
        });

        test('should properly cleanup on unsubscribe', () => {
            const callback = jest.fn();
            const unsubscribe = eventBus.subscribe('test', callback);
            
            expect(eventBus.listenerCount('test')).toBe(1);
            
            unsubscribe();
            
            expect(eventBus.listenerCount('test')).toBe(0);
        });

        test('should handle invalid events', () => {
            const callback = jest.fn();
            
            expect(() => eventBus.subscribe('', callback)).toThrow('Event name must be a non-empty string');
            expect(() => eventBus.subscribe(null, callback)).toThrow('Event name must be a non-empty string');
            expect(() => eventBus.subscribe(undefined, callback)).toThrow('Event name must be a non-empty string');
            expect(() => eventBus.subscribe(123, callback)).toThrow('Event name must be a non-empty string');
        });

        test('should handle invalid callbacks', () => {
            expect(() => eventBus.subscribe('test', null)).toThrow('Callback must be a function');
            expect(() => eventBus.subscribe('test', undefined)).toThrow('Callback must be a function');
            expect(() => eventBus.subscribe('test', 'not a function')).toThrow('Callback must be a function');
        });

        test('should handle invalid event names in emit', async () => {
            await expect(eventBus.emit('')).rejects.toThrow('Event name must be a non-empty string');
            await expect(eventBus.emit(null)).rejects.toThrow('Event name must be a non-empty string');
            await expect(eventBus.emit(undefined)).rejects.toThrow('Event name must be a non-empty string');
        });
    });

    describe('Advanced EventBus Features', () => {
        test('should support one-time event listeners', async () => {
            const callback = jest.fn();
            const testData = { message: 'Hello World' };
            
            eventBus.once('test', callback);
            
            expect(eventBus.listenerCount('test')).toBe(1);
            
            await eventBus.emit('test', testData);
            
            expect(callback).toHaveBeenCalledWith(testData);
            expect(eventBus.listenerCount('test')).toBe(0);
        });

        test('should support event namespacing', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const testData = { message: 'Hello World' };
            
            eventBus.subscribe('test', callback1, { namespace: 'ns1' });
            eventBus.subscribe('test', callback2, { namespace: 'ns2' });
            
            // Emit to specific namespace
            await eventBus.emit('test', testData, { namespace: 'ns1' });
            
            expect(callback1).toHaveBeenCalledWith(testData);
            expect(callback2).not.toHaveBeenCalled();
        });

        test('should track event history', async () => {
            const testData = { message: 'Hello World' };
            
            await eventBus.emit('test', testData);
            
            const history = eventBus.getEventHistory();
            expect(history).toHaveLength(1);
            expect(history[0].name).toBe('test');
            expect(history[0].data).toEqual(testData);
        });

        test('should support async event handling', async () => {
            const asyncCallback = jest.fn().mockImplementation(async (data) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return data.message;
            });
            
            eventBus.subscribe('test', asyncCallback);
            
            const testData = { message: 'Hello World' };
            await eventBus.emit('test', testData);
            
            expect(asyncCallback).toHaveBeenCalledWith(testData);
        });

        test('should handle listener errors gracefully', async () => {
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Test error');
            });
            
            const normalCallback = jest.fn();
            
            eventBus.subscribe('test', errorCallback);
            eventBus.subscribe('test', normalCallback);
            
            const testData = { message: 'Hello World' };
            
            // Should not throw, but should log error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            await eventBus.emit('test', testData);
            
            expect(consoleSpy).toHaveBeenCalled();
            expect(normalCallback).toHaveBeenCalledWith(testData);
            
            consoleSpy.mockRestore();
        });
    });

    describe('Memory Leak Tests', () => {
        test('should properly cleanup listeners on unsubscribe', () => {
            const callback = jest.fn();
            
            // Subscribe and unsubscribe multiple times
            for (let i = 0; i < 10; i++) {
                const unsubscribe = eventBus.subscribe('test', callback);
                unsubscribe();
            }
            
            expect(eventBus.listenerCount('test')).toBe(0);
        });

        test('should cleanup one-time listeners after execution', async () => {
            const callback = jest.fn();
            
            eventBus.once('test', callback);
            await eventBus.emit('test', {});
            await eventBus.emit('test', {});
            
            expect(callback).toHaveBeenCalledTimes(1);
            expect(eventBus.listenerCount('test')).toBe(0);
        });

        test('should handle unsubscribe with null callback', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            eventBus.subscribe('test', callback1);
            eventBus.subscribe('test', callback2);
            
            expect(eventBus.listenerCount('test')).toBe(2);
            
            eventBus.unsubscribe('test');
            
            expect(eventBus.listenerCount('test')).toBe(0);
        });
    });

    describe('Edge Case Testing', () => {
        test('should handle events with no listeners', async () => {
            // Should not throw when emitting to non-existent event
            await expect(eventBus.emit('nonexistent', {})).resolves.not.toThrow();
        });

        test('should handle unsubscribe from non-existent event', () => {
            const callback = jest.fn();
            const result = eventBus.unsubscribe('nonexistent', callback);
            expect(result).toBe(0);
        });

        test('should handle unsubscribe with non-existent callback', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            eventBus.subscribe('test', callback1);
            const result = eventBus.unsubscribe('test', callback2);
            
            expect(result).toBe(0);
            expect(eventBus.listenerCount('test')).toBe(1);
        });

        test('should handle multiple unsubscribes', () => {
            const callback = jest.fn();
            const unsubscribe = eventBus.subscribe('test', callback);
            
            unsubscribe();
            unsubscribe(); // Should not cause issues
            
            expect(eventBus.listenerCount('test')).toBe(0);
        });

        test('should handle rapid subscribe/unsubscribe', () => {
            const callback = jest.fn();
            
            for (let i = 0; i < 100; i++) {
                const unsubscribe = eventBus.subscribe('test', callback);
                unsubscribe();
            }
            
            expect(eventBus.listenerCount('test')).toBe(0);
        });
    });

    describe('Debug Mode', () => {
        test('should enable debug mode', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            eventBus.setDebugMode(true);
            const callback = jest.fn();
            eventBus.subscribe('test', callback);
            
            expect(consoleSpy).toHaveBeenCalledWith('EventBus: Subscribed to \'test\'');
            
            consoleSpy.mockRestore();
        });

        test('should log events in debug mode', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            eventBus.setDebugMode(true);
            const callback = jest.fn();
            eventBus.subscribe('test', callback);
            
            await eventBus.emit('test', { message: 'Hello' });
            
            expect(consoleSpy).toHaveBeenCalledWith('EventBus: Emitting \'test\'', { message: 'Hello' });
            
            consoleSpy.mockRestore();
        });
    });

    describe('Statistics and Utilities', () => {
        test('should provide accurate statistics', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            eventBus.subscribe('test1', callback1);
            eventBus.subscribe('test2', callback2);
            eventBus.once('test3', callback1);
            
            const stats = eventBus.getStats();
            
            expect(stats.totalListeners).toBe(2);
            expect(stats.totalOnceListeners).toBe(1);
            expect(eventBus.eventNames()).toContain('test1');
            expect(eventBus.eventNames()).toContain('test2');
            expect(eventBus.eventNames()).toContain('test3');
        });

        test('should manage event history size', () => {
            eventBus.setMaxHistorySize(3);
            
            for (let i = 0; i < 5; i++) {
                eventBus.emit(`event${i}`, {});
            }
            
            const history = eventBus.getEventHistory();
            expect(history).toHaveLength(3);
        });

        test('should clear event history', () => {
            eventBus.emit('test', {});
            expect(eventBus.getEventHistory()).toHaveLength(1);
            
            eventBus.clearEventHistory();
            expect(eventBus.getEventHistory()).toHaveLength(0);
        });
    });

    describe('Console Test Compatibility', () => {
        test('should work with console test example', async () => {
            const receivedData = [];
            const testCallback = (data) => {
                receivedData.push(data);
                console.log('Received:', data);
            };
            
            eventBus.subscribe('test', testCallback);
            await eventBus.emit('test', { message: 'Hello World' });
            
            expect(receivedData).toHaveLength(1);
            expect(receivedData[0]).toEqual({ message: 'Hello World' });
        });
    });
});

// Run tests if this file is executed directly
if (require.main === module) {
    console.log('Running EventBus tests...');
    
    // Simple test runner for browser environment
    const runTests = async () => {
        const tests = [
            {
                name: 'Basic EventBus Creation',
                test: () => {
                    const eventBus = new EventBus();
                    return eventBus instanceof EventBus;
                }
            },
            {
                name: 'Subscribe and Emit',
                test: async () => {
                    const eventBus = new EventBus();
                    let received = null;
                    
                    eventBus.subscribe('test', (data) => {
                        received = data;
                    });
                    
                    await eventBus.emit('test', { message: 'Hello World' });
                    return received && received.message === 'Hello World';
                }
            },
            {
                name: 'Multiple Listeners',
                test: async () => {
                    const eventBus = new EventBus();
                    let count = 0;
                    
                    eventBus.subscribe('test', () => count++);
                    eventBus.subscribe('test', () => count++);
                    
                    await eventBus.emit('test', {});
                    return count === 2;
                }
            },
            {
                name: 'Unsubscribe',
                test: () => {
                    const eventBus = new EventBus();
                    let count = 0;
                    
                    const unsubscribe = eventBus.subscribe('test', () => count++);
                    eventBus.subscribe('test', () => count++);
                    
                    unsubscribe();
                    eventBus.emit('test', {});
                    
                    return count === 1;
                }
            }
        ];
        
        for (const test of tests) {
            try {
                const result = await test.test();
                console.log(`✓ ${test.name}: ${result ? 'PASS' : 'FAIL'}`);
            } catch (error) {
                console.log(`✗ ${test.name}: ERROR - ${error.message}`);
            }
        }
    };
    
    runTests();
} 