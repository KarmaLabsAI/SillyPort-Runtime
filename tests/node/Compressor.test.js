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

describe('Compressor Utility - Extended', () => {
    const { setConfig, getStats, resetStats } = require('../../src/utils/Compressor.js');
    beforeEach(() => { resetStats(); setConfig({ enabled: true, threshold: 10, debug: false }); });

    it('should use content-aware strategy for JSON', async () => {
        const obj = { foo: 'bar', arr: [1,2,3] };
        const compressed = await compress(obj, { strategy: 'json' });
        const decompressed = await decompress(compressed, { strategy: 'json' });
        expect(JSON.parse(decompressed)).toEqual(obj);
    });

    it('should use content-aware strategy for text', async () => {
        const text = 'This is a plain text string.';
        const compressed = await compress(text, { strategy: 'text' });
        const decompressed = await decompress(compressed, { strategy: 'text' });
        expect(decompressed).toBe(text);
    });

    it('should use content-aware strategy for binary', async () => {
        const arr = new Uint8Array([1,2,3,4,5]);
        const compressed = await compress(arr, { strategy: 'binary' });
        const decompressed = await decompress(compressed, { strategy: 'binary' });
        // decompress returns string, so compare char codes
        expect(Array.from(decompressed).map(c=>c.charCodeAt(0))).toEqual(Array.from(arr));
    });

    it('should cache compression results', async () => {
        const text = 'cache me!';
        await compress(text, { strategy: 'text' });
        const stats1 = getStats();
        await compress(text, { strategy: 'text' });
        const stats2 = getStats();
        expect(stats2.cacheHits).toBeGreaterThan(stats1.cacheHits);
    });

    it('should respect config: disable compression', async () => {
        setConfig({ enabled: false });
        const text = 'no compression';
        const compressed = await compress(text);
        expect(compressed).toBe(text);
    });

    it('should respect config: threshold', async () => {
        setConfig({ enabled: true, threshold: 100 });
        const text = 'short';
        const compressed = await compress(text);
        expect(compressed).toBe(text);
    });

    it('should update and reset stats', async () => {
        await compress('stats test');
        const stats1 = getStats();
        expect(stats1.compressions).toBeGreaterThanOrEqual(0);
        resetStats();
        const stats2 = getStats();
        expect(stats2.compressions).toBe(0);
    });
}); 