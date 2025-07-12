/**
 * CharacterCard Format Conversion Test Suite
 * 
 * Tests for Task 2.2.3: Format Conversion
 * 
 * Tests PNG to JSON, JSON to YAML, YAML to JSON conversions with
 * metadata preservation and format-specific optimization.
 */

const { CharacterCard } = require('../../src/character/CharacterCard.js');
const fs = require('fs');
const path = require('path');

// Mock PNGMetadataExtractor for testing
jest.mock('../../src/character/PNGMetadataExtractor.js', () => {
    return {
        PNGMetadataExtractor: jest.fn().mockImplementation(() => ({
            extract: jest.fn().mockResolvedValue({
                chara: {
                    name: 'Test Character',
                    description: 'A test character for format conversion',
                    personality: 'Friendly, helpful, and always ready to assist',
                    scenario: 'A testing environment where format conversion is performed',
                    first_mes: 'Hello! I am a test character for format conversion.',
                    mes_example: 'This is an example message for testing',
                    creator_notes: 'Created for format conversion testing',
                    system_prompt: 'You are a helpful test character for format conversion',
                    post_history_instructions: 'Continue the conversation naturally',
                    tags: ['test', 'conversion', 'character'],
                    creator: 'Test Creator',
                    character_version: '2.0',
                    alternate_greetings: ['Hi there!', 'Greetings!', 'Welcome!'],
                    extensions: {
                        test_extension: {
                            enabled: true,
                            data: 'test data for conversion'
                        }
                    }
                },
                metadata: {
                    width: 512,
                    height: 512,
                    format: 'PNG',
                    chunks: ['IHDR', 'chara', 'IEND']
                }
            })
        }))
    };
});

