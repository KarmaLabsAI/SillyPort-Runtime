/**
 * Character Card System
 * 
 * Handles character card loading, parsing, validation, and format conversion.
 * Supports Character Card V2 specification with comprehensive validation.
 * 
 * Task 2.2.2: Character Card Validation
 */

const { PNGMetadataExtractor } = require('./PNGMetadataExtractor.js');

class CharacterCard {
    constructor(data = null) {
        this.data = data;
        this.metadata = {};
        this.validationErrors = [];
        this.isValidated = false;
        
        // Character Card V2 Schema
        this.V2_SCHEMA = {
            // Required fields
            required: ['name', 'description', 'personality', 'scenario', 'first_mes'],
            
            // Field types and constraints
            fields: {
                name: { type: 'string', maxLength: 100, required: true },
                description: { type: 'string', maxLength: 2000, required: true },
                personality: { type: 'string', maxLength: 2000, required: true },
                scenario: { type: 'string', maxLength: 2000, required: true },
                first_mes: { type: 'string', maxLength: 2000, required: true },
                
                // Optional fields
                mes_example: { type: 'string', maxLength: 2000, required: false },
                creator_notes: { type: 'string', maxLength: 2000, required: false },
                system_prompt: { type: 'string', maxLength: 2000, required: false },
                post_history_instructions: { type: 'string', maxLength: 2000, required: false },
                tags: { type: 'array', maxLength: 50, required: false },
                creator: { type: 'string', maxLength: 100, required: false },
                character_version: { type: 'string', maxLength: 50, required: false },
                alternate_greetings: { type: 'array', maxLength: 10, required: false },
                extensions: { type: 'object', required: false }
            },
            
            // Size limits
            maxTotalSize: 1024 * 1024, // 1MB total
            maxFieldSize: 2000, // 2000 characters per field
            
            // Security patterns
            securityPatterns: {
                scriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                javascriptProtocol: /javascript:/gi,
                dataProtocol: /data:/gi,
                vbscriptProtocol: /vbscript:/gi
            }
        };
    }

    /**
     * Create CharacterCard from PNG file
     * @param {File|Blob} file - PNG file with embedded character data
     * @returns {Promise<CharacterCard>} CharacterCard instance
     */
    static async fromPNG(file) {
        const extractor = new PNGMetadataExtractor();
        const metadata = await extractor.extract(file);
        
        let characterData = null;
        
        // Try V2 format first (chara chunk)
        if (metadata.chara) {
            characterData = metadata.chara;
        }
        // Fallback to V3 format (ccv3 chunk)
        else if (metadata.ccv3) {
            characterData = metadata.ccv3;
        }
        else {
            throw new Error('No character data found in PNG file');
        }
        
        const card = new CharacterCard(characterData);
        card.metadata = metadata;
        
        return card;
    }

