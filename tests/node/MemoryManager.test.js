const MemoryManager = require('../../src/memory/MemoryManager');

describe('MemoryManager', () => {
    afterEach(() => {
        // Reset usage and metrics after each test
        MemoryManager.usage = 0;
        MemoryManager.metrics.peakUsage = 0;
        MemoryManager.metrics.allocations = 0;
        MemoryManager.metrics.frees = 0;
        MemoryManager.trackedObjects = new WeakMap();
    });

    test('tracks and untracks objects, updates usage', () => {
        const obj1 = {};
        const obj2 = {};
        MemoryManager.track(obj1, 1024);
        expect(MemoryManager.getCurrentUsage()).toBe(1024);
        MemoryManager.track(obj2, 2048);
        expect(MemoryManager.getCurrentUsage()).toBe(3072);
        MemoryManager.untrack(obj1);
        expect(MemoryManager.getCurrentUsage()).toBe(2048);
        MemoryManager.untrack(obj2);
        expect(MemoryManager.getCurrentUsage()).toBe(0);
    });

    test('enforces memory limit and logs warning', () => {
        const obj = {};
        MemoryManager.memoryLimit = 1024;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        MemoryManager.track(obj, 2048);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[MemoryManager] Memory limit exceeded:'),
            expect.any(String)
        );
        warnSpy.mockRestore();
        MemoryManager.untrack(obj);
    });

    test('getUsageReport returns formatted string', () => {
        const obj = {};
        MemoryManager.track(obj, 2048);
        const report = MemoryManager.getUsageReport();
        expect(report).toMatch(/Current: [\d.]+ (B|KB|MB), Peak: [\d.]+ (B|KB|MB), Limit: [\d.]+ (B|KB|MB)/);
        MemoryManager.untrack(obj);
    });

    test('getMetrics returns correct metrics', () => {
        const obj = {};
        MemoryManager.track(obj, 1000);
        MemoryManager.untrack(obj);
        const metrics = MemoryManager.getMetrics();
        expect(metrics.allocations).toBeGreaterThan(0);
        expect(metrics.frees).toBeGreaterThan(0);
        expect(metrics.peakUsage).toBeGreaterThan(0);
    });

    test('startReporting and stopReporting work', done => {
        const obj = {};
        MemoryManager.track(obj, 512);
        MemoryManager.usageReportInterval = 100;
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        MemoryManager.startReporting();
        setTimeout(() => {
            MemoryManager.stopReporting();
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('[MemoryManager] Usage:'),
                expect.any(String)
            );
            logSpy.mockRestore();
            MemoryManager.untrack(obj);
            done();
        }, 250);
    });
}); 