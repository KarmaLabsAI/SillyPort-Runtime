/**
 * Character Manager System
 * 
 * Handles character collection management, loading, caching, and persistence.
 * Provides search and filtering capabilities for character collections.
 * 
 * Task 2.3.1: Character Collection
 */

const { CharacterCard } = require('./CharacterCard.js');
const StorageManager = require('../core/StorageManager.js');
const EventBus = require('../core/EventBus.js');

class CharacterManager {
    constructor(config = {}) {
        this.config = {
            cacheSize: config.cacheSize || 100,
            enablePersistence: config.enablePersistence !== false,
            autoSave: config.autoSave !== false,
            ...config
        };
        
        this.characters = new Map(); // In-memory character collection
        this.cache = new Map(); // LRU cache for character data
        this.storage = null;
        this.eventBus = new EventBus();
        this.initialized = false;
        
        // Search index for fast filtering
        this.searchIndex = {
            byName: new Map(),
            byTag: new Map(),
            byCreator: new Map(),
            byVersion: new Map(),
            byRating: new Map(),
            byCategory: new Map()
        };
        
        // Statistics
        this.stats = {
            totalLoaded: 0,
            totalCached: 0,
            totalPersisted: 0,
            lastLoadTime: null,
            lastSaveTime: null
        };
    }

