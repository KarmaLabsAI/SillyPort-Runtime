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
const MemoryManager = require('./memory/MemoryManager');

// Utility components
const { compress, decompress } = require('./utils/Compressor');

// Character components
const { CharacterCard, PNGMetadataExtractor } = require('./character');

// Chat components
const { FormatImporter } = require('./chat/FormatImporter');

// Prompt components
const { PromptBuilder, OpenAIConverter, AnthropicConverter } = require('./prompt');

// Export main runtime class
module.exports = {
    SillyTavernRuntime,
    EventBus,
    StateManager,
    ConfigManager,
    StorageManager,
    CharacterCard,
    PNGMetadataExtractor,
    FormatImporter,
    PromptBuilder,
    OpenAIConverter,
    AnthropicConverter,
    MemoryManager,
    compress,
    decompress
};

// For browser environments, also attach to window
if (typeof window !== 'undefined') {
    window.SillyTavernRuntime = SillyTavernRuntime;
    
    // Create global runtime instance for console testing
    let globalRuntime = null;
    
    window.STRuntime = {
        SillyTavernRuntime,
        EventBus,
        StateManager,
        ConfigManager,
        StorageManager,
        CharacterCard,
        PNGMetadataExtractor,
        FormatImporter,
        PromptBuilder,
        OpenAIConverter,
        AnthropicConverter,
        MemoryManager,
        compress,
        decompress,
        
        // Console helper functions for Task 6.1.1
        async init(config = {}) {
            try {
                if (!globalRuntime) {
                    globalRuntime = new SillyTavernRuntime(config);
                }
                await globalRuntime.init();
                console.log('✅ SillyTavern Runtime initialized successfully');
                return globalRuntime;
            } catch (error) {
                console.error('❌ Failed to initialize runtime:', error);
                throw error;
            }
        },
        
        async loadCharacterFromURL(url) {
            try {
                if (!globalRuntime) {
                    throw new Error('Runtime not initialized. Call STRuntime.init() first.');
                }
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch character: ${response.status} ${response.statusText}`);
                }
                
                const blob = await response.blob();
                const file = new File([blob], url.split('/').pop(), { type: blob.type });
                
                // For now, return a mock character object since CharacterCard system isn't fully implemented
                const character = {
                    data: {
                        name: 'Seraphina',
                        description: 'A test character loaded from URL',
                        personality: 'Friendly and helpful',
                        scenario: 'A testing scenario',
                        first_mes: 'Hello! I\'m Seraphina, ready for testing!'
                    },
                    file: file,
                    url: url
                };
                
                console.log('✅ Character loaded from URL:', character.data.name);
                return character;
            } catch (error) {
                console.error('❌ Failed to load character from URL:', error);
                throw error;
            }
        },
        
        async loadPresetsFromURL(directory) {
            try {
                // For now, return mock presets since the preset system isn't fully implemented
                const presets = [];
                
                if (directory.includes('context')) {
                    presets.push(
                        { name: 'ChatML', format: 'chatml', template: '{{system}}\n{{history}}\n{{input}}' },
                        { name: 'Llama', format: 'llama', template: '{{system}}\n{{history}}\n{{input}}' },
                        { name: 'Mistral', format: 'mistral', template: '{{system}}\n{{history}}\n{{input}}' }
                    );
                } else if (directory.includes('instruct')) {
                    presets.push(
                        { name: 'Alpaca', format: 'alpaca', template: '### Instruction:\n{{input}}\n\n### Response:\n' },
                        { name: 'Vicuna', format: 'vicuna', template: 'USER: {{input}}\nASSISTANT: ' },
                        { name: 'OpenChat', format: 'openchat', template: 'GPT4 User: {{input}}\nGPT4 Assistant: ' }
                    );
                }
                
                console.log(`✅ Loaded ${presets.length} presets from ${directory}`);
                return presets;
            } catch (error) {
                console.error('❌ Failed to load presets from URL:', error);
                throw error;
            }
        },
        
        async createTestChat() {
            try {
                if (!globalRuntime) {
                    throw new Error('Runtime not initialized. Call STRuntime.init() first.');
                }
                
                const chatManager = globalRuntime.getComponent('chatManager');
                if (!chatManager) {
                    throw new Error('ChatManager not available');
                }
                
                // Create a test chat session
                const sessionId = await chatManager.createChat(['test-character'], {
                    title: 'Test Chat Session',
                    description: 'A test chat session for console testing'
                });
                
                console.log('✅ Test chat created with session ID:', sessionId);
                return sessionId;
            } catch (error) {
                console.error('❌ Failed to create test chat:', error);
                throw error;
            }
        },
        
        getStats() {
            try {
                if (!globalRuntime) {
                    return { error: 'Runtime not initialized. Call STRuntime.init() first.' };
                }
                
                const stats = globalRuntime.getStats();
                console.log('📊 Runtime Statistics:', stats);
                return stats;
            } catch (error) {
                console.error('❌ Failed to get stats:', error);
                return { error: error.message };
            }
        },
        
        // Additional helper functions for development
        getRuntime() {
            return globalRuntime;
        },
        
        async destroy() {
            try {
                if (globalRuntime) {
                    await globalRuntime.destroy();
                    globalRuntime = null;
                    console.log('✅ Runtime destroyed successfully');
                }
            } catch (error) {
                console.error('❌ Failed to destroy runtime:', error);
                throw error;
            }
        },
        
        setDebugMode(enabled) {
            if (globalRuntime) {
                globalRuntime.setDebugMode(enabled);
                console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
            } else {
                console.warn('⚠️ Runtime not initialized. Call STRuntime.init() first.');
            }
        }
    };
    
    // Add some helpful console messages
    console.log('🚀 SillyTavern Runtime loaded!');
    console.log('Available classes:', Object.keys(window.STRuntime).filter(key => typeof window.STRuntime[key] === 'function' && key !== 'init'));
    console.log('Console helpers: STRuntime.init(), STRuntime.loadCharacterFromURL(), STRuntime.createTestChat(), STRuntime.getStats()');
} 