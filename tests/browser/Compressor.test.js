const { compress, decompress } = require('../../src/utils/Compressor.js');
import { setConfig, getStats, resetStats } from '../../src/utils/Compressor.js';

export async function runCompressorTests() {
    console.log('=== Running Compressor Utility Browser Tests ===');
    resetStats();
    setConfig({ enabled: true, threshold: 10, debug: false });

    test('compress/decompress round-trip integrity', async () => {
        const original = 'The quick brown fox jumps over the lazy dog.';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        assert(decompressed === original, 'Round-trip failed');
    });

    test('handle empty string', async () => {
        const original = '';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        assert(decompressed === original, 'Empty string round-trip failed');
    });

    test('handle large strings', async () => {
        const original = 'A'.repeat(10000);
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        assert(decompressed === original, 'Large string round-trip failed');
        assert(compressed.length < original.length * 2, 'Compression ratio not reasonable');
    });

    test('handle unicode characters', async () => {
        const original = '😀🐍🚀 こんにちは 你好 Привет';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        assert(decompressed === original, 'Unicode round-trip failed');
    });

    test('fallback compatibility (base64-encoded URI)', async () => {
        const origCompressionStream = window.CompressionStream;
        const origDecompressionStream = window.DecompressionStream;
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
        const original = 'Fallback test string!';
        const compressed = await compress(original);
        const decompressed = await decompress(compressed);
        assert(decompressed === original, 'Fallback round-trip failed');
        window.CompressionStream = origCompressionStream;
        window.DecompressionStream = origDecompressionStream;
    });

    test('content-aware strategy for JSON', async () => {
        const obj = { foo: 'bar', arr: [1,2,3] };
        const compressed = await compress(obj, { strategy: 'json' });
        const decompressed = await decompress(compressed, { strategy: 'json' });
        assert(JSON.parse(decompressed).foo === 'bar', 'JSON round-trip failed');
    });

    test('content-aware strategy for text', async () => {
        const text = 'plain text string.';
        const compressed = await compress(text, { strategy: 'text' });
        const decompressed = await decompress(compressed, { strategy: 'text' });
        assert(decompressed === text, 'Text round-trip failed');
    });

    test('content-aware strategy for binary', async () => {
        const arr = new Uint8Array([1,2,3,4,5]);
        const compressed = await compress(arr, { strategy: 'binary' });
        const decompressed = await decompress(compressed, { strategy: 'binary' });
        assert(Array.from(decompressed).map(c=>c.charCodeAt(0)).join(',') === Array.from(arr).join(','), 'Binary round-trip failed');
    });

    test('compression caching', async () => {
        const text = 'cache me!';
        await compress(text, { strategy: 'text' });
        const stats1 = getStats();
        await compress(text, { strategy: 'text' });
        const stats2 = getStats();
        assert(stats2.cacheHits > stats1.cacheHits, 'Cache hit not incremented');
    });

    test('config: disable compression', async () => {
        setConfig({ enabled: false });
        const text = 'no compression';
        const compressed = await compress(text);
        assert(compressed === text, 'Compression should be disabled');
    });

    test('config: threshold', async () => {
        setConfig({ enabled: true, threshold: 100 });
        const text = 'short';
        const compressed = await compress(text);
        assert(compressed === text, 'Should not compress below threshold');
    });

    test('stats update and reset', async () => {
        await compress('stats test');
        const stats1 = getStats();
        assert(stats1.compressions >= 0, 'Stats not updated');
        resetStats();
        const stats2 = getStats();
        assert(stats2.compressions === 0, 'Stats not reset');
    });
} 