    /**
     * Initialize the character manager
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize storage if persistence is enabled
            if (this.config.enablePersistence) {
                this.storage = new StorageManager();
                await this.storage.init({
                    databaseName: 'SillyTavernRuntime',
                    objectStores: ['characters', 'characterCache', 'characterMetadata']
                });
                
                // Load persisted characters
                await this.loadPersistedCharacters();
            }
            
            this.initialized = true;
            this.eventBus.emit('characterManager:initialized', { 
                characterCount: this.characters.size,
                cacheSize: this.cache.size 
            });
            
        } catch (error) {
            this.eventBus.emit('characterManager:error', { 
                error: error.message,
                context: 'initialization' 
            });
            throw error;
        }
    }

    /**
     * Load character from file (PNG, JSON, YAML)
     * @param {File} file - Character file to load
     * @param {Object} options - Loading options
     * @returns {Promise<CharacterCard>} Loaded character card
     */
    async loadFromFile(file, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const loadOptions = {
            validate: options.validate !== false,
            cache: options.cache !== false,
            persist: options.persist !== false && this.config.enablePersistence,
            ...options
        };

        try {
            let characterCard;
            const fileExtension = this.getFileExtension(file.name);

            // Load based on file type
            switch (fileExtension.toLowerCase()) {
                case 'png':
                    characterCard = await CharacterCard.fromPNG(file);
                    break;
                case 'json':
                    const jsonText = await file.text();
                    characterCard = CharacterCard.fromJSON(jsonText);
                    break;
                case 'yaml':
                case 'yml':
                    const yamlText = await file.text();
                    characterCard = CharacterCard.fromYAML(yamlText);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            // Validate if requested
            if (loadOptions.validate && !characterCard.validate()) {
                const errors = characterCard.getValidationErrors();
                throw new Error(`Character validation failed: ${errors.join(', ')}`);
            }

            // Generate unique ID if not present
            if (!characterCard.data.id) {
                characterCard.data.id = this.generateCharacterId(characterCard.data.name);
            }

            // Add to collection
            await this.addCharacter(characterCard, loadOptions);

            this.eventBus.emit('characterManager:characterLoaded', {
                characterId: characterCard.data.id,
                characterName: characterCard.data.name,
                fileType: fileExtension,
                fileSize: file.size
            });

            return characterCard;

        } catch (error) {
            this.eventBus.emit('characterManager:error', {
                error: error.message,
                context: 'loadFromFile',
                fileName: file.name
            });
            throw error;
        }
    }

    /**
     * Add character to collection
     * @param {CharacterCard} characterCard - Character card to add
     * @param {Object} options - Options for adding
     * @returns {Promise<void>}
     */
    async addCharacter(characterCard, options = {}) {
        const addOptions = {
            cache: options.cache !== false,
            persist: options.persist !== false && this.config.enablePersistence,
            updateIndex: options.updateIndex !== false,
            ...options
        };

        const characterId = characterCard.data.id;
        const characterName = characterCard.data.name;

        // Add to main collection
        this.characters.set(characterId, characterCard);
        this.stats.totalLoaded++;

        // Update search index
        if (addOptions.updateIndex) {
            this.updateSearchIndex(characterCard);
        }

        // Cache character data
        if (addOptions.cache) {
            await this.cacheCharacter(characterCard);
        }

        // Persist to storage
        if (addOptions.persist) {
            await this.persistCharacter(characterCard);
        }

        this.eventBus.emit('characterManager:characterAdded', {
            characterId,
            characterName,
            totalCharacters: this.characters.size
        });
    }

    /**
     * Get character by ID
     * @param {string} characterId - Character ID
     * @returns {CharacterCard|null} Character card or null if not found
     */
    getCharacter(characterId) {
        return this.characters.get(characterId) || null;
    }

    /**
     * Get all characters
     * @returns {Array<CharacterCard>} Array of all character cards
     */
    getAll() {
        return Array.from(this.characters.values());
    }

    /**
     * Search characters by various criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array<CharacterCard>} Matching characters
     */
    search(criteria = {}) {
        let results = new Set();
        
        // Search by name
        if (criteria.name) {
            const nameResults = this.searchByName(criteria.name);
            nameResults.forEach(result => results.add(result));
        }

        // Search by tag
        if (criteria.tags && Array.isArray(criteria.tags)) {
            const tagResults = this.searchByTags(criteria.tags);
            if (results.size === 0) {
                // First criteria, add all results
                tagResults.forEach(result => results.add(result));
            } else {
                // Intersect with existing results
                const intersection = new Set();
                tagResults.forEach(result => {
                    if (results.has(result)) {
                        intersection.add(result);
                    }
                });
                results = intersection;
            }
        }

        // Search by creator
        if (criteria.creator) {
            const creatorResults = this.searchByCreator(criteria.creator);
            if (results.size === 0) {
                // First criteria, add all results
                creatorResults.forEach(result => results.add(result));
            } else {
                // Intersect with existing results
                const intersection = new Set();
                creatorResults.forEach(result => {
                    if (results.has(result)) {
                        intersection.add(result);
                    }
                });
                results = intersection;
            }
        }

        // Search by version
        if (criteria.version) {
            const versionResults = this.searchByVersion(criteria.version);
            if (results.size === 0) {
                // First criteria, add all results
                versionResults.forEach(result => results.add(result));
            } else {
                // Intersect with existing results
                const intersection = new Set();
                versionResults.forEach(result => {
                    if (results.has(result)) {
                        intersection.add(result);
                    }
                });
                results = intersection;
            }
        }

        // If no specific criteria provided, include all characters
        if (!criteria.name && !criteria.tags && !criteria.creator && !criteria.version) {
            this.getAll().forEach(result => results.add(result));
        }

        // Filter by validation status
        if (criteria.validOnly) {
            const validResults = Array.from(results).filter(char => char.isValid());
            results.clear();
            validResults.forEach(result => results.add(result));
        }

        return Array.from(results);
    }

    /**
     * Search characters by name (partial match)
     * @param {string} name - Name to search for
     * @returns {Array<CharacterCard>} Matching characters
     */
    searchByName(name) {
        const results = [];
        const searchTerm = name.toLowerCase();
        
        for (const [characterId, character] of this.characters) {
            const characterName = character.data.name.toLowerCase();
            if (characterName.includes(searchTerm)) {
                results.push(character);
            }
        }
        
        return results;
    }

    /**
     * Search characters by tags
     * @param {Array<string>} tags - Tags to search for
     * @returns {Array<CharacterCard>} Matching characters
     */
    searchByTags(tags) {
        const results = [];
        const searchTags = tags.map(tag => tag.toLowerCase());
        
        for (const [characterId, character] of this.characters) {
            const characterTags = character.data.tags || [];
            const characterTagNames = characterTags.map(tag => tag.toLowerCase());
            
            // Check if ALL search tags match character tags (AND logic)
            const hasAllMatchingTags = searchTags.every(searchTag => 
                characterTagNames.some(characterTag => characterTag.includes(searchTag))
            );
            
            if (hasAllMatchingTags) {
                results.push(character);
            }
        }
        
        return results;
    }

    /**
     * Search characters by creator
     * @param {string} creator - Creator name to search for
     * @returns {Array<CharacterCard>} Matching characters
     */
    searchByCreator(creator) {
        const results = [];
        const searchTerm = creator.toLowerCase();
        
        for (const [characterId, character] of this.characters) {
            const characterCreator = (character.data.creator || '').toLowerCase();
            if (characterCreator.includes(searchTerm)) {
                results.push(character);
            }
        }
        
        return results;
    }

    /**
     * Search characters by version
     * @param {string} version - Version to search for
     * @returns {Array<CharacterCard>} Matching characters
     */
    searchByVersion(version) {
        const results = [];
        const searchTerm = version.toLowerCase();
        
        for (const [characterId, character] of this.characters) {
            const characterVersion = (character.data.character_version || '').toLowerCase();
            if (characterVersion.includes(searchTerm)) {
                results.push(character);
            }
        }
        
        return results;
    }

    /**
     * Search by rating
     * @param {number} rating - Rating to search for
     * @returns {Array} Matching characters
     */
    searchByRating(rating) {
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            return [];
        }

        const ratingStr = rating.toString();
        const matchingIds = this.searchIndex.byRating.get(ratingStr) || new Set();
        
        return Array.from(matchingIds).map(id => this.characters.get(id)).filter(Boolean);
    }

