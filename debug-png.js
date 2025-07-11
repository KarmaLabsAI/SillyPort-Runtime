const PNGMetadataExtractor = require('./src/character/PNGMetadataExtractor');
const fs = require('fs');
const path = require('path');

const extractor = new PNGMetadataExtractor();
const testPngPath = path.join(__dirname, 'test-data/characters/default_Seraphina.png');
const testPngBuffer = fs.readFileSync(testPngPath);

console.log('File size:', testPngBuffer.length);
console.log('First 16 bytes:', Array.from(testPngBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Test signature validation
const dataView = new DataView(testPngBuffer.buffer);
try {
    extractor.validateSignature(dataView);
    console.log('✓ PNG signature valid');
} catch (error) {
    console.log('✗ PNG signature invalid:', error.message);
}

// Test chunk info
try {
    const chunks = extractor.getChunkInfo(testPngBuffer.buffer);
    console.log('Chunks found:', chunks.length);
    chunks.forEach((chunk, i) => {
        console.log(`  ${i}: ${chunk.type} (${chunk.length} bytes)`);
    });
    
    // Examine tEXt chunks
    let offset = 8; // Skip signature
    for (let i = 0; i < chunks.length; i++) {
        const { length, type, dataOffset } = extractor.readChunkHeader(dataView, offset);
        
        if (type === 'tEXt') {
            console.log(`\nExamining tEXt chunk ${i}:`);
            const chunkData = new Uint8Array(dataView.buffer, dataOffset, length);
            const text = new TextDecoder().decode(chunkData);
            
            // tEXt chunks have format: keyword\0text
            const nullIndex = text.indexOf('\0');
            if (nullIndex !== -1) {
                const keyword = text.substring(0, nullIndex);
                const content = text.substring(nullIndex + 1);
                console.log(`  Keyword: ${keyword}`);
                console.log(`  Content length: ${content.length}`);
                console.log(`  Content preview: ${content.substring(0, 100)}...`);
                
                // Try to parse as JSON if it looks like character data
                if (keyword === 'chara' || content.includes('"name"')) {
                    try {
                        const jsonData = JSON.parse(content);
                        console.log(`  Parsed JSON: ${jsonData.name || 'Unknown'}`);
                    } catch (e) {
                        console.log(`  Not valid JSON: ${e.message}`);
                    }
                }
            }
        }
        
        offset = dataOffset + length + 4;
    }
    
} catch (error) {
    console.log('✗ Chunk info failed:', error.message);
}

// Test metadata extraction
try {
    const metadata = extractor.extractFromBuffer(testPngBuffer.buffer);
    console.log('\nMetadata extracted:', Object.keys(metadata));
    console.log('Full metadata structure:', JSON.stringify(metadata, null, 2));
    if (metadata.chara) {
        console.log('Character name:', metadata.chara.data.name);
        console.log('Format:', metadata.chara.format);
        console.log('Type:', metadata.chara.type);
    }
} catch (error) {
    console.log('✗ Metadata extraction failed:', error.message);
} 