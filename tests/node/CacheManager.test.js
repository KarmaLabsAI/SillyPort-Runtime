const cacheManager = require('../../src/memory/CacheManager');

describe('CacheManager', () => {
    beforeEach(() => {
        cacheManager.clear();
        cacheManager.maxEntries = 3;
        cacheManager.resetStats();
    });

    test('set and get', () => {
        cacheManager.set('a', 1);
        expect(cacheManager.get('a')).toBe(1);
        expect(cacheManager.get('b')).toBeUndefined();
    });

    test('LRU eviction', () => {
        cacheManager.set('a', 1);
        cacheManager.set('b', 2);
        cacheManager.set('c', 3);
        cacheManager.set('d', 4); // should evict 'a'
        expect(cacheManager.get('a')).toBeUndefined();
        expect(cacheManager.get('b')).toBe(2);
        expect(cacheManager.get('c')).toBe(3);
        expect(cacheManager.get('d')).toBe(4);
    });

    test('LRU order update on get', () => {
        cacheManager.set('a', 1);
        cacheManager.set('b', 2);
        cacheManager.set('c', 3);
        cacheManager.get('a'); // a is now most recently used
        cacheManager.set('d', 4); // should evict 'b'
        expect(cacheManager.get('b')).toBeUndefined();
        expect(cacheManager.get('a')).toBe(1);
    });

    test('delete', () => {
        cacheManager.set('a', 1);
        cacheManager.delete('a');
        expect(cacheManager.get('a')).toBeUndefined();
    });

    test('clear', () => {
        cacheManager.set('a', 1);
        cacheManager.set('b', 2);
        cacheManager.clear();
        expect(cacheManager.get('a')).toBeUndefined();
        expect(cacheManager.get('b')).toBeUndefined();
    });

    test('statistics', () => {
        cacheManager.set('a', 1);
        cacheManager.get('a');
        cacheManager.get('b');
        cacheManager.set('b', 2);
        cacheManager.set('c', 3);
        cacheManager.set('d', 4); // evict 'a'
        const stats = cacheManager.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.evictions).toBe(1);
        expect(stats.size).toBe(3);
    });

    test('custom sizeOf', () => {
        const customCache = new (require('../../src/memory/CacheManager').constructor)({
            maxEntries: 2,
            sizeOf: (v) => v.length
        });
        customCache.set('x', 'abc');
        customCache.set('y', 'de');
        expect(customCache.getStats().totalSize).toBe(5);
    });
}); 