    /**
     * Search by tag category
     * @param {string} category - Tag category
     * @param {string} tag - Tag value (optional)
     * @returns {Array} Matching characters
     */
    searchByTagCategory(category, tag = null) {
        if (!category || typeof category !== 'string') {
            return [];
        }

        let matchingIds = new Set();

        if (tag) {
            const categoryKey = `${category}:${tag.toLowerCase()}`;
            matchingIds = this.searchIndex.byCategory.get(categoryKey) || new Set();
        } else {
            // Search all tags in category
            for (const [key, ids] of this.searchIndex.byCategory.entries()) {
                if (key.startsWith(`${category}:`)) {
                    for (const id of ids) {
                        matchingIds.add(id);
                    }
                }
            }
        }
        
        return Array.from(matchingIds).map(id => this.characters.get(id)).filter(Boolean);
    }

    /**
     * Search by creator information
     * @param {Object} creatorInfo - Creator information to search for
     * @returns {Array} Matching characters
     */
    searchByCreatorInfo(creatorInfo) {
        if (!creatorInfo || typeof creatorInfo !== 'object') {
            return [];
        }

        const matchingIds = new Set();
        let hasMatches = false;

        // Search by creator name
        if (creatorInfo.name) {
            const creatorName = creatorInfo.name.toLowerCase();
            const nameMatches = this.searchIndex.byCreator.get(creatorName) || new Set();
            for (const id of nameMatches) {
                matchingIds.add(id);
                hasMatches = true;
            }
        }

        // If no name matches, return empty array
        if (!hasMatches) {
            return [];
        }

        // Filter by additional creator criteria
        const results = Array.from(matchingIds).map(id => this.characters.get(id)).filter(Boolean);
        
        if (creatorInfo.contact || creatorInfo.website) {
            return results.filter(character => {
                const metadata = character.getCharacterMetadata();
                if (!metadata) return false;
                
                const creatorData = metadata.getCreatorInfo();
                
                if (creatorInfo.contact && creatorData.contact !== creatorInfo.contact) {
                    return false;
                }
                
                if (creatorInfo.website && creatorData.website !== creatorInfo.website) {
                    return false;
                }
                
                return true;
            });
        }

        return results;
    }

