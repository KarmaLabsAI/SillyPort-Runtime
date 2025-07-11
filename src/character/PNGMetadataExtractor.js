/**
 * PNG Metadata Extractor
 * 
 * Handles PNG file parsing and metadata extraction for character cards.
 * Supports both 'chara' (V2) and 'ccv3' (V3) metadata formats.
 * 
 * Task 2.1.1: PNG Chunk Parser
 */

// Polyfill for atob in Node.js environment
if (typeof atob === 'undefined') {
    global.atob = function(str) {
        return Buffer.from(str, 'base64').toString('binary');
    };
}

class PNGMetadataExtractor {
    constructor() {
        // PNG file signature (8 bytes)
        this.PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        
        // Supported metadata chunk types
        this.METADATA_CHUNKS = ['chara', 'ccv3'];
        
        // Supported tEXt chunk keywords for character data
        this.TEXT_KEYWORDS = ['chara', 'ccv3'];
        
        // CRC table for validation
        this.crcTable = this.generateCRCTable();
    }

    /**
     * Generate CRC-32 lookup table
     */
    generateCRCTable() {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            table[i] = c;
        }
        return table;
    }

    /**
     * Calculate CRC-32 for data
     */
    calculateCRC(data) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = this.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Validates PNG signature at the given offset
     * @param {DataView} dataView - DataView of the PNG data
     * @param {number} offset - Offset to check signature (default: 0)
     * @returns {boolean} True if signature is valid
     * @throws {Error} If signature is invalid or buffer too small
     */
    validateSignature(dataView, offset = 0) {
        // Check if buffer is large enough for PNG signature
        if (dataView.byteLength < offset + 8) {
            throw new Error('Invalid PNG signature: file too small');
        }
        
        const signature = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, 8);
        for (let i = 0; i < 8; i++) {
            if (signature[i] !== this.PNG_SIGNATURE[i]) {
                throw new Error(`Invalid PNG signature at byte ${i}: expected ${this.PNG_SIGNATURE[i]}, got ${signature[i]}`);
            }
        }
        return true;
    }

    /**
     * Reads a PNG chunk header at the given offset
     * @param {DataView} dataView - DataView of the PNG data
     * @param {number} offset - Offset to read chunk header
     * @returns {Object} Chunk header with length, type, and data offset
     * @throws {Error} If chunk header is invalid or truncated
     */
    readChunkHeader(dataView, offset) {
        // Check if there's enough data for a chunk header (4 bytes length + 4 bytes type)
        if (dataView.byteLength < offset + 8) {
            throw new Error('Truncated PNG file: insufficient data for chunk header');
        }
        
        const length = dataView.getUint32(offset);
        const type = this.readChunkType(dataView, offset + 4);
        
        // Check if there's enough data for the chunk content and CRC
        const totalChunkSize = 8 + length + 4; // header + data + CRC
        if (dataView.byteLength < offset + totalChunkSize) {
            throw new Error('Truncated PNG file: insufficient data for chunk content');
        }
        
        return {
            length,
            type,
            dataOffset: offset + 8,
            crcOffset: offset + 8 + length
        };
    }

    /**
     * Reads a PNG chunk type (4 bytes) at the given offset
     * @param {DataView} dataView - DataView of the PNG data
     * @param {number} offset - Offset to read chunk type
     * @returns {string} Chunk type as string
     */
    readChunkType(dataView, offset) {
        return String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
    }

    /**
     * Extracts all chunks from PNG data
     * @param {DataView} dataView - DataView of the PNG data
     * @returns {Array} Array of chunk objects
     */
    extractChunks(dataView) {
        const chunks = [];
        let offset = 8; // Skip signature
        
        // Read chunks until IEND
        while (offset < dataView.byteLength) {
            const { length, type, dataOffset, crcOffset } = this.readChunkHeader(dataView, offset);
            
            // Validate chunk CRC
            this.validateChunkCRC(dataView, dataOffset, length, type);
            
            // Extract chunk data
            const chunkData = new Uint8Array(dataView.buffer, dataView.byteOffset + dataOffset, length);
            
            chunks.push({
                type,
                length,
                data: chunkData,
                dataOffset,
                crcOffset
            });
            
            // Move to next chunk (length + type + data + CRC)
            offset = crcOffset + 4;
            
            // Stop at IEND chunk
            if (type === 'IEND') {
                break;
            }
        }
        
        return chunks;
    }

    /**
     * Extracts metadata from chunks
     * @param {Array} chunks - Array of chunk objects
     * @returns {Object} Extracted metadata
     */
    extractMetadata(chunks) {
        const metadata = {};
        
        for (const chunk of chunks) {
            // Extract metadata from supported chunks
            if (this.METADATA_CHUNKS.includes(chunk.type)) {
                metadata[chunk.type] = this.parseMetadataChunk(chunk.data, chunk.type);
            }
            
            // Extract metadata from tEXt chunks
            if (chunk.type === 'tEXt') {
                const textMetadata = this.parseTextChunk(chunk.data);
                if (textMetadata) {
                    metadata[textMetadata.keyword] = textMetadata;
                }
            }
        }
        
        return metadata;
    }

    /**
     * Validate chunk CRC
     */
    validateChunkCRC(dataView, offset, length, type) {
        // Get the chunk data including type (4 bytes) and data (length bytes)
        const chunkData = new Uint8Array(dataView.buffer, offset - 4, length + 4); // Include type
        const expectedCRC = dataView.getUint32(offset + length, false);
        const calculatedCRC = this.calculateCRC(chunkData);
        
        if (calculatedCRC !== expectedCRC) {
            throw new Error(`CRC mismatch for chunk '${type}': expected ${expectedCRC}, calculated ${calculatedCRC}`);
        }
        return true;
    }

    /**
     * Extracts metadata from PNG buffer
     * @param {ArrayBuffer} arrayBuffer - PNG file data
     * @returns {Object} Extracted metadata
     * @throws {Error} If extraction fails
     */
    extractFromBuffer(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        
        // Validate PNG signature
        this.validateSignature(dataView);
        
        // Extract chunks
        const chunks = this.extractChunks(dataView);
        
        // Extract metadata from tEXt chunks
        const metadata = this.extractMetadata(chunks);
        
        return metadata;
    }

    /**
     * Extract metadata from PNG file
     * @param {File} file - PNG file object
     * @returns {Promise<Object|null>} Extracted metadata or null if not found
     */
    async extract(file) {
        if (!(file instanceof File)) {
            throw new Error('Input must be a File object');
        }

        const arrayBuffer = await file.arrayBuffer();
        return this.extractFromBuffer(arrayBuffer);
    }

    /**
     * Parse metadata chunk content
     */
    parseMetadataChunk(chunkData, type) {
        try {
            // Convert to string and parse as JSON
            const text = new TextDecoder().decode(chunkData);
            const data = JSON.parse(text);
            
            return {
                type,
                data,
                size: chunkData.length,
                format: this.detectFormat(data)
            };
            
        } catch (error) {
            throw new Error(`Failed to parse ${type} chunk: ${error.message}`);
        }
    }

    /**
     * Parse tEXt chunk content
     */
    parseTextChunk(chunkData) {
        try {
            const text = new TextDecoder().decode(chunkData);
            
            // tEXt chunks have format: keyword\0text
            const nullIndex = text.indexOf('\0');
            if (nullIndex === -1) {
                return null;
            }
            
            const keyword = text.substring(0, nullIndex);
            const content = text.substring(nullIndex + 1);
            
            // Only process supported keywords
            if (!this.TEXT_KEYWORDS.includes(keyword)) {
                return null;
            }
            
            // Try to decode as base64 first, then as JSON
            let data;
            try {
                // Try base64 decode first (Node.js compatible)
                const decoded = Buffer.from(content, 'base64').toString('utf-8');
                data = JSON.parse(decoded);
            } catch (error) {
                // If base64 decode fails, try parsing content directly as JSON
                try {
                    data = JSON.parse(content);
                } catch (jsonError) {
                    // If both fail, return null
                    return null;
                }
            }
            
            // Determine format based on spec field
            const format = this.detectFormat(data);
            
            return {
                type: 'tEXt',
                keyword,
                data,
                size: chunkData.length,
                format,
                encoding: 'base64'
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Detect character card format
     */
    detectFormat(data) {
        if (data.spec && data.spec === 'https://character-card.invalid') {
            return 'v2';
        } else if (data.spec && data.spec === 'https://character-card.invalid/v3') {
            return 'v3';
        } else if (data.name && data.description) {
            return 'v1';
        } else {
            return 'unknown';
        }
    }

    /**
     * Get chunk information for debugging
     */
    getChunkInfo(arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        const chunks = [];
        let offset = 8; // Skip signature
        
        try {
            while (offset < dataView.byteLength) {
                const { length, type, dataOffset } = this.readChunkHeader(dataView, offset);
                
                chunks.push({
                    type,
                    length,
                    offset: dataOffset,
                    hasCRC: offset + length + 8 <= dataView.byteLength
                });
                
                offset = dataOffset + length + 4;
                
                if (type === 'IEND') {
                    break;
                }
            }
        } catch (error) {
            // Return partial info on error
        }
        
        return chunks;
    }

    /**
     * Validates a PNG file
     * @param {ArrayBuffer|File} input - PNG file data or File object
     * @returns {boolean} True if valid PNG file
     * @throws {Error} If validation fails
     */
    validateFile(input) {
        try {
            let arrayBuffer;
            
            if (input instanceof File) {
                // For File objects, we need to read the buffer
                // This is a simplified validation - in practice you'd use async/await
                throw new Error('File validation requires async operation. Use validateFileAsync() for File objects.');
            } else if (input instanceof ArrayBuffer) {
                arrayBuffer = input;
            } else {
                throw new Error('Input must be ArrayBuffer or File object');
            }
            
            const dataView = new DataView(arrayBuffer);
            
            // Validate PNG signature
            this.validateSignature(dataView);
            
            // Basic structure validation - check for at least one chunk
            if (arrayBuffer.byteLength < 16) {
                throw new Error('File too small to be valid PNG');
            }
            
            return true;
            
        } catch (error) {
            throw new Error(`File validation failed: ${error.message}`);
        }
    }

    /**
     * Validates a PNG file asynchronously
     * @param {File} file - PNG file object
     * @returns {Promise<boolean>} True if valid PNG file
     * @throws {Error} If validation fails
     */
    async validateFileAsync(file) {
        if (!(file instanceof File)) {
            throw new Error('Input must be a File object');
        }
        
        const arrayBuffer = await file.arrayBuffer();
        return this.validateFile(arrayBuffer);
    }
}

module.exports = PNGMetadataExtractor; 