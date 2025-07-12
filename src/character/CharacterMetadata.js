/**
 * Character Metadata Management System
 * 
 * Handles character metadata extraction, tag management, creator information,
 * version tracking, and extension data support.
 * 
 * Task 2.3.2: Character Metadata
 */

const EventBus = require('../core/EventBus.js');

class CharacterMetadata {
    constructor(characterCard = null) {
        this.characterCard = characterCard;
        this.eventBus = new EventBus();
        
        // Core metadata structure
        this.metadata = {
            // Basic information
            id: null,
            name: null,
            created: null,
            modified: null,
            version: null,
            
            // Creator information
            creator: {
                name: null,
                contact: null,
                website: null,
                attribution: null
            },
            
            // Tagging system
            tags: {
                categories: [],
                emotions: [],
                traits: [],
                themes: [],
                custom: []
            },
            
            // Version tracking
            versions: [],
            
            // Extension data
            extensions: {},
            
            // Usage statistics
            stats: {
                loadCount: 0,
                lastAccessed: null,
                favoriteCount: 0,
                rating: null
            },
            
            // Source information
            source: {
                format: null,
                originalFile: null,
                importDate: null,
                conversionInfo: null
            }
        };
        
        // Initialize if character card provided
        if (characterCard) {
            this.extractFromCharacterCard(characterCard);
        }
    }

    /**
     * Extract metadata from character card
     * @param {CharacterCard} characterCard - Character card to extract from
     * @returns {Object} Extracted metadata
     */
    extractFromCharacterCard(characterCard) {
        if (!characterCard || !characterCard.data) {
            throw new Error('Invalid character card provided');
        }

        const data = characterCard.data;
        const existingMetadata = characterCard.getMetadata();

        // Basic information
        this.metadata.id = data.id || this.generateMetadataId(data.name);
        this.metadata.name = data.name;
        this.metadata.created = existingMetadata.created || new Date().toISOString();
        this.metadata.modified = new Date().toISOString();
        this.metadata.version = data.character_version || '1.0';

        // Creator information
        this.metadata.creator = {
            name: data.creator || existingMetadata.creator?.name || null,
            contact: existingMetadata.creator?.contact || null,
            website: existingMetadata.creator?.website || null,
            attribution: existingMetadata.creator?.attribution || null
        };

        // Tag extraction and categorization
        this.extractTags(data, existingMetadata);

        // Version tracking
        this.updateVersionHistory(data.character_version);

        // Extension data
        this.metadata.extensions = {
            ...existingMetadata.extensions,
            ...(data.extensions || {})
        };

        // Source information
        this.metadata.source = {
            format: existingMetadata.source?.format || 'unknown',
            originalFile: existingMetadata.source?.originalFile || null,
            importDate: existingMetadata.source?.importDate || new Date().toISOString(),
            conversionInfo: existingMetadata.source?.conversionInfo || null
        };

        // Update statistics (only if not already initialized)
        if (this.metadata.stats.loadCount === 0) {
            this.updateStats();
        }

        this.eventBus.emit('metadata:extracted', {
            characterId: this.metadata.id,
            metadata: this.getMetadata()
        });

        return this.getMetadata();
    }

    /**
     * Extract and categorize tags from character data
     * @param {Object} data - Character data
     * @param {Object} existingMetadata - Existing metadata
     */
    extractTags(data, existingMetadata) {
        const tags = data.tags || [];
        const existingTags = existingMetadata.tags || {};

        // Initialize tag categories
        this.metadata.tags = {
            categories: existingTags.categories || [],
            emotions: existingTags.emotions || [],
            traits: existingTags.traits || [],
            themes: existingTags.themes || [],
            custom: existingTags.custom || []
        };

        // Process tags and categorize them
        for (const tag of tags) {
            const categorizedTag = this.categorizeTag(tag);
            if (categorizedTag) {
                this.metadata.tags[categorizedTag.category].push(categorizedTag.value);
            }
        }

        // Extract implicit tags from character data
        this.extractImplicitTags(data);
    }

