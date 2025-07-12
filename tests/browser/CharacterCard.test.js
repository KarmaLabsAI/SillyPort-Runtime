/**
 * CharacterCard Test Suite
 * 
 * Tests for Task 2.2.2: Character Card Validation
 * 
 * Tests schema validation, required field checking, data type validation,
 * size limit enforcement, and security validation for Character Card V2 format.
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
                    description: 'A test character',
                    personality: 'Friendly and helpful',
                    scenario: 'A test scenario',
                    first_mes: 'Hello!'
                }
            })
        }))
    };
});

describe('CharacterCard', () => {
    let validCharacterData;
    let testPngFile;

    beforeEach(() => {
        // Valid Character Card V2 data
        validCharacterData = {
            name: 'Test Character',
            description: 'A test character for validation testing',
            personality: 'Friendly, helpful, and always ready to assist',
            scenario: 'A testing environment where validation is performed',
            first_mes: 'Hello! I am a test character.',
            mes_example: 'This is an example message',
            creator_notes: 'Created for testing purposes',
            system_prompt: 'You are a helpful test character',
            post_history_instructions: 'Continue the conversation naturally',
            tags: ['test', 'validation', 'character'],
            creator: 'Test Creator',
            character_version: '2.0',
            alternate_greetings: ['Hi there!', 'Greetings!'],
            extensions: {
                test_extension: {
                    enabled: true,
                    data: 'test data'
                }
            }
        };

        // Mock PNG file
        testPngFile = {
            name: 'test-character.png',
            type: 'image/png',
            size: 1024
        };
    });

    describe('Constructor and Static Methods', () => {
        test('should create CharacterCard instance with data', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.data).toEqual(validCharacterData);
            expect(card.validationErrors).toEqual([]);
            expect(card.isValidated).toBe(false);
        });

        test('should create CharacterCard instance without data', () => {
            const card = new CharacterCard();
            expect(card.data).toBeNull();
            expect(card.validationErrors).toEqual([]);
            expect(card.isValidated).toBe(false);
        });

        test('should create CharacterCard from JSON object', () => {
            const card = CharacterCard.fromJSON(validCharacterData);
            expect(card.data).toEqual(validCharacterData);
        });

        test('should create CharacterCard from JSON string', () => {
            const jsonString = JSON.stringify(validCharacterData);
            const card = CharacterCard.fromJSON(jsonString);
            expect(card.data).toEqual(validCharacterData);
        });

        test('should throw error for invalid JSON string', () => {
            expect(() => {
                CharacterCard.fromJSON('invalid json');
            }).toThrow('Invalid JSON data');
        });

        test('should create CharacterCard from PNG file', async () => {
            const card = await CharacterCard.fromPNG(testPngFile);
            expect(card).toBeInstanceOf(CharacterCard);
            expect(card.data).toBeDefined();
            expect(card.metadata).toBeDefined();
        });
    });

    describe('Schema Validation', () => {
        test('should validate valid Character Card V2 data', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.validate()).toBe(true);
            expect(card.getValidationErrors()).toEqual([]);
        });

        test('should reject data without required fields', () => {
            const invalidData = {
                name: 'Test Character',
                // Missing required fields
            };
            const card = new CharacterCard(invalidData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Required field 'description' is missing or empty");
            expect(errors).toContain("Required field 'personality' is missing or empty");
            expect(errors).toContain("Required field 'scenario' is missing or empty");
            expect(errors).toContain("Required field 'first_mes' is missing or empty");
        });

        test('should reject data with empty required fields', () => {
            const invalidData = {
                name: 'Test Character',
                description: '',
                personality: '   ',
                scenario: null,
                first_mes: undefined
            };
            const card = new CharacterCard(invalidData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Required field 'description' is missing or empty");
            expect(errors).toContain("Required field 'personality' is missing or empty");
            expect(errors).toContain("Required field 'scenario' is missing or empty");
            expect(errors).toContain("Required field 'first_mes' is missing or empty");
        });
    });

    describe('Data Type Validation', () => {
        test('should validate correct field types', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.validate()).toBe(true);
        });

        test('should reject wrong field types', () => {
            const invalidData = {
                ...validCharacterData,
                name: 123, // Should be string
                tags: 'not an array', // Should be array
                extensions: 'not an object' // Should be object
            };
            const card = new CharacterCard(invalidData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'name' has invalid type. Expected string, got number");
            expect(errors).toContain("Field 'tags' has invalid type. Expected array, got string");
            expect(errors).toContain("Field 'extensions' has invalid type. Expected object, got string");
        });

        test('should validate array fields correctly', () => {
            const dataWithArrays = {
                ...validCharacterData,
                tags: ['tag1', 'tag2', 'tag3'],
                alternate_greetings: ['Hello', 'Hi', 'Greetings']
            };
            const card = new CharacterCard(dataWithArrays);
            expect(card.validate()).toBe(true);
        });

        test('should validate object fields correctly', () => {
            const dataWithObjects = {
                ...validCharacterData,
                extensions: {
                    feature1: { enabled: true },
                    feature2: { enabled: false }
                }
            };
            const card = new CharacterCard(dataWithObjects);
            expect(card.validate()).toBe(true);
        });
    });

    describe('Size Limit Validation', () => {
        test('should reject oversized total data', () => {
            // Create data that exceeds 1MB when serialized
            const oversizedData = {
                ...validCharacterData,
                description: 'x'.repeat(1024 * 1024) // 1MB string
            };
            const card = new CharacterCard(oversizedData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain('Character data exceeds maximum size of 1048576 bytes');
        });

        test('should reject oversized individual fields', () => {
            const oversizedData = {
                ...validCharacterData,
                description: 'x'.repeat(2500) // Exceeds 2000 character limit
            };
            const card = new CharacterCard(oversizedData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'description' exceeds maximum field size of 2000 characters");
        });

        test('should reject oversized arrays', () => {
            const oversizedData = {
                ...validCharacterData,
                tags: Array.from({ length: 60 }, (_, i) => `tag${i}`) // 60 tags, exceeds 50 limit
            };
            const card = new CharacterCard(oversizedData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'tags' exceeds maximum array length of 50 items");
        });
    });

    describe('Security Validation', () => {
        test('should reject data with script tags', () => {
            const maliciousData = {
                ...validCharacterData,
                description: 'Hello <script>alert("xss")</script> world'
            };
            const card = new CharacterCard(maliciousData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'description' contains potentially dangerous script tags");
        });

        test('should reject data with javascript protocol', () => {
            const maliciousData = {
                ...validCharacterData,
                first_mes: 'Click <a href="javascript:alert(\'xss\')">here</a>'
            };
            const card = new CharacterCard(maliciousData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'first_mes' contains javascript: protocol");
        });

        test('should reject data with data protocol', () => {
            const maliciousData = {
                ...validCharacterData,
                personality: 'Check this: data:text/html,<script>alert("xss")</script>'
            };
            const card = new CharacterCard(maliciousData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'personality' contains data: protocol");
        });

        test('should reject data with vbscript protocol', () => {
            const maliciousData = {
                ...validCharacterData,
                scenario: 'Try this: vbscript:msgbox("xss")'
            };
            const card = new CharacterCard(maliciousData);
            expect(card.validate()).toBe(false);
            
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'scenario' contains vbscript: protocol");
        });

        test('should accept safe HTML content', () => {
            const safeData = {
                ...validCharacterData,
                description: 'Hello <strong>world</strong> with <em>emphasis</em>'
            };
            const card = new CharacterCard(safeData);
            expect(card.validate()).toBe(true);
        });
    });

    describe('Unknown Fields Validation', () => {
        test('should warn about unknown fields but not fail validation', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const dataWithUnknownFields = {
                ...validCharacterData,
                unknown_field: 'some value',
                another_unknown: 123
            };
            const card = new CharacterCard(dataWithUnknownFields);
            expect(card.validate()).toBe(true);
            
            expect(consoleSpy).toHaveBeenCalledWith("Unknown field 'unknown_field' in character data");
            expect(consoleSpy).toHaveBeenCalledWith("Unknown field 'another_unknown' in character data");
            
            consoleSpy.mockRestore();
        });
    });

    describe('Field Access and Modification', () => {
        test('should get field values', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.getField('name')).toBe('Test Character');
            expect(card.getField('description')).toBe('A test character for validation testing');
        });

        test('should set valid field values', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.setField('name', 'New Name')).toBe(true);
            expect(card.getField('name')).toBe('New Name');
        });

        test('should reject invalid field types when setting', () => {
            const card = new CharacterCard(validCharacterData);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            expect(card.setField('name', 123)).toBe(false);
            expect(card.getField('name')).toBe('Test Character'); // Should not change
            
            expect(consoleSpy).toHaveBeenCalledWith("Invalid type for field 'name'. Expected string, got number");
            
            consoleSpy.mockRestore();
        });

        test('should reject oversized values when setting', () => {
            const card = new CharacterCard(validCharacterData);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            expect(card.setField('name', 'x'.repeat(150))).toBe(false);
            expect(card.getField('name')).toBe('Test Character'); // Should not change
            
            expect(consoleSpy).toHaveBeenCalledWith("Field 'name' exceeds maximum length of 100 characters");
            
            consoleSpy.mockRestore();
        });

        test('should warn about unknown fields when setting', () => {
            const card = new CharacterCard(validCharacterData);
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            expect(card.setField('unknown_field', 'value')).toBe(false);
            
            expect(consoleSpy).toHaveBeenCalledWith("Unknown field 'unknown_field'");
            
            consoleSpy.mockRestore();
        });
    });

    describe('Data Export and Sanitization', () => {
        test('should export to JSON', () => {
            const card = new CharacterCard(validCharacterData);
            const json = card.toJSON();
            const parsed = JSON.parse(json);
            expect(parsed).toEqual(validCharacterData);
        });

        test('should get character data copy', () => {
            const card = new CharacterCard(validCharacterData);
            const data = card.getData();
            expect(data).toEqual(validCharacterData);
            expect(data).not.toBe(validCharacterData); // Should be a copy
        });

        test('should get metadata copy', () => {
            const card = new CharacterCard(validCharacterData);
            card.metadata = { test: 'metadata' };
            const metadata = card.getMetadata();
            expect(metadata).toEqual({ test: 'metadata' });
            expect(metadata).not.toBe(card.metadata); // Should be a copy
        });

        test('should sanitize data for safe display', () => {
            const unsafeData = {
                ...validCharacterData,
                description: 'Hello <script>alert("xss")</script> world & more'
            };
            const card = new CharacterCard(unsafeData);
            const sanitized = card.sanitize();
            
            expect(sanitized.description).toBe('Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; world &amp; more');
            expect(sanitized.name).toBe('Test Character'); // Should remain unchanged
        });
    });

    describe('Validation State Management', () => {
        test('should reset validation state when data changes', () => {
            const card = new CharacterCard(validCharacterData);
            expect(card.validate()).toBe(true);
            expect(card.isValidated).toBe(true);
            
            card.setField('name', 'New Name');
            expect(card.isValidated).toBe(false);
            
            expect(card.isValid()).toBe(true); // Should re-validate automatically
            expect(card.isValidated).toBe(true);
        });

        test('should get validation errors', () => {
            const invalidData = {
                name: 'Test',
                // Missing required fields
            };
            const card = new CharacterCard(invalidData);
            
            const errors = card.getValidationErrors();
            expect(errors.length).toBeGreaterThan(0);
            expect(errors).toContain("Required field 'description' is missing or empty");
        });
    });

    describe('Emotion Sprite Loading', () => {
        test('should load emotion sprite (placeholder)', async () => {
            const spriteFile = {
                name: 'happy.png',
                type: 'image/png',
                size: 512
            };
            
            const sprite = await CharacterCard.loadEmotionSprite(spriteFile);
            expect(sprite).toEqual({
                name: 'happy.png',
                type: 'image/png',
                size: 512,
                timestamp: expect.any(Number)
            });
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete valid character workflow', () => {
            const card = new CharacterCard(validCharacterData);
            
            // Validate
            expect(card.validate()).toBe(true);
            expect(card.isValid()).toBe(true);
            
            // Access data
            expect(card.getField('name')).toBe('Test Character');
            
            // Modify data
            expect(card.setField('name', 'Updated Name')).toBe(true);
            expect(card.getField('name')).toBe('Updated Name');
            
            // Export
            const json = card.toJSON();
            const parsed = JSON.parse(json);
            expect(parsed.name).toBe('Updated Name');
            
            // Sanitize
            const sanitized = card.sanitize();
            expect(sanitized.name).toBe('Updated Name');
        });

        test('should handle invalid character workflow', () => {
            const invalidData = {
                name: 123, // Wrong type
                description: 'x'.repeat(2500), // Too long
                personality: 'Safe content',
                scenario: 'Safe content',
                first_mes: 'Safe content'
            };
            
            const card = new CharacterCard(invalidData);
            
            // Should fail validation
            expect(card.validate()).toBe(false);
            expect(card.isValid()).toBe(false);
            
            // Should have multiple errors
            const errors = card.getValidationErrors();
            expect(errors).toContain("Field 'name' has invalid type. Expected string, got number");
            expect(errors).toContain("Field 'description' exceeds maximum field size of 2000 characters");
            
            // Should still allow data access
            expect(card.getField('name')).toBe(123);
            
            // Should reject invalid modifications
            expect(card.setField('name', 'Valid Name')).toBe(true);
            expect(card.getField('name')).toBe('Valid Name');
        });
    });
}); 