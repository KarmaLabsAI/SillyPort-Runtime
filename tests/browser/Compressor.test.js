const { compress, decompress } = require('../../src/utils/Compressor.js');

export async function runCompressorTests() {
    console.log('=== Running Compressor Utility Browser Tests ===');

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
} 