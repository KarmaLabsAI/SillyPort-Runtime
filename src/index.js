/**
 * SillyTavern Browser Runtime - Main Entry Point
 * 
 * Exports the main runtime class and all core components for easy importing.
 */

// Core components
const EventBus = require('./core/EventBus');
const StateManager = require('./core/StateManager');
const ConfigManager = require('./core/ConfigManager');
const StorageManager = require('./core/StorageManager');
const SillyTavernRuntime = require('./core/SillyTavernRuntime');

// Character components
const { CharacterCard, PNGMetadataExtractor } = require('./character');

// Chat components
const { FormatImporter } = require('./chat/FormatImporter');

// Export main runtime class
module.exports = {
    SillyTavernRuntime,
    EventBus,
    StateManager,
    ConfigManager,
    StorageManager,
    CharacterCard,
    PNGMetadataExtractor,
    FormatImporter
};

// For browser environments, also attach to window
if (typeof window !== 'undefined') {
    window.SillyTavernRuntime = SillyTavernRuntime;
    window.STRuntime = {
        SillyTavernRuntime,
        EventBus,
        StateManager,
        ConfigManager,
        StorageManager,
        CharacterCard,
        PNGMetadataExtractor,
        FormatImporter
    };
} 