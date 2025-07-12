/**
 * Character Metadata Tests
 * 
 * Tests for CharacterMetadata class functionality including:
 * - Metadata extraction from character cards
 * - Tag management and categorization
 * - Creator information handling
 * - Version tracking
 * - Extension data support
 * - Statistics and rating management
 * 
 * Task 2.3.2: Character Metadata
 */

const { CharacterMetadata } = require('../../src/character/CharacterMetadata.js');
const { CharacterCard } = require('../../src/character/CharacterCard.js');
const fs = require('fs');
const path = require('path');

describe('CharacterMetadata', () => {
    let testCharacterData;
    let testCharacterCard;
    let metadata;

    beforeEach(() => {
        // Create test character data
        testCharacterData = {
            id: 'test_character_123',
            name: 'Test Character',
            description: 'A test character for metadata testing',
            personality: 'Intelligent, kind, and brave. Loves adventure and helping others.',
            scenario: 'A fantasy world with magic and dragons. The character is on a quest.',
            first_mes: 'Hello! I am Test Character, ready for adventure!',
            creator: 'Test Creator',
            character_version: '2.0',
            tags: ['protagonist', 'hero', 'fantasy', 'adventure', 'intelligent', 'kind'],
            extensions: {
                custom_extension: {
                    data: 'test data',
                    version: '1.0'
                }
            }
        };

        testCharacterCard = new CharacterCard(testCharacterData);
        metadata = new CharacterMetadata(testCharacterCard);
    });

    describe('Constructor and Initialization', () => {
        test('should create metadata instance with character card', () => {
            expect(metadata).toBeInstanceOf(CharacterMetadata);
            expect(metadata.characterCard).toBe(testCharacterCard);
        });

        test('should create metadata instance without character card', () => {
            const emptyMetadata = new CharacterMetadata();
            expect(emptyMetadata).toBeInstanceOf(CharacterMetadata);
            expect(emptyMetadata.characterCard).toBeNull();
        });

        test('should have event bus initialized', () => {
            expect(metadata.eventBus).toBeDefined();
            expect(typeof metadata.eventBus.subscribe).toBe('function');
            expect(typeof metadata.eventBus.emit).toBe('function');
        });
    });

    describe('Metadata Extraction', () => {
        test('should extract basic metadata from character card', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.id).toBe('test_character_123');
            expect(extractedMetadata.name).toBe('Test Character');
            expect(extractedMetadata.version).toBe('2.0');
            expect(extractedMetadata.created).toBeDefined();
            expect(extractedMetadata.modified).toBeDefined();
        });

        test('should extract creator information', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.creator.name).toBe('Test Creator');
            expect(extractedMetadata.creator.contact).toBeNull();
            expect(extractedMetadata.creator.website).toBeNull();
        });

        test('should categorize tags properly', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.tags.categories).toContain('protagonist');
            expect(extractedMetadata.tags.categories).toContain('hero');
            expect(extractedMetadata.tags.themes).toContain('fantasy');
            expect(extractedMetadata.tags.themes).toContain('adventure');
            expect(extractedMetadata.tags.traits).toContain('intelligent');
            expect(extractedMetadata.tags.traits).toContain('kind');
        });

        test('should extract implicit tags from personality', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            // Should extract 'intelligent' and 'kind' from personality text
            expect(extractedMetadata.tags.traits).toContain('intelligent');
            expect(extractedMetadata.tags.traits).toContain('kind');
        });

        test('should extract implicit tags from scenario', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            // Should extract 'fantasy' and 'adventure' from scenario text
            expect(extractedMetadata.tags.themes).toContain('fantasy');
            expect(extractedMetadata.tags.themes).toContain('adventure');
        });

        test('should handle extension data', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.extensions.custom_extension).toBeDefined();
            expect(extractedMetadata.extensions.custom_extension.data).toBe('test data');
        });

        test('should update version history', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.versions).toHaveLength(1);
            expect(extractedMetadata.versions[0].version).toBe('2.0');
            expect(extractedMetadata.versions[0].timestamp).toBeDefined();
        });

        test('should update statistics', () => {
            const extractedMetadata = metadata.extractFromCharacterCard(testCharacterCard);
            
            expect(extractedMetadata.stats.loadCount).toBe(1);
            expect(extractedMetadata.stats.lastAccessed).toBeDefined();
            expect(extractedMetadata.stats.favoriteCount).toBe(0);
            expect(extractedMetadata.stats.rating).toBeNull();
        });

        test('should emit extraction event', (done) => {
            metadata.subscribe('metadata:extracted', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.metadata).toBeDefined();
                done();
            });

            metadata.extractFromCharacterCard(testCharacterCard);
        });
    });

    describe('Tag Management', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should add tag to correct category', () => {
            const result = metadata.addTag('mysterious', 'traits');
            expect(result).toBe(true);
            
            const tags = metadata.getTagsByCategory('traits');
            expect(tags).toContain('mysterious');
        });

        test('should auto-categorize tags when category not specified', () => {
            const result = metadata.addTag('patient');
            expect(result).toBe(true);
            
            const tags = metadata.getTagsByCategory('traits');
            expect(tags).toContain('patient');
        });

        test('should not add duplicate tags', () => {
            metadata.addTag('mysterious', 'traits');
            const result = metadata.addTag('mysterious', 'traits');
            expect(result).toBe(false);
        });

        test('should remove tag from category', () => {
            metadata.addTag('mysterious', 'traits');
            const result = metadata.removeTag('mysterious', 'traits');
            expect(result).toBe(true);
            
            const tags = metadata.getTagsByCategory('traits');
            expect(tags).not.toContain('mysterious');
        });

        test('should remove tag from any category when category not specified', () => {
            metadata.addTag('mysterious', 'traits');
            const result = metadata.removeTag('mysterious');
            expect(result).toBe(true);
            
            const tags = metadata.getTagsByCategory('traits');
            expect(tags).not.toContain('mysterious');
        });

        test('should return false when removing non-existent tag', () => {
            const result = metadata.removeTag('non-existent');
            expect(result).toBe(false);
        });

        test('should get all tags organized by category', () => {
            metadata.addTag('mysterious', 'traits');
            metadata.addTag('scifi', 'themes');
            
            const allTags = metadata.getAllTags();
            
            expect(allTags.traits).toContain('intelligent');
            expect(allTags.traits).toContain('kind');
            expect(allTags.traits).toContain('mysterious');
            expect(allTags.themes).toContain('fantasy');
            expect(allTags.themes).toContain('adventure');
            expect(allTags.themes).toContain('scifi');
        });

        test('should search tags across all categories', () => {
            metadata.addTag('mysterious', 'traits');
            metadata.addTag('mystery', 'themes');
            
            const results = metadata.searchTags('myst');
            
            expect(results).toHaveLength(2);
            expect(results.some(r => r.tag === 'mysterious' && r.category === 'traits')).toBe(true);
            expect(results.some(r => r.tag === 'mystery' && r.category === 'themes')).toBe(true);
        });

        test('should emit tag added event', (done) => {
            metadata.subscribe('metadata:tagAdded', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.tag).toBe('mysterious');
                expect(data.category).toBe('traits');
                done();
            });

            metadata.addTag('mysterious', 'traits');
        });

        test('should emit tag removed event', (done) => {
            metadata.addTag('mysterious', 'traits');
            
            metadata.subscribe('metadata:tagRemoved', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.tag).toBe('mysterious');
                done();
            });

            metadata.removeTag('mysterious', 'traits');
        });
    });

    describe('Creator Information', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should set creator information', () => {
            const creatorInfo = {
                name: 'New Creator',
                contact: 'creator@example.com',
                website: 'https://example.com'
            };

            const result = metadata.setCreatorInfo(creatorInfo);
            expect(result).toBe(true);

            const retrievedInfo = metadata.getCreatorInfo();
            expect(retrievedInfo.name).toBe('New Creator');
            expect(retrievedInfo.contact).toBe('creator@example.com');
            expect(retrievedInfo.website).toBe('https://example.com');
        });

        test('should update existing creator information', () => {
            const creatorInfo = {
                name: 'Updated Creator',
                contact: 'updated@example.com'
            };

            metadata.setCreatorInfo(creatorInfo);
            const retrievedInfo = metadata.getCreatorInfo();
            
            expect(retrievedInfo.name).toBe('Updated Creator');
            expect(retrievedInfo.contact).toBe('updated@example.com');
            expect(retrievedInfo.website).toBeNull(); // Should preserve existing null value
        });

        test('should return false for invalid creator info', () => {
            const result = metadata.setCreatorInfo(null);
            expect(result).toBe(false);
        });

        test('should emit creator updated event', (done) => {
            metadata.subscribe('metadata:creatorUpdated', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.creator.name).toBe('New Creator');
                done();
            });

            metadata.setCreatorInfo({ name: 'New Creator' });
        });
    });

    describe('Extension Data', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should add extension data', () => {
            const extensionData = {
                feature: 'test feature',
                enabled: true,
                config: { setting: 'value' }
            };

            const result = metadata.addExtensionData('test_extension', extensionData);
            expect(result).toBe(true);

            const retrievedData = metadata.getExtensionData('test_extension');
            expect(retrievedData.feature).toBe('test feature');
            expect(retrievedData.enabled).toBe(true);
            expect(retrievedData.config.setting).toBe('value');
            expect(retrievedData.lastModified).toBeDefined();
        });

        test('should update existing extension data', () => {
            metadata.addExtensionData('test_extension', { feature: 'old' });
            
            const updateData = { feature: 'new', enabled: true };
            metadata.addExtensionData('test_extension', updateData);

            const retrievedData = metadata.getExtensionData('test_extension');
            expect(retrievedData.feature).toBe('new');
            expect(retrievedData.enabled).toBe(true);
        });

        test('should return null for non-existent extension', () => {
            const data = metadata.getExtensionData('non_existent');
            expect(data).toBeNull();
        });

        test('should get all extension data', () => {
            metadata.addExtensionData('ext1', { data: 'value1' });
            metadata.addExtensionData('ext2', { data: 'value2' });

            const allExtensions = metadata.getAllExtensionData();
            
            expect(allExtensions.ext1.data).toBe('value1');
            expect(allExtensions.ext2.data).toBe('value2');
            expect(allExtensions.custom_extension.data).toBe('test data');
        });

        test('should return false for invalid extension name', () => {
            const result = metadata.addExtensionData(null, { data: 'test' });
            expect(result).toBe(false);
        });

        test('should emit extension added event', (done) => {
            metadata.subscribe('metadata:extensionAdded', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.extension).toBe('test_extension');
                expect(data.data.feature).toBe('test');
                done();
            });

            metadata.addExtensionData('test_extension', { feature: 'test' });
        });
    });

    describe('Rating and Statistics', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should set character rating', () => {
            const result = metadata.setRating(5);
            expect(result).toBe(true);

            const stats = metadata.getStats();
            expect(stats.rating).toBe(5);
        });

        test('should reject invalid ratings', () => {
            expect(metadata.setRating(0)).toBe(false);
            expect(metadata.setRating(6)).toBe(false);
            expect(metadata.setRating('5')).toBe(false);
            expect(metadata.setRating(null)).toBe(false);
        });

        test('should increment favorite count', () => {
            metadata.incrementFavoriteCount();
            metadata.incrementFavoriteCount();

            const stats = metadata.getStats();
            expect(stats.favoriteCount).toBe(2);
        });

        test('should update statistics on access', () => {
            const initialStats = metadata.getStats();
            const initialLoadCount = initialStats.loadCount;

            metadata.updateStats();

            const updatedStats = metadata.getStats();
            expect(updatedStats.loadCount).toBe(initialLoadCount + 1);
            expect(updatedStats.lastAccessed).toBeDefined();
        });

        test('should emit rating updated event', (done) => {
            metadata.subscribe('metadata:ratingUpdated', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.rating).toBe(4);
                done();
            });

            metadata.setRating(4);
        });

        test('should emit favorited event', (done) => {
            metadata.subscribe('metadata:favorited', (data) => {
                expect(data.characterId).toBe('test_character_123');
                expect(data.favoriteCount).toBe(1);
                done();
            });

            metadata.incrementFavoriteCount();
        });
    });

    describe('Version History', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should track version history', () => {
            metadata.updateVersionHistory('2.1');
            metadata.updateVersionHistory('2.2');

            const history = metadata.getVersionHistory();
            expect(history).toHaveLength(3); // 2.0, 2.1, 2.2
            expect(history[0].version).toBe('2.0');
            expect(history[1].version).toBe('2.1');
            expect(history[2].version).toBe('2.2');
        });

        test('should update existing version entry', () => {
            metadata.updateVersionHistory('2.0'); // Should update existing entry
            const history = metadata.getVersionHistory();
            expect(history).toHaveLength(1);
        });

        test('should limit version history to 10 entries', () => {
            for (let i = 1; i <= 15; i++) {
                metadata.updateVersionHistory(`2.${i}`);
            }

            const history = metadata.getVersionHistory();
            expect(history).toHaveLength(10);
            expect(history[0].version).toBe('2.6'); // Should keep last 10
            expect(history[9].version).toBe('2.15');
        });
    });

    describe('Metadata Retrieval', () => {
        beforeEach(() => {
            metadata.extractFromCharacterCard(testCharacterCard);
        });

        test('should get complete metadata', () => {
            const completeMetadata = metadata.getMetadata();
            
            expect(completeMetadata.id).toBe('test_character_123');
            expect(completeMetadata.name).toBe('Test Character');
            expect(completeMetadata.creator.name).toBe('Test Creator');
            expect(completeMetadata.tags).toBeDefined();
            expect(completeMetadata.extensions).toBeDefined();
            expect(completeMetadata.stats).toBeDefined();
            expect(completeMetadata.versions).toBeDefined();
        });

        test('should return copy of metadata, not reference', () => {
            const metadata1 = metadata.getMetadata();
            const metadata2 = metadata.getMetadata();
            
            expect(metadata1).not.toBe(metadata2);
            expect(metadata1).toEqual(metadata2);
        });
    });

    describe('Event System', () => {
        test('should support event subscription and unsubscription', () => {
            const callback = jest.fn();
            
            const unsubscribe = metadata.subscribe('test_event', callback);
            expect(typeof unsubscribe).toBe('function');
            
            metadata.eventBus.emit('test_event', { data: 'test' });
            expect(callback).toHaveBeenCalledWith({ data: 'test' });
            
            unsubscribe();
            metadata.eventBus.emit('test_event', { data: 'test2' });
            expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
        });
    });

    describe('Integration with CharacterCard', () => {
        test('should work with CharacterCard metadata methods', () => {
            // Test that CharacterCard can use the metadata system
            const card = new CharacterCard(testCharacterData);
            
            // Test tag management
            expect(card.addTag('mysterious', 'traits')).toBe(true);
            expect(card.getTagsByCategory('traits')).toContain('mysterious');
            
            // Test creator info
            expect(card.setCreatorInfo({ name: 'New Creator' })).toBe(true);
            expect(card.getCreatorInfo().name).toBe('New Creator');
            
            // Test rating
            expect(card.setRating(5)).toBe(true);
            expect(card.getRating()).toBe(5);
            
            // Test extension data
            expect(card.addExtensionData('test_ext', { data: 'value' })).toBe(true);
            expect(card.getExtensionData('test_ext').data).toBe('value');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid character card in extraction', () => {
            expect(() => metadata.extractFromCharacterCard(null)).toThrow('Invalid character card provided');
            expect(() => metadata.extractFromCharacterCard({})).toThrow('Invalid character card provided');
        });

        test('should handle invalid tag input', () => {
            expect(metadata.addTag(null)).toBe(false);
            expect(metadata.addTag('')).toBe(false);
            expect(metadata.addTag(123)).toBe(false);
        });

        test('should handle invalid creator info', () => {
            expect(metadata.setCreatorInfo(null)).toBe(false);
            expect(metadata.setCreatorInfo('string')).toBe(false);
        });

        test('should handle invalid extension data', () => {
            expect(metadata.addExtensionData(null, { data: 'test' })).toBe(false);
            expect(metadata.addExtensionData('', { data: 'test' })).toBe(false);
        });
    });
}); 