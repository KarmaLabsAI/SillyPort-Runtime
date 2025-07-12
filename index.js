/**
 * SillyTavern Browser Runtime - Main Entry Point
 * 
 * This module exports the main runtime class and all core components
 * for use in browser environments and Node.js testing.
 */

// Export the main runtime class
const SillyTavernRuntime = require('./src/core/SillyTavernRuntime');

// Export core components for direct access
const EventBus = require('./src/core/EventBus');
const StateManager = require('./src/core/StateManager');
const ConfigManager = require('./src/core/ConfigManager');
const StorageManager = require('./src/core/StorageManager');
const ChatManager = require('./src/chat/ChatManager');
const { FormatImporter } = require('./src/chat/FormatImporter');

// Export everything
module.exports = {
    SillyTavernRuntime,
    EventBus,
    StateManager,
    ConfigManager,
    StorageManager,
    ChatManager,
    FormatImporter
};

// For browser environments, attach to global object
if (typeof window !== 'undefined') {
    window.SillyTavernRuntime = SillyTavernRuntime;
    window.EventBus = EventBus;
    window.StateManager = StateManager;
    window.ConfigManager = ConfigManager;
    window.StorageManager = StorageManager;
    window.ChatManager = ChatManager;
    window.FormatImporter = FormatImporter;
} 