    /**
     * Categorize a tag based on its content
     * @param {string} tag - Tag to categorize
     * @returns {Object|null} Categorized tag object
     */
    categorizeTag(tag) {
        if (!tag || typeof tag !== 'string') {
            return null;
        }

        const lowerTag = tag.toLowerCase().trim();

        // Emotion tags
        const emotionKeywords = [
            'happy', 'sad', 'angry', 'excited', 'calm', 'nervous', 'confident',
            'shy', 'outgoing', 'introverted', 'optimistic', 'pessimistic',
            'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust',
            'love', 'hate', 'jealousy', 'pride', 'shame', 'guilt'
        ];

        if (emotionKeywords.some(keyword => lowerTag.includes(keyword))) {
            return { category: 'emotions', value: tag };
        }

        // Trait tags
        const traitKeywords = [
            'intelligent', 'wise', 'foolish', 'brave', 'cowardly', 'kind',
            'cruel', 'generous', 'selfish', 'honest', 'deceitful', 'loyal',
            'treacherous', 'patient', 'impatient', 'creative', 'logical',
            'emotional', 'rational', 'impulsive', 'careful', 'reckless',
            'courageous', 'bold', 'fearless', 'daring'
        ];

        if (traitKeywords.some(keyword => lowerTag.includes(keyword))) {
            return { category: 'traits', value: tag };
        }

        // Theme tags
        const themeKeywords = [
            'fantasy', 'scifi', 'romance', 'adventure', 'mystery', 'horror',
            'comedy', 'drama', 'action', 'slice-of-life', 'historical',
            'modern', 'medieval', 'futuristic', 'post-apocalyptic'
        ];

        if (themeKeywords.some(keyword => lowerTag.includes(keyword))) {
            return { category: 'themes', value: tag };
        }

        // Category tags
        const categoryKeywords = [
            'protagonist', 'antagonist', 'supporting', 'main', 'side',
            'hero', 'villain', 'mentor', 'student', 'leader', 'follower'
        ];

        if (categoryKeywords.some(keyword => lowerTag.includes(keyword))) {
            return { category: 'categories', value: tag };
        }

        // Default to custom
        return { category: 'custom', value: tag };
    }

    /**
     * Extract implicit tags from character data
     * @param {Object} data - Character data
     */
    extractImplicitTags(data) {
        // Extract personality traits from personality field
        if (data.personality) {
            const personalityText = data.personality.toLowerCase();
            
            // Look for trait indicators
            const traitIndicators = {
                'intelligent': ['smart', 'intelligent', 'wise', 'clever', 'brilliant'],
                'kind': ['kind', 'gentle', 'caring', 'compassionate', 'empathetic'],
                'brave': ['brave', 'courageous', 'bold', 'fearless', 'daring'],
                'mysterious': ['mysterious', 'enigmatic', 'secretive', 'mystical'],
                'powerful': ['powerful', 'strong', 'mighty', 'formidable', 'dominant']
            };

            for (const [trait, indicators] of Object.entries(traitIndicators)) {
                if (indicators.some(indicator => personalityText.includes(indicator))) {
                    if (!this.metadata.tags.traits.includes(trait)) {
                        this.metadata.tags.traits.push(trait);
                    }
                }
            }
        }

        // Extract themes from scenario
        if (data.scenario) {
            const scenarioText = data.scenario.toLowerCase();
            
            const themeIndicators = {
                'fantasy': ['magic', 'wizard', 'dragon', 'fantasy', 'medieval'],
                'scifi': ['space', 'robot', 'technology', 'future', 'sci-fi'],
                'romance': ['love', 'romance', 'relationship', 'dating'],
                'adventure': ['quest', 'journey', 'adventure', 'exploration']
            };

            for (const [theme, indicators] of Object.entries(themeIndicators)) {
                if (indicators.some(indicator => scenarioText.includes(indicator))) {
                    if (!this.metadata.tags.themes.includes(theme)) {
                        this.metadata.tags.themes.push(theme);
                    }
                }
            }
        }
    }

    /**
     * Update version history
     * @param {string} version - New version string
     */
    updateVersionHistory(version) {
        if (!version) {
            return;
        }

        const versionEntry = {
            version: version,
            timestamp: new Date().toISOString(),
            changes: []
        };

        // Check if this version is already in history
        const existingIndex = this.metadata.versions.findIndex(v => v.version === version);
        if (existingIndex >= 0) {
            this.metadata.versions[existingIndex] = versionEntry;
        } else {
            this.metadata.versions.push(versionEntry);
        }

        // Keep only last 10 versions
        if (this.metadata.versions.length > 10) {
            this.metadata.versions = this.metadata.versions.slice(-10);
        }
    }

    /**
     * Update usage statistics
     */
    updateStats() {
        this.metadata.stats.loadCount++;
        this.metadata.stats.lastAccessed = new Date().toISOString();
    }

    /**
     * Add tag to character
     * @param {string} tag - Tag to add
     * @param {string} category - Tag category (optional, will auto-categorize if not provided)
     * @returns {boolean} Success status
     */
    addTag(tag, category = null) {
        if (!tag || typeof tag !== 'string') {
            return false;
        }

        const categorizedTag = category ? 
            { category, value: tag } : 
            this.categorizeTag(tag);

        if (!categorizedTag) {
            return false;
        }

        const { category: tagCategory, value: tagValue } = categorizedTag;

        // Check if tag already exists
        if (!this.metadata.tags[tagCategory].includes(tagValue)) {
            this.metadata.tags[tagCategory].push(tagValue);
            this.metadata.modified = new Date().toISOString();

            this.eventBus.emit('metadata:tagAdded', {
                characterId: this.metadata.id,
                tag: tagValue,
                category: tagCategory
            });

            return true;
        }

        return false;
    }

