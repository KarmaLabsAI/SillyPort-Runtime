const { compress, decompress } = require('../../src/utils/Compressor.js');

describe('Compressor Utility', () => {
    it('should compress and decompress a string (round-trip integrity)', async () => {
        const original = 'The quick brown fox jumps over the lazy dog.';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
    });

    it('should handle empty string', async () => {
        const original = '';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
    });

    it('should handle large strings', async () => {
        const original = 'A'.repeat(10000);
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
        expect(compressed.length).toBeLessThan(original.length * 2); // Should be smaller or not much larger
    });

    it('should handle unicode characters', async () => {
        const original = '😀🐍🚀 こんにちは 你好 Привет';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
    });

    it('should be compatible with fallback (base64-encoded URI)', async () => {
        // Simulate fallback by temporarily removing CompressionStream/DecompressionStream
        const origCompressionStream = global.CompressionStream;
        const origDecompressionStream = global.DecompressionStream;
        global.CompressionStream = undefined;
        global.DecompressionStream = undefined;
        const original = 'Fallback test string!';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        expect(decompressed).toBe(original);
        global.CompressionStream = origCompressionStream;
        global.DecompressionStream = origDecompressionStream;
    });
}); 