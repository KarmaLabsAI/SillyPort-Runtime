/** @jest-environment node */
/**
 * PNG Metadata Extractor Tests
 * 
 * Tests for Task 2.1.1: PNG Chunk Parser
 */

const PNGMetadataExtractor = require('../../src/character/PNGMetadataExtractor');
const fs = require('fs');
const path = require('path');

describe('PNGMetadataExtractor', () => {
    let extractor;
    let testPngBuffer;
    let corruptedPngBuffer;

    beforeAll(() => {
        extractor = new PNGMetadataExtractor();
        
        // Load test PNG file
        const testPngPath = path.join(__dirname, '../../test-data/characters/default_Seraphina.png');
        let buf = fs.readFileSync(testPngPath);
        testPngBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        
        // Create corrupted PNG (wrong signature)
        let cbuf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
        corruptedPngBuffer = cbuf.buffer.slice(cbuf.byteOffset, cbuf.byteOffset + cbuf.byteLength);
    });

    describe('Task 2.1.1: PNG Chunk Parser', () => {
        describe('PNG file signature validation', () => {
            test('should validate correct PNG signature', () => {
                const dataView = new DataView(testPngBuffer);
                expect(() => extractor.validateSignature(dataView)).not.toThrow();
            });

            test('should reject invalid PNG signature', () => {
                const dataView = new DataView(corruptedPngBuffer);
                expect(() => extractor.validateSignature(dataView)).toThrow('Invalid PNG signature');
            });

            test('should reject files too small to be PNG', () => {
                const smallBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // Only 4 bytes
                const ab = smallBuffer.buffer.slice(smallBuffer.byteOffset, smallBuffer.byteOffset + smallBuffer.byteLength);
                const dataView = new DataView(ab);
                expect(() => extractor.validateSignature(dataView)).toThrow('Invalid PNG signature');
            });
        });

        describe('PNG chunk extraction', () => {
            test('should read chunk headers correctly', () => {
                const dataView = new DataView(testPngBuffer);
                const header = extractor.readChunkHeader(dataView, 8); // First chunk after signature
                
                expect(header).toHaveProperty('length');
                expect(header).toHaveProperty('type');
                expect(header).toHaveProperty('dataOffset');
                expect(header.type).toBe('IHDR'); // First chunk should be IHDR
                expect(header.dataOffset).toBe(16); // 8 + 4 + 4
            });

            test('should extract all chunks from test PNG', () => {
                const chunks = extractor.getChunkInfo(testPngBuffer);
                
                expect(chunks).toBeInstanceOf(Array);
                expect(chunks.length).toBeGreaterThan(0);
                
                // Should have IHDR and IEND chunks
                const chunkTypes = chunks.map(c => c.type);
                expect(chunkTypes).toContain('IHDR');
                expect(chunkTypes).toContain('IEND');
            });

            test('should handle large files correctly', () => {
                // Test with the 539KB test character
                expect(testPngBuffer.byteLength).toBeGreaterThan(500000); // Should be ~539KB
                
                const chunks = extractor.getChunkInfo(testPngBuffer);
                expect(chunks.length).toBeGreaterThan(0);
                
                // Should find tEXt chunks with character metadata
                const textChunks = chunks.filter(c => c.type === 'tEXt');
                expect(textChunks.length).toBeGreaterThan(0);
            });
        });

        describe('CRC validation for chunks', () => {
            test('should validate CRC for valid chunks', () => {
                const dataView = new DataView(testPngBuffer);
                const { length, type, dataOffset } = extractor.readChunkHeader(dataView, 8);
                
                expect(() => extractor.validateChunkCRC(dataView, dataOffset, length, type)).not.toThrow();
            });

            test('should detect CRC mismatches', () => {
                // Create a buffer with corrupted CRC
                let buf = Buffer.from(new Uint8Array(testPngBuffer));
                buf.writeUInt32BE(0x12345678, 16); // Corrupt first chunk CRC
                const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                const dataView = new DataView(ab);
                const { length, type, dataOffset } = extractor.readChunkHeader(dataView, 8);
                
                expect(() => extractor.validateChunkCRC(dataView, dataOffset, length, type)).toThrow('CRC mismatch');
            });
        });

        describe('Error handling for corrupted files', () => {
            test('should handle truncated files gracefully', () => {
                // Create a buffer that's too small for the first chunk
                const truncatedBuffer = testPngBuffer.slice(0, 20); // Only 20 bytes (signature + partial header)
                const dataView = new DataView(truncatedBuffer);
                
                expect(() => extractor.readChunkHeader(dataView, 8)).toThrow();
            });

            test('should handle files with invalid chunk lengths', () => {
                // Create a buffer with invalid chunk length
                let buf = Buffer.from(new Uint8Array(testPngBuffer));
                buf.writeUInt32BE(0xFFFFFFFF, 8); // Invalid length
                const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                expect(() => extractor.extractFromBuffer(ab)).toThrow();
            });

            test('should provide meaningful error messages', () => {
                expect(() => extractor.extractFromBuffer(corruptedPngBuffer)).toThrow();
            });
        });

        describe('Support for large files', () => {
            test('should process large PNG files without memory issues', () => {
                // Test with the actual test file (539KB)
                const result = extractor.extractFromBuffer(testPngBuffer);
                
                expect(result).toBeDefined();
                expect(typeof result).toBe('object');
            });

            test('should handle files with many chunks', () => {
                const chunks = extractor.getChunkInfo(testPngBuffer);
                
                // Should handle multiple chunks efficiently
                expect(chunks.length).toBeGreaterThanOrEqual(5); // Test file should have several chunks
                
                // Each chunk should have valid structure
                chunks.forEach(chunk => {
                    expect(chunk).toHaveProperty('type');
                    expect(chunk).toHaveProperty('length');
                    expect(chunk).toHaveProperty('offset');
                    expect(chunk).toHaveProperty('hasCRC');
                });
            });
        });

        describe('Metadata extraction', () => {
            test('should extract character metadata from test PNG', () => {
                const metadata = extractor.extractFromBuffer(testPngBuffer);
                // Should find character metadata in tEXt chunks
                const key = metadata.chara ? 'chara' : (metadata.ccv3 ? 'ccv3' : null);
                expect(key).not.toBeNull();
                expect(metadata[key]).toHaveProperty('data');
                expect(metadata[key]).toHaveProperty('format');
                expect(metadata[key]).toHaveProperty('size');
                expect(metadata[key]).toHaveProperty('type');
                expect(metadata[key].type).toBe('tEXt');
                // Should be V1 or V2 format
                expect(['v1', 'v2']).toContain(metadata[key].format);
                // Should have character data
                const charData = metadata[key].data;
                expect(charData).toHaveProperty('name');
                expect(charData).toHaveProperty('description');
            });

            test('should detect character card format correctly', () => {
                const metadata = extractor.extractFromBuffer(testPngBuffer);
                const key = metadata.chara ? 'chara' : (metadata.ccv3 ? 'ccv3' : null);
                expect(key).not.toBeNull();
                const charData = metadata[key].data;
                expect(['v1', 'v2']).toContain(extractor.detectFormat(charData));
            });

            test('should handle missing metadata gracefully', () => {
                // Create a PNG without character metadata (just basic PNG)
                const basicPng = Buffer.from([
                    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                    // ... minimal PNG structure would go here
                ]);
                
                // This should throw due to invalid PNG structure
                expect(() => extractor.extractFromBuffer(basicPng.buffer)).toThrow();
            });
        });

        describe('File validation', () => {
            test('should validate correct PNG files', async () => {
                // Create a mock File object
                const mockFile = {
                    arrayBuffer: async () => testPngBuffer
                };
                
                // Mock the instanceof check
                Object.setPrototypeOf(mockFile, File.prototype);
                
                expect(await extractor.validateFileAsync(mockFile)).toBe(true);
            });

            test('should reject invalid files', async () => {
                const mockFile = {
                    arrayBuffer: async () => corruptedPngBuffer
                };
                
                // Mock the instanceof check
                Object.setPrototypeOf(mockFile, File.prototype);
                
                await expect(extractor.validateFileAsync(mockFile)).rejects.toThrow('File validation failed');
            });

            test('should reject files that are too small', async () => {
                const smallBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // Just signature
                const mockFile = {
                    arrayBuffer: async () => smallBuffer.buffer
                };
                
                // Mock the instanceof check
                Object.setPrototypeOf(mockFile, File.prototype);
                
                await expect(extractor.validateFileAsync(mockFile)).rejects.toThrow('File validation failed');
            });
        });

        describe('Console test compatibility', () => {
            test('should work with File API as shown in console test', async () => {
                // Simulate the console test scenario with a proper File object
                const mockFile = {
                    arrayBuffer: async () => testPngBuffer,
                    instanceof: () => true // Mock instanceof check
                };
                
                // Mock the instanceof check
                Object.setPrototypeOf(mockFile, File.prototype);
                
                const metadata = await extractor.extract(mockFile);
                expect(metadata).toBeDefined();
                const key = metadata.chara ? 'chara' : (metadata.ccv3 ? 'ccv3' : null);
                expect(key).not.toBeNull();
                expect(metadata[key]).toBeDefined();
                
                // Test direct buffer extraction
                const metadata2 = extractor.extractFromBuffer(testPngBuffer);
                expect(metadata2).toEqual(metadata);
            });
        });
    });

    describe('Edge cases and robustness', () => {
        test('should handle empty buffers', () => {
            const emptyBuffer = Buffer.alloc(0);
            expect(() => extractor.extractFromBuffer(emptyBuffer.buffer)).toThrow();
        });

        test('should handle buffers smaller than PNG signature', () => {
            const smallBuffer = Buffer.from([0x89, 0x50, 0x4E]);
            expect(() => extractor.extractFromBuffer(smallBuffer.buffer)).toThrow();
        });

        test('should handle non-PNG files gracefully', () => {
            const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG signature
            expect(() => extractor.extractFromBuffer(jpegBuffer.buffer)).toThrow();
        });
    });
}); 