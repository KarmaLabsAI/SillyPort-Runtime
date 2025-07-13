/**
 * MemoryManager - Tracks and manages memory usage for SillyTavern Browser Runtime
 *
 * Provides memory usage tracking, limit enforcement, usage reporting, leak detection stub, and performance metrics.
 *
 * Task 5.1.1: Memory Monitoring
 */
class MemoryManager {
    constructor(options = {}) {
        this.memoryLimit = options.memoryLimit || 50 * 1024 * 1024; // 50MB default
        this.usage = 0;
        this.usageHistory = [];
        this.usageReportInterval = options.usageReportInterval || 10000; // 10s
        this.lastReport = null;
        this.metrics = {
            peakUsage: 0,
            allocations: 0,
            frees: 0,
            leaksDetected: 0
        };
        this.trackedObjects = new WeakMap();
        this.reportingTimer = null;
    }

    /**
     * Track an object and its estimated size in bytes
     * @param {any} obj - The object to track
     * @param {number} size - Estimated size in bytes
     */
    track(obj, size) {
        if (!obj || typeof size !== 'number') return;
        this.trackedObjects.set(obj, size);
        this.usage += size;
        this.metrics.allocations++;
        if (this.usage > this.metrics.peakUsage) {
            this.metrics.peakUsage = this.usage;
        }
        this.enforceLimit();
    }

    /**
     * Untrack an object and free its memory usage
     * @param {any} obj - The object to untrack
     */
    untrack(obj) {
        if (!obj) return;
        const size = this.trackedObjects.get(obj) || 0;
        if (size) {
            this.usage -= size;
            this.metrics.frees++;
        }
        this.trackedObjects.delete(obj);
    }

    /**
     * Get current memory usage in bytes
     * @returns {number}
     */
    getCurrentUsage() {
        return this.usage;
    }

    /**
     * Get memory usage as a formatted string
     * @returns {string}
     */
    getUsageReport() {
        return `Current: ${this.formatBytes(this.usage)}, Peak: ${this.formatBytes(this.metrics.peakUsage)}, Limit: ${this.formatBytes(this.memoryLimit)}`;
    }

    /**
     * Enforce memory limit, emit warning if exceeded
     */
    enforceLimit() {
        if (this.usage > this.memoryLimit) {
            // Emit warning or throw error as needed
            console.warn('[MemoryManager] Memory limit exceeded:', this.getUsageReport());
        }
    }

    /**
     * Start periodic usage reporting
     */
    startReporting() {
        if (this.reportingTimer) return;
        this.reportingTimer = setInterval(() => {
            this.usageHistory.push({
                timestamp: Date.now(),
                usage: this.usage
            });
            this.lastReport = this.getUsageReport();
            console.log('[MemoryManager] Usage:', this.lastReport);
        }, this.usageReportInterval);
    }

    /**
     * Stop periodic usage reporting
     */
    stopReporting() {
        if (this.reportingTimer) {
            clearInterval(this.reportingTimer);
            this.reportingTimer = null;
        }
    }

    /**
     * Stub for memory leak detection (future expansion)
     */
    detectLeaks() {
        // TODO: Implement leak detection logic
        // For now, just return 0
        return 0;
    }

    /**
     * Get performance metrics
     * @returns {object}
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Utility: Format bytes as human-readable string
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}

// Singleton instance
const memoryManager = new MemoryManager();
module.exports = memoryManager; 