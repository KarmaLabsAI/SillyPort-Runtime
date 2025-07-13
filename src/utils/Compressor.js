/**
 * Compressor Utility - Provides modular, browser-compatible data compression and decompression
 *
 * Uses CompressionStream/DecompressionStream if available, with fallback to base64-encoded URI methods.
 * Supports content-aware compression strategies, caching, configuration, and monitoring.
 *
 * @module Compressor
 */

// --- Compression Strategies, Caching, Monitoring, and Config ---

const defaultConfig = {
    enabled: true,
    threshold: 1024, // bytes
    strategy: 'auto', // 'auto', 'text', 'json', 'binary'
    debug: false
};

let compressorConfig = { ...defaultConfig };
let stats = {
    compressions: 0,
    decompressions: 0,
    errors: 0,
    totalOriginal: 0,
    totalCompressed: 0,
    cacheHits: 0,
    cacheMisses: 0
};

// Simple in-memory cache (key: hash of input, value: compressed output)
const compressionCache = new Map();
const decompressionCache = new Map();

function setConfig(newConfig = {}) {
    compressorConfig = { ...compressorConfig, ...newConfig };
}

function getStats() {
    return {
        ...stats,
        averageRatio: stats.compressions > 0 ? stats.totalCompressed / stats.totalOriginal : 1.0,
        cacheSize: compressionCache.size
    };
}

function resetStats() {
    stats = {
        compressions: 0,
        decompressions: 0,
        errors: 0,
        totalOriginal: 0,
        totalCompressed: 0,
        cacheHits: 0,
        cacheMisses: 0
    };
    compressionCache.clear();
    decompressionCache.clear();
}

function debugLog(...args) {
    if (compressorConfig.debug && typeof console !== 'undefined') {
        console.log('[Compressor]', ...args);
    }
}

function hashInput(input) {
    // Simple hash for cache key (not cryptographically secure)
    let hash = 0, i, chr;
    if (typeof input !== 'string') input = JSON.stringify(input);
    for (i = 0; i < input.length; i++) {
        chr = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString();
}

function detectStrategy(data, strategy) {
    if (strategy && strategy !== 'auto') return strategy;
    if (typeof data === 'string') {
        try {
            JSON.parse(data);
            return 'json';
        } catch {
            return 'text';
        }
    }
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) return 'binary';
    return 'text';
}

/**
 * Compress data using content-aware strategies with caching and monitoring.
 * @param {string|Object|Uint8Array} data - The data to compress
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Compressed data as base64 string
 */
async function compress(data, options = {}) {
    const config = { ...compressorConfig, ...options };
    if (!config.enabled) return data;
    let dataString = data;
    let strategy = detectStrategy(data, config.strategy);
    if (strategy === 'json' && typeof data !== 'string') dataString = JSON.stringify(data);
    if (strategy === 'binary' && data instanceof Uint8Array) dataString = String.fromCharCode(...data);
    const key = hashInput(dataString + strategy);
    if (compressionCache.has(key)) {
        stats.cacheHits++;
        debugLog('Compression cache hit', { key });
        return compressionCache.get(key);
    }
    stats.cacheMisses++;
    // Only compress if over threshold
    const size = typeof dataString === 'string' ? dataString.length : 0;
    if (size < config.threshold) {
        debugLog('Below threshold, not compressing', { size, threshold: config.threshold });
        compressionCache.set(key, dataString);
        return dataString;
    }
    try {
        let compressed;
        if (strategy === 'text' || strategy === 'json') {
            compressed = await _compressString(dataString);
        } else if (strategy === 'binary') {
            compressed = await _compressString(dataString); // fallback: treat as string
        } else {
            compressed = await _compressString(dataString);
        }
        stats.compressions++;
        stats.totalOriginal += size;
        stats.totalCompressed += compressed.length;
        compressionCache.set(key, compressed);
        debugLog('Compressed', { strategy, size, compressedSize: compressed.length });
        return compressed;
    } catch (e) {
        stats.errors++;
        debugLog('Compression error', e);
        compressionCache.set(key, dataString);
        return dataString;
    }
}

/**
 * Decompress data with caching and monitoring.
 * @param {string} compressedData - Compressed data as base64 string
 * @param {Object} options - Decompression options
 * @returns {Promise<string>} - Decompressed string data
 */
async function decompress(compressedData, options = {}) {
    const config = { ...compressorConfig, ...options };
    if (!config.enabled) return compressedData;
    const key = hashInput(compressedData);
    if (decompressionCache.has(key)) {
        stats.cacheHits++;
        debugLog('Decompression cache hit', { key });
        return decompressionCache.get(key);
    }
    stats.cacheMisses++;
    try {
        let decompressed = await _decompressString(compressedData);
        stats.decompressions++;
        decompressionCache.set(key, decompressed);
        debugLog('Decompressed', { size: decompressed.length });
        return decompressed;
    } catch (e) {
        stats.errors++;
        debugLog('Decompression error', e);
        decompressionCache.set(key, compressedData);
        return compressedData;
    }
}

// Internal: original compress/decompress logic
async function _compressString(data) {
    if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        await writer.write(dataBuffer);
        await writer.close();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const compressedBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            compressedBuffer.set(chunk, offset);
            offset += chunk.length;
        }
        return btoa(String.fromCharCode(...compressedBuffer));
    } else {
        // Fallback: base64-encoded URI
        return btoa(unescape(encodeURIComponent(data)));
    }
}

async function _decompressString(compressedData) {
    if (typeof DecompressionStream !== 'undefined') {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        const compressedBuffer = new Uint8Array(atob(compressedData).split('').map(c => c.charCodeAt(0)));
        await writer.write(compressedBuffer);
        await writer.close();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const decompressedBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            decompressedBuffer.set(chunk, offset);
            offset += chunk.length;
        }
        return new TextDecoder().decode(decompressedBuffer);
    } else {
        // Fallback: URI decoding
        return decodeURIComponent(escape(atob(compressedData)));
    }
}

module.exports = { compress, decompress, setConfig, getStats, resetStats }; 