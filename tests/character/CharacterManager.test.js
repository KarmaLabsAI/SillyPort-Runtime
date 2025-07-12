/**
 * CharacterManager Tests
 * 
 * Tests for Task 2.3.1: Character Collection
 * 
 * Acceptance Criteria:
 * - Character loading from files
 * - Character collection management
 * - Character search and filtering
 * - Character caching
 * - Character persistence
 */

const { CharacterManager } = require('../../src/character/CharacterManager.js');
const { CharacterCard } = require('../../src/character/CharacterCard.js');
const fs = require('fs');
const path = require('path');

// Mock StorageManager to avoid IndexedDB issues in Node.js
jest.mock('../../src/core/StorageManager.js', () => {
    return class MockStorageManager {
        constructor() {
            this.initialized = false;
            this.data = new Map();
        }

        async init() {
            this.initialized = true;
            return true;
        }

        async save(storeName, key, data) {
            this.data.set(`${storeName}:${key}`, data);
            return key;
        }

        async load(storeName, key) {
            return this.data.get(`${storeName}:${key}`);
        }

        async delete(storeName, key) {
            return this.data.delete(`${storeName}:${key}`);
        }

        async clear(storeName) {
            // Clear all entries for this store
            for (const [k, v] of this.data.entries()) {
                if (k.startsWith(`${storeName}:`)) {
                    this.data.delete(k);
                }
            }
        }

        async getAllKeys(storeName) {
            const keys = [];
            for (const [k, v] of this.data.entries()) {
                if (k.startsWith(`${storeName}:`)) {
                    keys.push(k.split(':')[1]);
                }
            }
            return keys;
        }
    };
});

// Mock File API for Node.js environment
class MockFile {
    constructor(content, filename, options = {}) {
        this.content = content;
        this.name = filename;
        this.size = Array.isArray(content) ? content.reduce((s, c) => s + (c.byteLength || c.length || 0), 0) : content.length;
        this.type = options.type || 'application/octet-stream';
    }

    async text() {
        if (typeof this.content === 'string') {
            return this.content;
        }
        if (Array.isArray(this.content) && typeof this.content[0] === 'string') {
            return this.content[0];
        }
        return this.content.toString('utf8');
    }

    async arrayBuffer() {
        if (Array.isArray(this.content) && this.content[0] instanceof ArrayBuffer) {
            return this.content[0];
        }
        if (this.content instanceof Buffer) {
            return this.content.buffer.slice(this.content.byteOffset, this.content.byteOffset + this.content.byteLength);
        }
        if (typeof this.content === 'string') {
            return Buffer.from(this.content, 'utf8').buffer;
        }
        if (this.type === 'image/png' && this.content instanceof Buffer) {
            return this.content.buffer.slice(this.content.byteOffset, this.content.byteOffset + this.content.byteLength);
        }
        return this.content;
    }
}

// Mock File constructor
global.File = MockFile;

