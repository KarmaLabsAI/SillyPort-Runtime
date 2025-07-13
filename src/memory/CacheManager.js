// CacheManager - LRU cache for SillyTavern Browser Runtime
//
// Provides LRU eviction, configurable max size, statistics, and performance metrics.
//
// Task 5.1.2: Cache Management

class CacheManager {
    /**
     * @param {object} options
     * @param {number} [options.maxEntries=100] - Maximum number of cache entries
     * @param {function} [options.sizeOf] - Function to estimate size of a value (optional)
     */
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 100;
        this.sizeOf = options.sizeOf || (() => 1);
        this.cache = new Map(); // key -> {value, size}
        this.order = new Set(); // keys in LRU order (oldest first)
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            sets: 0,
            gets: 0,
            clears: 0
        };
        this.totalSize = 0;
    }

    /**
     * Set a value in the cache
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
        const size = this.sizeOf(value);
        if (this.cache.has(key)) {
            // Update existing
            const old = this.cache.get(key);
            this.totalSize -= old.size;
            this.order.delete(key);
        }
        this.cache.set(key, { value, size });
        this.order.add(key);
        this.totalSize += size;
        this.stats.sets++;
        this._evictIfNeeded();
    }

    /**
     * Get a value from the cache
     * @param {string} key
     * @returns {any}
     */
    get(key) {
        this.stats.gets++;
        if (!this.cache.has(key)) {
            this.stats.misses++;
            return undefined;
        }
        this.stats.hits++;
        // LRU: move to end
        this.order.delete(key);
        this.order.add(key);
        return this.cache.get(key).value;
    }

    /**
     * Delete a value from the cache
     * @param {string} key
     */
    delete(key) {
        if (this.cache.has(key)) {
            const { size } = this.cache.get(key);
            this.totalSize -= size;
            this.cache.delete(key);
            this.order.delete(key);
        }
    }

    /**
     * Clear the cache
     */
    clear() {
        this.cache.clear();
        this.order.clear();
        this.totalSize = 0;
        this.stats.clears++;
    }

    /**
     * Reset cache statistics (for testing)
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            sets: 0,
            gets: 0,
            clears: 0
        };
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        return { ...this.stats, size: this.cache.size, totalSize: this.totalSize };
    }

    /**
     * Internal: evict LRU entries if over maxEntries
     */
    _evictIfNeeded() {
        while (this.cache.size > this.maxEntries) {
            // Evict oldest
            const oldest = this.order.values().next().value;
            if (oldest !== undefined) {
                const { size } = this.cache.get(oldest);
                this.totalSize -= size;
                this.cache.delete(oldest);
                this.order.delete(oldest);
                this.stats.evictions++;
            }
        }
    }
}

// Singleton instance
const cacheManager = new CacheManager();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = cacheManager;
} else {
    window.CacheManager = cacheManager;
} 