    /**
     * Remove tag from character
     * @param {string} tag - Tag to remove
     * @param {string} category - Tag category (optional)
     * @returns {boolean} Success status
     */
    removeTag(tag, category = null) {
        if (!tag || typeof tag !== 'string') {
            return false;
        }

        let removed = false;

        if (category && this.metadata.tags[category]) {
            const index = this.metadata.tags[category].indexOf(tag);
            if (index >= 0) {
                this.metadata.tags[category].splice(index, 1);
                removed = true;
            }
        } else {
            // Search all categories
            for (const [cat, tags] of Object.entries(this.metadata.tags)) {
                const index = tags.indexOf(tag);
                if (index >= 0) {
                    this.metadata.tags[cat].splice(index, 1);
                    removed = true;
                    break;
                }
            }
        }

        if (removed) {
            this.metadata.modified = new Date().toISOString();
            this.eventBus.emit('metadata:tagRemoved', {
                characterId: this.metadata.id,
                tag: tag
            });
        }

        return removed;
    }

    /**
     * Get all tags for a category
     * @param {string} category - Tag category
     * @returns {Array} Array of tags
     */
    getTagsByCategory(category) {
        return this.metadata.tags[category] || [];
    }

    /**
     * Get all tags
     * @returns {Object} All tags organized by category
     */
    getAllTags() {
        return { ...this.metadata.tags };
    }

    /**
     * Search tags across all categories
     * @param {string} query - Search query
     * @returns {Array} Matching tags with category information
     */
    searchTags(query) {
        if (!query || typeof query !== 'string') {
            return [];
        }

        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const [category, tags] of Object.entries(this.metadata.tags)) {
            for (const tag of tags) {
                if (tag.toLowerCase().includes(lowerQuery)) {
                    results.push({ tag, category });
                }
            }
        }

        return results;
    }

    /**
     * Set creator information
     * @param {Object} creatorInfo - Creator information
     */
    setCreatorInfo(creatorInfo) {
        if (!creatorInfo || typeof creatorInfo !== 'object') {
            return false;
        }

        this.metadata.creator = {
            ...this.metadata.creator,
            ...creatorInfo
        };

        this.metadata.modified = new Date().toISOString();

        this.eventBus.emit('metadata:creatorUpdated', {
            characterId: this.metadata.id,
            creator: this.metadata.creator
        });

        return true;
    }

    /**
     * Get creator information
     * @returns {Object} Creator information
     */
    getCreatorInfo() {
        return { ...this.metadata.creator };
    }

    /**
     * Add extension data
     * @param {string} extensionName - Extension name
     * @param {Object} data - Extension data
     */
    addExtensionData(extensionName, data) {
        if (!extensionName || typeof extensionName !== 'string') {
            return false;
        }

        this.metadata.extensions[extensionName] = {
            ...this.metadata.extensions[extensionName],
            ...data,
            lastModified: new Date().toISOString()
        };

        this.metadata.modified = new Date().toISOString();

        this.eventBus.emit('metadata:extensionAdded', {
            characterId: this.metadata.id,
            extension: extensionName,
            data: this.metadata.extensions[extensionName]
        });

        return true;
    }

    /**
     * Get extension data
     * @param {string} extensionName - Extension name
     * @returns {Object|null} Extension data
     */
    getExtensionData(extensionName) {
        return this.metadata.extensions[extensionName] || null;
    }

    /**
     * Get all extension data
     * @returns {Object} All extension data
     */
    getAllExtensionData() {
        return { ...this.metadata.extensions };
    }

    /**
     * Update character rating
     * @param {number} rating - Rating (1-5)
     */
    setRating(rating) {
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            return false;
        }

        this.metadata.stats.rating = rating;
        this.metadata.modified = new Date().toISOString();

        this.eventBus.emit('metadata:ratingUpdated', {
            characterId: this.metadata.id,
            rating: rating
        });

        return true;
    }

    /**
     * Increment favorite count
     */
    incrementFavoriteCount() {
        this.metadata.stats.favoriteCount++;
        this.metadata.modified = new Date().toISOString();

        this.eventBus.emit('metadata:favorited', {
            characterId: this.metadata.id,
            favoriteCount: this.metadata.stats.favoriteCount
        });
    }

    /**
     * Get metadata statistics
     * @returns {Object} Metadata statistics
     */
    getStats() {
        return { ...this.metadata.stats };
    }

    /**
     * Get version history
     * @returns {Array} Version history
     */
    getVersionHistory() {
        return [...this.metadata.versions];
    }

    /**
     * Get complete metadata
     * @returns {Object} Complete metadata object
     */
    getMetadata() {
        return { ...this.metadata };
    }

    /**
     * Generate metadata ID
     * @param {string} name - Character name
     * @returns {string} Generated ID
     */
    generateMetadataId(name) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const sanitizedName = (name || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `meta_${sanitizedName}_${timestamp}_${random}`;
    }

    /**
     * Subscribe to metadata events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        return this.eventBus.subscribe(event, callback);
    }

    /**
     * Unsubscribe from metadata events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    unsubscribe(event, callback) {
        this.eventBus.unsubscribe(event, callback);
    }
}

module.exports = { CharacterMetadata }; 