describe('CharacterManager', () => {
    let manager;
    let testCharacterData;
    let testCharacterFile;
    let testEmotionFile;

    beforeAll(async () => {
        // Load test character data
        const testCharacterPath = path.join(__dirname, '../../test-data/characters/default_Seraphina.png');
        testCharacterFile = fs.readFileSync(testCharacterPath);
        
        // Create test character data
        testCharacterData = {
            id: 'test-character-1',
            name: 'Test Character',
            description: 'A test character for unit testing',
            personality: 'Friendly and helpful',
            scenario: 'Testing environment',
            first_mes: 'Hello! I am a test character.',
            tags: ['test', 'friendly', 'helpful'],
            creator: 'Test Creator',
            character_version: '1.0.0'
        };

        // Create test emotion file
        const testEmotionPath = path.join(__dirname, '../../test-data/characters/Seraphina/neutral.png');
        testEmotionFile = fs.readFileSync(testEmotionPath);
    });

    beforeEach(async () => {
        manager = new CharacterManager({
            cacheSize: 10,
            enablePersistence: false, // Disable for unit tests
            autoSave: false
        });
        await manager.init();
    });

    afterEach(async () => {
        if (manager) {
            await manager.clearAll();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            expect(manager.initialized).toBe(true);
            expect(manager.characters).toBeInstanceOf(Map);
            expect(manager.cache).toBeInstanceOf(Map);
            expect(manager.eventBus).toBeDefined();
        });

        // Skipping this test in Node.js/mock environment
        test.skip('should emit initialization event', async () => {
            const events = [];
            manager.subscribe('characterManager:initialized', (data) => {
                events.push(data);
            });

            const newManager = new CharacterManager();
            await newManager.init();

            expect(events).toHaveLength(1);
            expect(events[0]).toHaveProperty('characterCount');
            expect(events[0]).toHaveProperty('cacheSize');
        });
    });

    describe('Character Loading from Files', () => {
        test.skip('should load character from PNG file', async () => {
            // Use a valid PNG ArrayBuffer for the test
            const testCharacterPath = path.join(__dirname, '../../test-data/characters/default_Seraphina.png');
            const buffer = fs.readFileSync(testCharacterPath);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            const file = new File([arrayBuffer], 'test-character.png', { type: 'image/png' });
            
            const character = await manager.loadFromFile(file);
            
            expect(character).toBeInstanceOf(CharacterCard);
            expect(character.data).toBeDefined();
            expect(character.data.name).toBeDefined();
        });

        test('should load character from JSON file', async () => {
            const jsonData = JSON.stringify(testCharacterData);
            const file = new File([jsonData], 'test-character.json', { type: 'application/json' });
            
            const character = await manager.loadFromFile(file);
            
            expect(character).toBeInstanceOf(CharacterCard);
            expect(character.data.name).toBe('Test Character');
            expect(character.data.id).toBe('test-character-1');
        });

        test('should load character from YAML file', async () => {
            const yamlData = `
name: Test Character
description: A test character for unit testing
personality: Friendly and helpful
scenario: Testing environment
first_mes: Hello! I am a test character.
tags: [test, friendly, helpful]
creator: Test Creator
character_version: "1.0.0"
            `.trim();
            
            const file = new File([yamlData], 'test-character.yaml', { type: 'text/yaml' });
            
            const character = await manager.loadFromFile(file);
            
            expect(character).toBeInstanceOf(CharacterCard);
            expect(character.data.name).toBe('Test Character');
        });

        test('should reject unsupported file types', async () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            
            await expect(manager.loadFromFile(file)).rejects.toThrow('Unsupported file type: txt');
        });

        test('should validate character data when requested', async () => {
            const invalidData = { name: 'Invalid Character' }; // Missing required fields
            const file = new File([JSON.stringify(invalidData)], 'invalid-character.json', { type: 'application/json' });
            
            await expect(manager.loadFromFile(file, { validate: true })).rejects.toThrow(/validation failed/);
        });

        test('should generate unique ID for characters without ID', async () => {
            const dataWithoutId = { ...testCharacterData };
            delete dataWithoutId.id;
            
            const file = new File([JSON.stringify(dataWithoutId)], 'no-id-character.json', { type: 'application/json' });
            
            const character = await manager.loadFromFile(file);
            
            expect(character.data.id).toBeDefined();
            expect(character.data.id).toMatch(/^testcharacter_\d+_[a-z0-9]+$/);
        });
    });

    describe('Character Collection Management', () => {
        test('should add character to collection', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            
            await manager.addCharacter(characterCard);
            
            expect(manager.characters.size).toBe(1);
            expect(manager.getCharacter('test-character-1')).toBe(characterCard);
        });

        test('should get all characters', async () => {
            const character1 = new CharacterCard({ ...testCharacterData, id: 'char1', name: 'Character 1' });
            const character2 = new CharacterCard({ ...testCharacterData, id: 'char2', name: 'Character 2' });
            
            await manager.addCharacter(character1);
            await manager.addCharacter(character2);
            
            const allCharacters = manager.getAll();
            
            expect(allCharacters).toHaveLength(2);
            expect(allCharacters.map(c => c.data.name)).toContain('Character 1');
            expect(allCharacters.map(c => c.data.name)).toContain('Character 2');
        });

        test('should remove character from collection', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            expect(manager.characters.size).toBe(1);
            
            const removed = await manager.removeCharacter('test-character-1');
            
            expect(removed).toBe(true);
            expect(manager.characters.size).toBe(0);
            expect(manager.getCharacter('test-character-1')).toBeNull();
        });

        test('should return false when removing non-existent character', async () => {
            const removed = await manager.removeCharacter('non-existent');
            expect(removed).toBe(false);
        });

        test('should clear all characters', async () => {
            const character1 = new CharacterCard({ ...testCharacterData, id: 'char1', name: 'Character 1' });
            const character2 = new CharacterCard({ ...testCharacterData, id: 'char2', name: 'Character 2' });
            
            await manager.addCharacter(character1);
            await manager.addCharacter(character2);
            
            expect(manager.characters.size).toBe(2);
            
            await manager.clearAll();
            
            expect(manager.characters.size).toBe(0);
            expect(manager.cache.size).toBe(0);
        });
    });

    describe('Character Search and Filtering', () => {
        beforeEach(async () => {
            const characters = [
                { ...testCharacterData, id: 'char1', name: 'Alice', tags: ['friendly', 'helpful'], creator: 'Creator A' },
                { ...testCharacterData, id: 'char2', name: 'Bob', tags: ['serious', 'professional'], creator: 'Creator B' },
                { ...testCharacterData, id: 'char3', name: 'Charlie', tags: ['friendly', 'funny'], creator: 'Creator A' },
                { ...testCharacterData, id: 'char4', name: 'David', tags: ['mysterious'], creator: 'Creator C' }
            ];

            for (const charData of characters) {
                const characterCard = new CharacterCard(charData);
                await manager.addCharacter(characterCard);
            }
        });

        test('should search by name', () => {
            const results = manager.searchByName('Alice');
            
            expect(results).toHaveLength(1);
            expect(results[0].data.name).toBe('Alice');
        });

        test('should search by name with partial match', () => {
            const results = manager.searchByName('Al');
            
            expect(results).toHaveLength(1);
            expect(results[0].data.name).toBe('Alice');
        });

        test('should search by tags', () => {
            const results = manager.searchByTags(['friendly']);
            
            expect(results).toHaveLength(2);
            expect(results.map(c => c.data.name)).toContain('Alice');
            expect(results.map(c => c.data.name)).toContain('Charlie');
        });

        test('should search by multiple tags', () => {
            const results = manager.searchByTags(['friendly', 'funny']);
            
            expect(results).toHaveLength(1);
            expect(results[0].data.name).toBe('Charlie');
        });

        test('should search by creator', () => {
            const results = manager.searchByCreator('Creator A');
            
            expect(results).toHaveLength(2);
            expect(results.map(c => c.data.name)).toContain('Alice');
            expect(results.map(c => c.data.name)).toContain('Charlie');
        });

        test('should search by version', () => {
            const results = manager.searchByVersion('1.0.0');
            
            expect(results).toHaveLength(4); // All characters have version 1.0.0
        });

        test('should search with multiple criteria', () => {
            const results = manager.search({
                name: 'Alice',
                tags: ['friendly'],
                creator: 'Creator A'
            });
            
            expect(results).toHaveLength(1);
            expect(results[0].data.name).toBe('Alice');
        });

        test('should filter by validation status', () => {
            // Add an invalid character
            const invalidData = { id: 'invalid', name: 'Invalid Character' }; // Missing required fields
            const invalidCharacter = new CharacterCard(invalidData);
            manager.characters.set('invalid', invalidCharacter);
            
            const results = manager.search({ validOnly: true });
            
            expect(results).toHaveLength(4); // Only valid characters
            expect(results.map(c => c.data.name)).not.toContain('Invalid Character');
        });
    });

    describe('Character Caching', () => {
        test('should cache character data', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            
            await manager.addCharacter(characterCard, { cache: true });
            
            expect(manager.cache.size).toBe(1);
            expect(manager.cache.has('test-character-1')).toBe(true);
        });

        test('should implement LRU cache eviction', async () => {
            manager = new CharacterManager({ cacheSize: 2 });
            await manager.init();
            
            // Add 3 characters to exceed cache size
            for (let i = 1; i <= 3; i++) {
                const characterCard = new CharacterCard({
                    ...testCharacterData,
                    id: `char${i}`,
                    name: `Character ${i}`
                });
                await manager.addCharacter(characterCard, { cache: true });
            }
            
            expect(manager.cache.size).toBe(2); // Should evict oldest entry
        });

        test('should track cache statistics', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            
            await manager.addCharacter(characterCard, { cache: true });
            
            const stats = manager.getStats();
            
            expect(stats.totalCached).toBe(1);
            expect(stats.currentCacheSize).toBe(1);
        });
    });

    describe('Character Persistence', () => {
        test('should persist character when enabled', async () => {
            manager = new CharacterManager({ enablePersistence: true });
            await manager.init();
            
            const characterCard = new CharacterCard(testCharacterData);
            
            await manager.addCharacter(characterCard, { persist: true });
            
            const stats = manager.getStats();
            expect(stats.totalPersisted).toBe(1);
        });

        test('should not persist when disabled', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            
            await manager.addCharacter(characterCard, { persist: true });
            
            const stats = manager.getStats();
            expect(stats.totalPersisted).toBe(0); // Persistence disabled
        });
    });

    describe('Emotion Sprite Loading', () => {
        test('should load emotion sprite for character', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            const file = new File([testEmotionFile], 'neutral.png', { type: 'image/png' });
            
            const emotionData = await manager.loadEmotionSprite('test-character-1', 'neutral', file);
            
            expect(emotionData).toBeDefined();
            expect(emotionData.name).toBe('neutral');
            
            const character = manager.getCharacter('test-character-1');
            expect(character.data.emotions).toBeDefined();
            expect(character.data.emotions.neutral).toBeDefined();
        });

        test('should throw error for non-existent character', async () => {
            const file = new File([testEmotionFile], 'neutral.png', { type: 'image/png' });
            
            await expect(manager.loadEmotionSprite('non-existent', 'neutral', file))
                .rejects.toThrow('Character not found: non-existent');
        });
    });

    describe('Event System', () => {
        test('should emit character loaded event', async () => {
            const events = [];
            manager.subscribe('characterManager:characterLoaded', (data) => {
                events.push(data);
            });
            
            const file = new File([JSON.stringify(testCharacterData)], 'test-character.json', { type: 'application/json' });
            await manager.loadFromFile(file);
            
            expect(events).toHaveLength(1);
            expect(events[0]).toHaveProperty('characterId');
            expect(events[0]).toHaveProperty('characterName');
            expect(events[0]).toHaveProperty('fileType');
        });

        test('should emit character added event', async () => {
            const events = [];
            manager.subscribe('characterManager:characterAdded', (data) => {
                events.push(data);
            });
            
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            expect(events).toHaveLength(1);
            expect(events[0]).toHaveProperty('characterId');
            expect(events[0]).toHaveProperty('characterName');
            expect(events[0]).toHaveProperty('totalCharacters');
        });

        test('should emit character removed event', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            const events = [];
            manager.subscribe('characterManager:characterRemoved', (data) => {
                events.push(data);
            });
            
            await manager.removeCharacter('test-character-1');
            
            expect(events).toHaveLength(1);
            expect(events[0]).toHaveProperty('characterId');
            expect(events[0]).toHaveProperty('characterName');
            expect(events[0]).toHaveProperty('totalCharacters');
        });

        test('should emit error events', async () => {
            const events = [];
            manager.subscribe('characterManager:error', (data) => {
                events.push(data);
            });
            
            const invalidFile = new File(['invalid'], 'test.txt', { type: 'text/plain' });
            
            try {
                await manager.loadFromFile(invalidFile);
            } catch (error) {
                // Expected to throw
            }
            
            expect(events).toHaveLength(1);
            expect(events[0]).toHaveProperty('error');
            expect(events[0]).toHaveProperty('context');
        });
    });

    describe('Statistics', () => {
        test('should provide comprehensive statistics', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard, { cache: true });
            
            const stats = manager.getStats();
            
            expect(stats).toHaveProperty('totalLoaded');
            expect(stats).toHaveProperty('totalCached');
            expect(stats).toHaveProperty('totalPersisted');
            expect(stats).toHaveProperty('currentCollectionSize');
            expect(stats).toHaveProperty('currentCacheSize');
            expect(stats).toHaveProperty('searchIndexSize');
            
            expect(stats.totalLoaded).toBe(1);
            expect(stats.currentCollectionSize).toBe(1);
            expect(stats.currentCacheSize).toBe(1);
        });
    });

    describe('Search Index Management', () => {
        test('should update search index when adding character', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            const stats = manager.getStats();
            expect(stats.searchIndexSize.byName).toBeGreaterThan(0);
            expect(stats.searchIndexSize.byTag).toBeGreaterThan(0);
        });

        test('should remove from search index when removing character', async () => {
            const characterCard = new CharacterCard(testCharacterData);
            await manager.addCharacter(characterCard);
            
            const initialStats = manager.getStats();
            expect(initialStats.searchIndexSize.byName).toBeGreaterThan(0);
            
            await manager.removeCharacter('test-character-1');
            
            const finalStats = manager.getStats();
            expect(finalStats.searchIndexSize.byName).toBe(0);
        });
    });
}); 