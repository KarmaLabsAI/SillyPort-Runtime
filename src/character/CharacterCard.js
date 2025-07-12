/**
 * Character Card System
 * 
 * Handles character card loading, parsing, validation, and format conversion.
 * Supports Character Card V2 specification with comprehensive validation.
 * 
 * Task 2.2.2: Character Card Validation
 * Task 2.2.3: Format Conversion
 */

const { PNGMetadataExtractor } = require('./PNGMetadataExtractor.js');
const yaml = require('js-yaml');

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
        const metadataResult = await extractor.extract(file);

        let characterData = null;
        let metadata = {};

        // Try V2 format first (chara chunk)
        if (metadataResult.chara) {
            characterData = metadataResult.chara;
        }
        // Fallback to V3 format (ccv3 chunk)
        else if (metadataResult.ccv3) {
            characterData = metadataResult.ccv3;
        }
        else {
            throw new Error('No character data found in PNG file');
        }

        // If the extractor result has a 'metadata' property, use it as metadata
        if (metadataResult.metadata) {
            metadata = metadataResult.metadata;
        } else {
            // Otherwise, use all other keys except chara/ccv3 as metadata
            metadata = { ...metadataResult };
            delete metadata.chara;
            delete metadata.ccv3;
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
        
        // Extract metadata if present
        let metadata = {};
        let characterData = { ...parsedData };
        
        if (parsedData._metadata) {
            metadata = { ...parsedData._metadata };
            // Remove conversion info from metadata to avoid duplication
            delete metadata.conversion;
            delete characterData._metadata;
        }
        
        if (parsedData._conversion) {
            delete characterData._conversion;
        }
        
        const card = new CharacterCard(characterData);
        card.metadata = metadata;
        
        return card;
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

    // Task 2.2.3: Format Conversion Methods

    /**
     * Convert character card to JSON format
     * @param {Object} options - Conversion options
     * @param {boolean} options.pretty - Whether to format with indentation
     * @param {boolean} options.includeMetadata - Whether to include PNG metadata
     * @returns {string} JSON representation
     */
    toJSONFormat(options = {}) {
        const { pretty = true, includeMetadata = false } = options;
        
        let outputData = { ...this.data };
        
        // Always include _metadata if requested
        if (includeMetadata) {
            outputData._metadata = this.metadata ? { ...this.metadata } : {};
            outputData._metadata.conversion = {
                timestamp: new Date().toISOString(),
                source: 'png',
                target: 'json',
                version: '2.0'
            };
        }
        
        // Add conversion metadata
        outputData._conversion = {
            timestamp: new Date().toISOString(),
            source: 'png',
            target: 'json',
            version: '2.0'
        };
        
        return pretty ? JSON.stringify(outputData, null, 2) : JSON.stringify(outputData);
    }

    /**
     * Convert character card to YAML format
     * @param {Object} options - Conversion options
     * @param {boolean} options.includeMetadata - Whether to include PNG metadata
     * @param {number} options.indent - YAML indentation level
     * @returns {string} YAML representation
     */
    toYAMLFormat(options = {}) {
        const { includeMetadata = false, indent = 2 } = options;
        
        let outputData = { ...this.data };
        
        // Always include _metadata if requested
        if (includeMetadata) {
            outputData._metadata = this.metadata ? { ...this.metadata } : {};
            outputData._metadata.conversion = {
                timestamp: new Date().toISOString(),
                source: 'png',
                target: 'yaml',
                version: '2.0'
            };
        }
        
        // Add conversion metadata
        outputData._conversion = {
            timestamp: new Date().toISOString(),
            source: 'png',
            target: 'yaml',
            version: '2.0'
        };
        
        try {
            return yaml.dump(outputData, {
                indent: Math.max(1, Math.min(8, indent || 2)), // Ensure valid indent range
                lineWidth: 120,
                noRefs: true,
                sortKeys: true
            });
        } catch (error) {
            throw new Error(`YAML conversion failed: ${error.message}`);
        }
    }

    /**
     * Create CharacterCard from YAML data
     * @param {string} yamlData - YAML string
     * @returns {CharacterCard} CharacterCard instance
     */
    static fromYAML(yamlData) {
        if (typeof yamlData !== 'string') {
            throw new Error('YAML data must be a string');
        }
        
        try {
            const parsedData = yaml.load(yamlData);
            
            if (!parsedData || typeof parsedData !== 'object') {
                throw new Error('Invalid YAML data: must be an object');
            }
            
            // Extract metadata if present
            let metadata = {};
            let characterData = { ...parsedData };
            
            if (parsedData._metadata) {
                metadata = { ...parsedData._metadata };
                // Remove conversion info from metadata to avoid duplication
                delete metadata.conversion;
                delete characterData._metadata;
            }
            
            if (parsedData._conversion) {
                delete characterData._conversion;
            }
            
            const card = new CharacterCard(characterData);
            card.metadata = metadata;
            
            return card;
        } catch (error) {
            throw new Error(`YAML parsing failed: ${error.message}`);
        }
    }

    /**
     * Convert PNG character card to JSON format
     * @param {File|Blob} pngFile - PNG file with embedded character data
     * @param {Object} options - Conversion options
     * @param {boolean} options.pretty - Whether to format with indentation
     * @param {boolean} options.includeMetadata - Whether to include PNG metadata
     * @returns {Promise<string>} JSON representation
     */
    static async pngToJSON(pngFile, options = {}) {
        const card = await CharacterCard.fromPNG(pngFile);
        return card.toJSONFormat(options);
    }

    /**
     * Convert PNG character card to YAML format
     * @param {File|Blob} pngFile - PNG file with embedded character data
     * @param {Object} options - Conversion options
     * @param {boolean} options.includeMetadata - Whether to include PNG metadata
     * @param {number} options.indent - YAML indentation level
     * @returns {Promise<string>} YAML representation
     */
    static async pngToYAML(pngFile, options = {}) {
        const card = await CharacterCard.fromPNG(pngFile);
        return card.toYAMLFormat(options);
    }

    /**
     * Convert JSON character card to YAML format
     * @param {Object|string} jsonData - Character data as object or JSON string
     * @param {Object} options - Conversion options
     * @param {boolean} options.includeMetadata - Whether to include metadata
     * @param {number} options.indent - YAML indentation level
     * @returns {string} YAML representation
     */
    static jsonToYAML(jsonData, options = {}) {
        const card = CharacterCard.fromJSON(jsonData);
        return card.toYAMLFormat(options);
    }

    /**
     * Convert YAML character card to JSON format
     * @param {string} yamlData - YAML string
     * @param {Object} options - Conversion options
     * @param {boolean} options.pretty - Whether to format with indentation
     * @param {boolean} options.includeMetadata - Whether to include metadata
     * @returns {string} JSON representation
     */
    static yamlToJSON(yamlData, options = {}) {
        const card = CharacterCard.fromYAML(yamlData);
        return card.toJSONFormat(options);
    }

    /**
     * Get format conversion statistics
     * @returns {Object} Conversion statistics
     */
    getConversionStats() {
        const originalSize = JSON.stringify(this.data).length;
        const jsonSize = this.toJSONFormat({ pretty: false }).length;
        const yamlSize = this.toYAMLFormat().length;
        
        const stats = {
            sourceFormat: 'png',
            targetFormats: ['json', 'yaml'],
            dataSize: {
                original: originalSize,
                json: jsonSize,
                yaml: yamlSize
            },
            compressionRatio: {
                json: 0,
                yaml: 0
            },
            metadata: {
                hasMetadata: !!(this.metadata && Object.keys(this.metadata).length > 0),
                metadataSize: this.metadata && Object.keys(this.metadata).length > 0 ? JSON.stringify(this.metadata).length : 0
            }
        };
        
        // Calculate compression ratios (percentage of original size)
        stats.compressionRatio.json = originalSize > 0 ? (jsonSize / originalSize) * 100 : 0;
        stats.compressionRatio.yaml = originalSize > 0 ? (yamlSize / originalSize) * 100 : 0;
        
        return stats;
    }

    /**
     * Optimize character data for specific format
     * @param {string} format - Target format ('json', 'yaml')
     * @param {Object} options - Optimization options
     * @returns {Object} Optimized character data
     */
    optimizeForFormat(format, options = {}) {
        const optimized = { ...this.data };
        
        switch (format.toLowerCase()) {
            case 'json':
                // JSON optimizations
                if (options.removeEmptyFields) {
                    Object.keys(optimized).forEach(key => {
                        if (optimized[key] === null || optimized[key] === undefined || 
                            (typeof optimized[key] === 'string' && optimized[key].trim() === '')) {
                            delete optimized[key];
                        }
                    });
                }
                break;
                
            case 'yaml':
                // YAML optimizations
                if (options.preserveComments) {
                    // YAML supports comments, so we can keep more metadata
                    optimized._format = 'yaml';
                    optimized._optimized = true;
                }
                break;
                
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        
        return optimized;
    }
}

module.exports = { CharacterCard }; 