    /**
     * Create CharacterCard from JSON data
     * @param {Object|string} data - Character data as object or JSON string
     * @returns {CharacterCard} CharacterCard instance
     */
    static fromJSON(data) {
        let parsedData;
        
        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                throw new Error(`Invalid JSON data: ${error.message}`);
            }
        } else {
            parsedData = data;
        }
        
        return new CharacterCard(parsedData);
    }

    /**
     * Validate character card data
     * @returns {boolean} True if valid, false otherwise
     */
    validate() {
        this.validationErrors = [];
        
        if (!this.data) {
            this.validationErrors.push('No character data provided');
            return false;
        }
        
        // Check required fields
        this.validateRequiredFields();
        
        // Validate field types and constraints
        this.validateFieldTypes();
        
        // Check size limits
        this.validateSizeLimits();
        
        // Security validation
        this.validateSecurity();
        
        // Check for unknown fields
        this.validateUnknownFields();
        
        this.isValidated = true;
        return this.validationErrors.length === 0;
    }

    /**
     * Validate required fields
     */
    validateRequiredFields() {
        for (const field of this.V2_SCHEMA.required) {
            if (!this.data.hasOwnProperty(field) || 
                this.data[field] === null || 
                this.data[field] === undefined ||
                (typeof this.data[field] === 'string' && this.data[field].trim() === '')) {
                this.validationErrors.push(`Required field '${field}' is missing or empty`);
            }
        }
    }

    /**
     * Validate field types and constraints
     */
    validateFieldTypes() {
        for (const [fieldName, fieldConfig] of Object.entries(this.V2_SCHEMA.fields)) {
            if (!this.data.hasOwnProperty(fieldName)) {
                continue; // Skip missing optional fields
            }
            
            const value = this.data[fieldName];
            
            // Type validation
            if (!this.validateFieldType(value, fieldConfig.type)) {
                this.validationErrors.push(`Field '${fieldName}' has invalid type. Expected ${fieldConfig.type}, got ${typeof value}`);
                continue;
            }
            
            // Length validation for strings
            if (fieldConfig.type === 'string' && typeof value === 'string') {
                if (value.length > fieldConfig.maxLength) {
                    this.validationErrors.push(`Field '${fieldName}' exceeds maximum length of ${fieldConfig.maxLength} characters`);
                }
            }
            
            // Array length validation
            if (fieldConfig.type === 'array' && Array.isArray(value)) {
                if (value.length > fieldConfig.maxLength) {
                    this.validationErrors.push(`Field '${fieldName}' exceeds maximum array length of ${fieldConfig.maxLength} items`);
                }
            }
        }
    }

    /**
     * Validate field type
     * @param {*} value - Field value
     * @param {string} expectedType - Expected type
     * @returns {boolean} True if type matches
     */
    validateFieldType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            default:
                return true; // Unknown type, skip validation
        }
    }

    /**
     * Validate size limits
     */
    validateSizeLimits() {
        const totalSize = JSON.stringify(this.data).length;
        
        if (totalSize > this.V2_SCHEMA.maxTotalSize) {
            this.validationErrors.push(`Character data exceeds maximum size of ${this.V2_SCHEMA.maxTotalSize} bytes`);
        }
        
        // Check individual field sizes
        for (const [fieldName, value] of Object.entries(this.data)) {
            if (typeof value === 'string' && value.length > this.V2_SCHEMA.maxFieldSize) {
                this.validationErrors.push(`Field '${fieldName}' exceeds maximum field size of ${this.V2_SCHEMA.maxFieldSize} characters`);
            }
        }
    }

    /**
     * Security validation to prevent XSS and injection attacks
     */
    validateSecurity() {
        for (const [fieldName, value] of Object.entries(this.data)) {
            if (typeof value === 'string') {
                // Check for script tags
                if (this.V2_SCHEMA.securityPatterns.scriptTags.test(value)) {
                    this.validationErrors.push(`Field '${fieldName}' contains potentially dangerous script tags`);
                }
                
                // Check for dangerous protocols
                if (this.V2_SCHEMA.securityPatterns.javascriptProtocol.test(value)) {
                    this.validationErrors.push(`Field '${fieldName}' contains javascript: protocol`);
                }
                
                if (this.V2_SCHEMA.securityPatterns.dataProtocol.test(value)) {
                    this.validationErrors.push(`Field '${fieldName}' contains data: protocol`);
                }
                
                if (this.V2_SCHEMA.securityPatterns.vbscriptProtocol.test(value)) {
                    this.validationErrors.push(`Field '${fieldName}' contains vbscript: protocol`);
                }
            }
        }
    }

    /**
     * Validate unknown fields (warn about non-standard fields)
     */
    validateUnknownFields() {
        const knownFields = Object.keys(this.V2_SCHEMA.fields);
        
        for (const fieldName of Object.keys(this.data)) {
            if (!knownFields.includes(fieldName)) {
                // Don't add to validation errors, just log a warning
                console.warn(`Unknown field '${fieldName}' in character data`);
            }
        }
    }

    /**
     * Get validation errors
     * @returns {Array} Array of validation error messages
     */
    getValidationErrors() {
        if (!this.isValidated) {
            this.validate();
        }
        return [...this.validationErrors];
    }

    /**
     * Check if character card is valid
     * @returns {boolean} True if valid
     */
    isValid() {
        if (!this.isValidated) {
            this.validate();
        }
        return this.validationErrors.length === 0;
    }

    /**
     * Get character data
     * @returns {Object} Character data object
     */
    getData() {
        return { ...this.data };
    }

    /**
     * Get specific field value
     * @param {string} field - Field name
     * @returns {*} Field value
     */
    getField(field) {
        return this.data[field];
    }

    /**
     * Set field value (with validation)
     * @param {string} field - Field name
     * @param {*} value - Field value
     * @returns {boolean} True if set successfully
     */
    setField(field, value) {
        const fieldConfig = this.V2_SCHEMA.fields[field];
        
        if (!fieldConfig) {
            console.warn(`Unknown field '${field}'`);
            return false;
        }
        
        // Validate type
        if (!this.validateFieldType(value, fieldConfig.type)) {
            console.error(`Invalid type for field '${field}'. Expected ${fieldConfig.type}, got ${typeof value}`);
            return false;
        }
        
        // Validate length for strings
        if (fieldConfig.type === 'string' && typeof value === 'string') {
            if (value.length > fieldConfig.maxLength) {
                console.error(`Field '${field}' exceeds maximum length of ${fieldConfig.maxLength} characters`);
                return false;
            }
        }
        
        this.data[field] = value;
        this.isValidated = false; // Reset validation state
        
        return true;
    }

    /**
     * Convert to JSON string
     * @returns {string} JSON representation
     */
    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Get character metadata
     * @returns {Object} Metadata object
     */
    getMetadata() {
        return { ...this.metadata };
    }

    /**
     * Sanitize character data for safe display
     * @returns {Object} Sanitized data object
     */
    sanitize() {
        const sanitized = {};
        
        for (const [field, value] of Object.entries(this.data)) {
            if (typeof value === 'string') {
                // Basic HTML escaping
                sanitized[field] = value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            } else {
                sanitized[field] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Load emotion sprite (placeholder for future implementation)
     * @param {File|Blob} file - Emotion sprite file
     * @returns {Promise<Object>} Emotion sprite data
     */
    static async loadEmotionSprite(file) {
        // This is a placeholder for future emotion sprite loading
        // Will be implemented in Task 2.3.1: Character Collection
        return {
            name: file.name || 'unknown',
            type: file.type || 'image/png',
            size: file.size || 0,
            timestamp: Date.now()
        };
    }
}

module.exports = { CharacterCard }; 