    /**
     * Get characters with highest ratings
     * @param {number} limit - Maximum number of characters to return
     * @returns {Array} Top-rated characters
     */
    getTopRatedCharacters(limit = 10) {
        const ratedCharacters = [];
        
        for (const character of this.characters.values()) {
            const rating = character.getRating();
            if (rating) {
                ratedCharacters.push({ character, rating });
            }
        }

        return ratedCharacters
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit)
            .map(item => item.character);
    }

    /**
     * Get most favorited characters
     * @param {number} limit - Maximum number of characters to return
     * @returns {Array} Most favorited characters
     */
    getMostFavoritedCharacters(limit = 10) {
        const favoritedCharacters = [];
        
        for (const character of this.characters.values()) {
            const metadata = character.getCharacterMetadata();
            if (metadata) {
                const stats = metadata.getStats();
                if (stats.favoriteCount > 0) {
                    favoritedCharacters.push({ character, favoriteCount: stats.favoriteCount });
                }
            }
        }

        return favoritedCharacters
            .sort((a, b) => b.favoriteCount - a.favoriteCount)
            .slice(0, limit)
            .map(item => item.character);
    }

    /**
     * Get characters by tag category statistics
     * @returns {Object} Tag category statistics
     */
    getTagCategoryStats() {
        const stats = {
            categories: {},
            totalCharacters: this.characters.size
        };

        for (const character of this.characters.values()) {
            const metadata = character.getCharacterMetadata();
            if (metadata) {
                const tags = metadata.getAllTags();
                
                for (const [category, tagList] of Object.entries(tags)) {
                    if (!stats.categories[category]) {
                        stats.categories[category] = {};
                    }
                    
                    for (const tag of tagList) {
                        if (!stats.categories[category][tag]) {
                            stats.categories[category][tag] = 0;
                        }
                        stats.categories[category][tag]++;
                    }
                }
            }
        }

        return stats;
    }

    /**
     * Remove character from collection
     * @param {string} characterId - Character ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    async removeCharacter(characterId) {
        const character = this.characters.get(characterId);
        if (!character) {
            return false;
        }

        // Remove from main collection
        this.characters.delete(characterId);
        this.stats.totalLoaded--;

        // Remove from cache
        this.cache.delete(characterId);

        // Remove from storage
        if (this.storage) {
            await this.storage.delete('characters', characterId);
            await this.storage.delete('characterCache', characterId);
        }

        // Remove from search index
        this.removeFromSearchIndex(character);

        this.eventBus.emit('characterManager:characterRemoved', {
            characterId,
            characterName: character.data.name,
            totalCharacters: this.characters.size
        });

        return true;
    }

    /**
     * Load emotion sprite for character
     * @param {string} characterId - Character ID
     * @param {string} emotionName - Emotion name
     * @param {File|Blob} emotionFile - Emotion sprite file
     * @returns {Promise<Object>} Loaded emotion data
     */
    async loadEmotionSprite(characterId, emotionName, emotionFile) {
        const character = this.getCharacter(characterId);
        if (!character) {
            throw new Error(`Character not found: ${characterId}`);
        }

        try {
            const emotionData = await CharacterCard.loadEmotionSprite(emotionFile);
            
            // Store emotion data in character
            if (!character.data.emotions) {
                character.data.emotions = {};
            }
            character.data.emotions[emotionName] = emotionData;

            // Update character in collection
            this.characters.set(characterId, character);

            // Persist updated character
            if (this.config.enablePersistence) {
                await this.persistCharacter(character);
            }

            this.eventBus.emit('characterManager:emotionLoaded', {
                characterId,
                characterName: character.data.name,
                emotionName,
                emotionData
            });

            return emotionData;

        } catch (error) {
            this.eventBus.emit('characterManager:error', {
                error: error.message,
                context: 'loadEmotionSprite',
                characterId,
                emotionName
            });
            throw error;
        }
    }

    /**
     * Get character statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            currentCollectionSize: this.characters.size,
            currentCacheSize: this.cache.size,
            searchIndexSize: {
                byName: this.searchIndex.byName.size,
                byTag: this.searchIndex.byTag.size,
                byCreator: this.searchIndex.byCreator.size,
                byVersion: this.searchIndex.byVersion.size
            }
        };
    }

    /**
     * Clear all characters from collection
     * @returns {Promise<void>}
     */
    async clearAll() {
        this.characters.clear();
        this.cache.clear();
        this.searchIndex = {
            byName: new Map(),
            byTag: new Map(),
            byCreator: new Map(),
            byVersion: new Map()
        };

        if (this.storage) {
            await this.storage.clear('characters');
            await this.storage.clear('characterCache');
        }

        this.stats = {
            totalLoaded: 0,
            totalCached: 0,
            totalPersisted: 0,
            lastLoadTime: null,
            lastSaveTime: null
        };

        this.eventBus.emit('characterManager:cleared', {
            totalCharacters: 0
        });
    }

    // Private helper methods

    /**
     * Get file extension from filename
     * @param {string} filename - Filename
     * @returns {string} File extension
     */
    getFileExtension(filename) {
        return filename.split('.').pop();
    }

    /**
     * Generate unique character ID
     * @param {string} name - Character name
     * @returns {string} Unique ID
     */
    generateCharacterId(name) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `${sanitizedName}_${timestamp}_${random}`;
    }

    /**
     * Update search index for character
     * @param {CharacterCard} characterCard - Character card
     */
    updateSearchIndex(characterCard) {
        const characterId = characterCard.data.id;
        const name = characterCard.data.name.toLowerCase();
        const creator = (characterCard.data.creator || '').toLowerCase();
        const version = (characterCard.data.character_version || '').toLowerCase();
        const tags = characterCard.data.tags || [];

        // Index by name
        if (!this.searchIndex.byName.has(name)) {
            this.searchIndex.byName.set(name, new Set());
        }
        this.searchIndex.byName.get(name).add(characterId);

        // Index by creator
        if (creator) {
            if (!this.searchIndex.byCreator.has(creator)) {
                this.searchIndex.byCreator.set(creator, new Set());
            }
            this.searchIndex.byCreator.get(creator).add(characterId);
        }

        // Index by version
        if (version) {
            if (!this.searchIndex.byVersion.has(version)) {
                this.searchIndex.byVersion.set(version, new Set());
            }
            this.searchIndex.byVersion.get(version).add(characterId);
        }

        // Index by tags
        for (const tag of tags) {
            const tagLower = tag.toLowerCase();
            if (!this.searchIndex.byTag.has(tagLower)) {
                this.searchIndex.byTag.set(tagLower, new Set());
            }
            this.searchIndex.byTag.get(tagLower).add(characterId);
        }

        // Enhanced metadata indexing
        this.updateEnhancedMetadataIndex(characterCard);
    }

    /**
     * Update enhanced metadata search index
     * @param {CharacterCard} characterCard - Character card
     */
    updateEnhancedMetadataIndex(characterCard) {
        const characterId = characterCard.data.id;
        const metadata = characterCard.getCharacterMetadata();

        if (!metadata) {
            return;
        }

        const metadataData = metadata.getMetadata();

        // Index by rating
        if (metadataData.stats.rating) {
            const rating = metadataData.stats.rating.toString();
            if (!this.searchIndex.byRating.has(rating)) {
                this.searchIndex.byRating.set(rating, new Set());
            }
            this.searchIndex.byRating.get(rating).add(characterId);
        }

        // Index by tag categories
        for (const [category, tags] of Object.entries(metadataData.tags)) {
            for (const tag of tags) {
                const categoryKey = `${category}:${tag.toLowerCase()}`;
                if (!this.searchIndex.byCategory.has(categoryKey)) {
                    this.searchIndex.byCategory.set(categoryKey, new Set());
                }
                this.searchIndex.byCategory.get(categoryKey).add(characterId);
            }
        }

        // Index by creator info
        if (metadataData.creator.name) {
            const creatorName = metadataData.creator.name.toLowerCase();
            if (!this.searchIndex.byCreator.has(creatorName)) {
                this.searchIndex.byCreator.set(creatorName, new Set());
            }
            this.searchIndex.byCreator.get(creatorName).add(characterId);
        }
    }

    /**
     * Remove character from search index
     * @param {CharacterCard} characterCard - Character card
     */
    removeFromSearchIndex(characterCard) {
        const characterId = characterCard.data.id;
        const name = characterCard.data.name.toLowerCase();
        const creator = (characterCard.data.creator || '').toLowerCase();
        const version = (characterCard.data.character_version || '').toLowerCase();
        const tags = characterCard.data.tags || [];

        // Remove from name index
        if (this.searchIndex.byName.has(name)) {
            this.searchIndex.byName.get(name).delete(characterId);
            if (this.searchIndex.byName.get(name).size === 0) {
                this.searchIndex.byName.delete(name);
            }
        }

        // Remove from creator index
        if (creator && this.searchIndex.byCreator.has(creator)) {
            this.searchIndex.byCreator.get(creator).delete(characterId);
            if (this.searchIndex.byCreator.get(creator).size === 0) {
                this.searchIndex.byCreator.delete(creator);
            }
        }

        // Remove from version index
        if (version && this.searchIndex.byVersion.has(version)) {
            this.searchIndex.byVersion.get(version).delete(characterId);
            if (this.searchIndex.byVersion.get(version).size === 0) {
                this.searchIndex.byVersion.delete(version);
            }
        }

        // Remove from tag index
        for (const tag of tags) {
            const tagLower = tag.toLowerCase();
            if (this.searchIndex.byTag.has(tagLower)) {
                this.searchIndex.byTag.get(tagLower).delete(characterId);
                if (this.searchIndex.byTag.get(tagLower).size === 0) {
                    this.searchIndex.byTag.delete(tagLower);
                }
            }
        }
    }

    /**
     * Cache character data
     * @param {CharacterCard} characterCard - Character card
     * @returns {Promise<void>}
     */
    async cacheCharacter(characterCard) {
        const characterId = characterCard.data.id;
        
        // Implement LRU cache eviction
        if (this.cache.size >= this.config.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(characterId, {
            character: characterCard,
            timestamp: Date.now(),
            accessCount: 0
        });

        this.stats.totalCached++;
    }

    /**
     * Persist character to storage
     * @param {CharacterCard} characterCard - Character card
     * @returns {Promise<void>}
     */
    async persistCharacter(characterCard) {
        if (!this.storage) {
            return;
        }

        const characterId = characterCard.data.id;
        const characterData = characterCard.toJSON();
        const metadata = characterCard.getMetadata();

        await this.storage.save('characters', characterId, characterData);
        await this.storage.save('characterMetadata', characterId, metadata);

        this.stats.totalPersisted++;
        this.stats.lastSaveTime = Date.now();
    }

    /**
     * Load persisted characters from storage
     * @returns {Promise<void>}
     */
    async loadPersistedCharacters() {
        if (!this.storage) {
            return;
        }

        try {
            const characterIds = await this.storage.getAllKeys('characters');
            
            for (const characterId of characterIds) {
                const characterData = await this.storage.load('characters', characterId);
                const metadata = await this.storage.load('characterMetadata', characterId);
                
                const characterCard = CharacterCard.fromJSON(characterData);
                characterCard.metadata = metadata || {};
                
                await this.addCharacter(characterCard, {
                    cache: true,
                    persist: false, // Already persisted
                    updateIndex: true
                });
            }

            this.stats.lastLoadTime = Date.now();

        } catch (error) {
            this.eventBus.emit('characterManager:error', {
                error: error.message,
                context: 'loadPersistedCharacters'
            });
        }
    }

    /**
     * Subscribe to character manager events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        return this.eventBus.subscribe(event, callback);
    }

    /**
     * Unsubscribe from character manager events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    unsubscribe(event, callback) {
        this.eventBus.unsubscribe(event, callback);
    }
}

module.exports = { CharacterManager }; 