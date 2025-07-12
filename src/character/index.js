/**
 * Character Module
 * 
 * Exports character-related classes and utilities.
 */

const { CharacterCard } = require('./CharacterCard.js');
const { PNGMetadataExtractor } = require('./PNGMetadataExtractor.js');
const { CharacterManager } = require('./CharacterManager.js');
const { CharacterMetadata } = require('./CharacterMetadata.js');

module.exports = {
    CharacterCard,
    PNGMetadataExtractor,
    CharacterManager,
    CharacterMetadata
}; 