/**
 * Compressor Utility - Provides modular, browser-compatible data compression and decompression
 *
 * Uses CompressionStream/DecompressionStream if available, with fallback to base64-encoded URI methods.
 *
 * @module Compressor
 */

/**
 * Compress a string using GZIP (CompressionStream) or fallback to base64 encoding.
 * @param {string} data - The string data to compress
 * @returns {Promise<string>} - Compressed data as base64 string
 */
async function compress(data) {
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

/**
 * Decompress a base64 string using GZIP (DecompressionStream) or fallback to URI decoding.
 * @param {string} compressedData - Compressed data as base64 string
 * @returns {Promise<string>} - Decompressed string data
 */
async function decompress(compressedData) {
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

module.exports = { compress, decompress }; 