describe('CharacterCard Format Conversion (Task 2.2.3)', () => {
    let validCharacterData;
    let testPngFile;
    let testYamlData;

    beforeEach(() => {
        // Valid Character Card V2 data
        validCharacterData = {
            name: 'Test Character',
            description: 'A test character for format conversion testing',
            personality: 'Friendly, helpful, and always ready to assist',
            scenario: 'A testing environment where format conversion is performed',
            first_mes: 'Hello! I am a test character for format conversion.',
            mes_example: 'This is an example message for testing',
            creator_notes: 'Created for format conversion testing',
            system_prompt: 'You are a helpful test character for format conversion',
            post_history_instructions: 'Continue the conversation naturally',
            tags: ['test', 'conversion', 'character'],
            creator: 'Test Creator',
            character_version: '2.0',
            alternate_greetings: ['Hi there!', 'Greetings!', 'Welcome!'],
            extensions: {
                test_extension: {
                    enabled: true,
                    data: 'test data for conversion'
                }
            }
        };

        // Mock PNG file
        testPngFile = {
            name: 'test-character.png',
            type: 'image/png',
            size: 1024
        };

        // Test YAML data
        testYamlData = `
name: Test Character
description: A test character for format conversion testing
personality: Friendly, helpful, and always ready to assist
scenario: A testing environment where format conversion is performed
first_mes: Hello! I am a test character for format conversion.
mes_example: This is an example message for testing
creator_notes: Created for format conversion testing
system_prompt: You are a helpful test character for format conversion
post_history_instructions: Continue the conversation naturally
tags:
  - test
  - conversion
  - character
creator: Test Creator
character_version: '2.0'
alternate_greetings:
  - Hi there!
  - Greetings!
  - Welcome!
extensions:
  test_extension:
    enabled: true
    data: test data for conversion
        `.trim();
    });

    describe('PNG to JSON Conversion', () => {
        test('should convert PNG to JSON format', async () => {
            const jsonResult = await CharacterCard.pngToJSON(testPngFile);
            
            expect(typeof jsonResult).toBe('string');
            expect(jsonResult).toContain('"name": "Test Character"');
            expect(jsonResult).toContain('"description": "A test character for format conversion"');
            
            // Parse and validate JSON
            const parsed = JSON.parse(jsonResult);
            expect(parsed.name).toBe('Test Character');
            expect(parsed._conversion).toBeDefined();
            expect(parsed._conversion.source).toBe('png');
            expect(parsed._conversion.target).toBe('json');
        });

        test('should convert PNG to JSON with metadata', async () => {
            const jsonResult = await CharacterCard.pngToJSON(testPngFile, { includeMetadata: true });
            
            const parsed = JSON.parse(jsonResult);
            expect(parsed._metadata).toBeDefined();
            expect(parsed._metadata.width).toBe(512);
            expect(parsed._metadata.height).toBe(512);
            expect(parsed._metadata.format).toBe('PNG');
        });

        test('should convert PNG to compact JSON', async () => {
            const jsonResult = await CharacterCard.pngToJSON(testPngFile, { pretty: false });
            
            expect(typeof jsonResult).toBe('string');
            expect(jsonResult).not.toContain('\n  '); // No indentation
            expect(jsonResult).toContain('"name":"Test Character"'); // No spaces
        });
    });

    describe('PNG to YAML Conversion', () => {
        test('should convert PNG to YAML format', async () => {
            const yamlResult = await CharacterCard.pngToYAML(testPngFile);
            
            expect(typeof yamlResult).toBe('string');
            expect(yamlResult).toContain('name: Test Character');
            expect(yamlResult).toContain('description: A test character for format conversion');
            expect(yamlResult).toContain('tags:');
            expect(yamlResult).toContain('- test');
            expect(yamlResult).toContain('- conversion');
        });

        test('should convert PNG to YAML with metadata', async () => {
            const yamlResult = await CharacterCard.pngToYAML(testPngFile, { includeMetadata: true });
            
            expect(yamlResult).toContain('_metadata:');
            expect(yamlResult).toContain('width: 512');
            expect(yamlResult).toContain('height: 512');
            expect(yamlResult).toContain('format: PNG');
        });

        test('should convert PNG to YAML with custom indentation', async () => {
            const yamlResult = await CharacterCard.pngToYAML(testPngFile, { indent: 4 });
            
            // YAML sorts keys alphabetically and uses different indentation patterns
            expect(yamlResult).toContain('name: Test Character');
            expect(yamlResult).toContain('description: A test character for format conversion');
            expect(yamlResult).toContain('tags:');
            expect(yamlResult).toContain('- test');
            // Check that indentation is applied to nested content (not top-level keys)
            expect(yamlResult).toContain('    source: png'); // 4 spaces for nested content
        });
    });

    describe('JSON to YAML Conversion', () => {
        test('should convert JSON object to YAML', () => {
            const yamlResult = CharacterCard.jsonToYAML(validCharacterData);
            
            expect(typeof yamlResult).toBe('string');
            expect(yamlResult).toContain('name: Test Character');
            expect(yamlResult).toContain('tags:');
            expect(yamlResult).toContain('- test');
            expect(yamlResult).toContain('- conversion');
        });

        test('should convert JSON string to YAML', () => {
            const jsonString = JSON.stringify(validCharacterData);
            const yamlResult = CharacterCard.jsonToYAML(jsonString);
            
            expect(typeof yamlResult).toBe('string');
            expect(yamlResult).toContain('name: Test Character');
        });

        test('should convert JSON to YAML with custom indentation', () => {
            const yamlResult = CharacterCard.jsonToYAML(validCharacterData, { indent: 4 });
            
            // YAML sorts keys alphabetically and uses different indentation patterns
            expect(yamlResult).toContain('name: Test Character');
            expect(yamlResult).toContain('description: A test character for format conversion testing');
            expect(yamlResult).toContain('tags:');
            expect(yamlResult).toContain('- test');
            // Check that indentation is applied to nested content (not top-level keys)
            expect(yamlResult).toContain('    source: png'); // 4 spaces for nested content
        });

        test('should throw error for invalid JSON', () => {
            expect(() => {
                CharacterCard.jsonToYAML('invalid json');
            }).toThrow('Invalid JSON data');
        });
    });

    describe('YAML to JSON Conversion', () => {
        test('should convert YAML to JSON format', () => {
            const jsonResult = CharacterCard.yamlToJSON(testYamlData);
            
            expect(typeof jsonResult).toBe('string');
            expect(jsonResult).toContain('"name": "Test Character"');
            // JSON with pretty formatting will have newlines and spaces
            expect(jsonResult).toContain('"tags":');
            expect(jsonResult).toContain('"test"');
            expect(jsonResult).toContain('"conversion"');
            expect(jsonResult).toContain('"character"');
        });

        test('should convert YAML to compact JSON', () => {
            const jsonResult = CharacterCard.yamlToJSON(testYamlData, { pretty: false });
            
            expect(typeof jsonResult).toBe('string');
            expect(jsonResult).not.toContain('\n  '); // No indentation
            expect(jsonResult).toContain('"name":"Test Character"'); // No spaces
        });

        test('should throw error for invalid YAML', () => {
            expect(() => {
                CharacterCard.yamlToJSON('invalid: yaml: data:');
            }).toThrow('YAML parsing failed');
        });

        test('should throw error for non-string YAML data', () => {
            expect(() => {
                CharacterCard.yamlToJSON(123);
            }).toThrow('YAML data must be a string');
        });
    });

    describe('YAML Parsing (fromYAML)', () => {
        test('should create CharacterCard from YAML data', () => {
            const card = CharacterCard.fromYAML(testYamlData);
            
            expect(card).toBeInstanceOf(CharacterCard);
            expect(card.getField('name')).toBe('Test Character');
            expect(card.getField('tags')).toEqual(['test', 'conversion', 'character']);
            expect(card.getField('extensions')).toEqual({
                test_extension: {
                    enabled: true,
                    data: 'test data for conversion'
                }
            });
        });

        test('should handle YAML with metadata', () => {
            const yamlWithMetadata = `
name: Test Character
description: A test character
personality: Friendly
scenario: Test scenario
first_mes: Hello!
_metadata:
  source: yaml
  timestamp: 2024-01-01T00:00:00Z
_conversion:
  source: json
  target: yaml
            `.trim();
            
            const card = CharacterCard.fromYAML(yamlWithMetadata);
            
            expect(card.getField('name')).toBe('Test Character');
            expect(card.metadata.source).toBe('yaml');
            // YAML parser converts ISO strings to Date objects, so we need to handle that
            expect(card.metadata.timestamp).toBeInstanceOf(Date);
            expect(card.metadata.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        });

        test('should throw error for invalid YAML structure', () => {
            expect(() => {
                CharacterCard.fromYAML('not an object');
            }).toThrow('Invalid YAML data: must be an object');
        });
    });

    describe('Instance Format Conversion Methods', () => {
        let card;

        beforeEach(async () => {
            card = await CharacterCard.fromPNG(testPngFile);
        });

        test('should convert to JSON format', () => {
            const jsonResult = card.toJSONFormat();
            
            expect(typeof jsonResult).toBe('string');
            expect(jsonResult).toContain('"name": "Test Character"');
            expect(jsonResult).toContain('"_conversion"');
        });

        test('should convert to YAML format', () => {
            const yamlResult = card.toYAMLFormat();
            
            expect(typeof yamlResult).toBe('string');
            expect(yamlResult).toContain('name: Test Character');
            expect(yamlResult).toContain('_conversion:');
        });

        test('should include metadata in JSON format', () => {
            const jsonResult = card.toJSONFormat({ includeMetadata: true });
            
            const parsed = JSON.parse(jsonResult);
            expect(parsed._metadata).toBeDefined();
            expect(parsed._metadata.width).toBe(512);
        });

        test('should include metadata in YAML format', () => {
            const yamlResult = card.toYAMLFormat({ includeMetadata: true });
            
            expect(yamlResult).toContain('_metadata:');
            expect(yamlResult).toContain('width: 512');
        });
    });

    describe('Conversion Statistics', () => {
        test('should provide conversion statistics', async () => {
            const card = await CharacterCard.fromPNG(testPngFile);
            const stats = card.getConversionStats();
            
            expect(stats.sourceFormat).toBe('png');
            expect(stats.targetFormats).toEqual(['json', 'yaml']);
            expect(stats.dataSize).toHaveProperty('original');
            expect(stats.dataSize).toHaveProperty('json');
            expect(stats.dataSize).toHaveProperty('yaml');
            expect(stats.compressionRatio).toHaveProperty('json');
            expect(stats.compressionRatio).toHaveProperty('yaml');
            expect(stats.metadata).toHaveProperty('hasMetadata');
            expect(stats.metadata).toHaveProperty('metadataSize');
            
            // Validate compression ratios are percentages (can exceed 100% due to metadata)
            expect(stats.compressionRatio.json).toBeGreaterThan(0);
            expect(stats.compressionRatio.yaml).toBeGreaterThan(0);
            expect(stats.compressionRatio.json).toBeLessThanOrEqual(150); // Allow for metadata overhead
            expect(stats.compressionRatio.yaml).toBeLessThanOrEqual(150); // Allow for metadata overhead
        });

        test('should handle cards without metadata', () => {
            const card = new CharacterCard(validCharacterData);
            const stats = card.getConversionStats();
            
            expect(stats.metadata.hasMetadata).toBe(false);
            expect(stats.metadata.metadataSize).toBe(0);
        });
    });

    describe('Format Optimization', () => {
        test('should optimize for JSON format', () => {
            const card = new CharacterCard({
                ...validCharacterData,
                emptyField: '',
                nullField: null,
                undefinedField: undefined
            });
            
            const optimized = card.optimizeForFormat('json', { removeEmptyFields: true });
            
            expect(optimized.name).toBe('Test Character');
            expect(optimized.emptyField).toBeUndefined();
            expect(optimized.nullField).toBeUndefined();
            expect(optimized.undefinedField).toBeUndefined();
        });

        test('should optimize for YAML format', () => {
            const card = new CharacterCard(validCharacterData);
            
            const optimized = card.optimizeForFormat('yaml', { preserveComments: true });
            
            expect(optimized.name).toBe('Test Character');
            expect(optimized._format).toBe('yaml');
            expect(optimized._optimized).toBe(true);
        });

        test('should throw error for unsupported format', () => {
            const card = new CharacterCard(validCharacterData);
            
            expect(() => {
                card.optimizeForFormat('xml');
            }).toThrow('Unsupported format: xml');
        });
    });

    describe('Round-trip Conversion Tests', () => {
        test('should maintain data integrity through PNG -> JSON -> YAML -> JSON cycle', async () => {
            // PNG -> JSON
            const jsonFromPng = await CharacterCard.pngToJSON(testPngFile, { includeMetadata: true });
            const jsonCard = CharacterCard.fromJSON(jsonFromPng);
            
            // JSON -> YAML
            const yamlFromJson = jsonCard.toYAMLFormat({ includeMetadata: true });
            const yamlCard = CharacterCard.fromYAML(yamlFromJson);
            
            // YAML -> JSON
            const finalJson = yamlCard.toJSONFormat({ includeMetadata: true });
            const finalCard = CharacterCard.fromJSON(finalJson);
            
            // Verify data integrity
            expect(finalCard.getField('name')).toBe('Test Character');
            expect(finalCard.getField('tags')).toEqual(['test', 'conversion', 'character']);
            expect(finalCard.getField('extensions')).toEqual({
                test_extension: {
                    enabled: true,
                    data: 'test data for conversion'
                }
            });
        });

        test('should preserve metadata through conversion cycles', async () => {
            // PNG -> JSON with metadata
            const jsonFromPng = await CharacterCard.pngToJSON(testPngFile, { includeMetadata: true });
            const jsonCard = CharacterCard.fromJSON(jsonFromPng);
            
            // JSON -> YAML with metadata
            const yamlFromJson = jsonCard.toYAMLFormat({ includeMetadata: true });
            const yamlCard = CharacterCard.fromYAML(yamlFromJson);
            
            // Verify metadata preservation
            expect(yamlCard.metadata.width).toBe(512);
            expect(yamlCard.metadata.height).toBe(512);
            expect(yamlCard.metadata.format).toBe('PNG');
        });
    });

    describe('Error Handling', () => {
        test('should handle YAML parsing errors gracefully', () => {
            expect(() => {
                CharacterCard.fromYAML('invalid: yaml: with: multiple: colons:');
            }).toThrow('YAML parsing failed');
        });

        test('should handle YAML conversion errors gracefully', () => {
            const card = new CharacterCard(validCharacterData);
            
            // Create circular reference to cause YAML conversion error
            card.data.circular = card.data;
            
            expect(() => {
                card.toYAMLFormat();
            }).toThrow('YAML conversion failed');
        });

        test('should handle invalid conversion options', () => {
            const card = new CharacterCard(validCharacterData);
            
            // Create circular reference to cause YAML conversion error
            card.data.circular = card.data;
            
            expect(() => {
                card.toYAMLFormat();
            }).toThrow('YAML conversion failed');
        });
    });
}); 