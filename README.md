# SillyTavern Browser Runtime

A browser-based, embeddable SillyTavern runtime that provides core character interaction functionality without requiring server-side infrastructure. The runtime is designed to be portable, configurable, and testable directly in the browser console.

## 🚀 Features

- **Local-First**: All data processing happens in the browser with no external dependencies
- **Embeddable**: Can be integrated into any web application as a module
- **Configurable**: Flexible configuration system for customizing behavior
- **Testable**: Console-friendly API for development and debugging
- **Modular**: Clean separation of concerns with well-defined interfaces

## 🏗️ Architecture

```
SillyTavernRuntime
├── Core/
│   ├── EventBus ✅           # Event system (Complete)
│   ├── StateManager         # Central state management
│   ├── ConfigManager        # Configuration handling
│   └── RuntimeAPI           # Public API
├── Character/
│   ├── CharacterCard        # Character card system
│   ├── CardParser           # PNG/JSON/YAML parsing
│   ├── CardValidator        # Validation system
│   └── CardConverter        # Format conversion
├── Chat/
│   ├── ChatManager          # Chat session management
│   ├── MessageFormatter     # Message formatting
│   ├── FormatImporter       # Import various formats
│   └── GroupChatManager     # Multi-character conversations
├── Prompt/
│   ├── PromptBuilder        # Prompt construction
│   ├── PromptConverter      # Format conversion
│   ├── TemplateEngine       # Template processing
│   └── ContextManager       # Context window management
├── Memory/
│   ├── MemoryManager        # Memory allocation
│   ├── CacheManager         # Caching strategies
│   └── StorageManager       # IndexedDB interface
└── Utils/
    ├── FileHandler          # File operations
    ├── ImageProcessor       # PNG processing
    ├── Compressor           # Data compression
    └── Validator            # Data validation
```

## 🎯 Current Status

### Phase 1: Core Infrastructure (Weeks 1-2)
- [x] **EventBus System** - Complete with comprehensive testing
- [ ] StateManager implementation
- [ ] ConfigManager
- [ ] StorageManager (IndexedDB)
- [ ] Basic runtime initialization

### Upcoming Phases
- **Phase 2**: Character System (PNG metadata, character cards)
- **Phase 3**: Chat System (session management, format import)
- **Phase 4**: Prompt System (prompt building, format conversion)
- **Phase 5**: Memory & Performance (caching, optimization)
- **Phase 6**: Testing & Polish (console interface, documentation)

## 🧪 Testing

### EventBus Testing (Complete)
The EventBus system has been fully implemented and tested with:
- ✅ 27 passing tests covering all acceptance criteria
- ✅ Memory leak prevention
- ✅ Error handling and edge cases
- ✅ Advanced features (namespacing, one-time listeners)
- ✅ Async event handling
- ✅ Debug mode and statistics

### Running Tests

```bash
# Run all tests
npx jest

# Run EventBus tests specifically
npx jest tests/EventBus.test.js

# Run tests in browser
open test.html
```

### Manual Console Testing

```javascript
// Test basic event functionality
const eventBus = new EventBus();
eventBus.subscribe('test', (data) => console.log('Received:', data));
eventBus.emit('test', { message: 'Hello World' });
```

## 📁 Project Structure

```
zillyos-runtime/
├── src/
│   ├── core/
│   │   └── EventBus.js      # ✅ Complete event system
│   ├── character/           # Character card system
│   ├── chat/               # Chat management
│   ├── prompt/             # Prompt building
│   ├── memory/             # Memory management
│   └── utils/              # Utility functions
├── tests/
│   └── EventBus.test.js    # ✅ Comprehensive test suite
├── test-data/              # Test resources and examples
│   ├── characters/         # Test character cards
│   ├── presets/           # Context and instruction presets
│   ├── config/            # Configuration templates
│   └── assets/            # Example assets
├── test.html              # Browser testing interface
├── sillytavern-runtime-spec.md  # Complete specification
└── README.md              # This file
```

## 🔧 Technology Stack

- **Runtime**: Modern browsers (Chrome/Edge 90+, Firefox 88+, Safari 14+)
- **Storage**: IndexedDB for persistent data
- **File Processing**: Native File API
- **State Management**: Event-driven reactive architecture
- **Format Support**: JSON, YAML, PNG metadata parsing
- **Testing**: Jest for unit tests, browser console for integration

## 📊 Test Data

The project includes comprehensive test data for development and validation:

### Character Resources
- `test-data/characters/default_Seraphina.png` - Character Card V2 with embedded metadata (539KB)
- `test-data/characters/Seraphina/` - 28 emotion sprites for testing

### Configuration Templates
- `test-data/config/server-config.yaml` - Complete server configuration
- `test-data/config/client-settings.json` - Full client settings

### Preset Collections
- `test-data/presets/context/` - 30+ context templates
- `test-data/presets/instruct/` - 30+ instruction formats

### Asset Examples
- `test-data/assets/world-info-example.json` - World info structure
- `test-data/assets/user-default.png` - Default user avatar

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zillyos-runtime
   ```

2. **Test the EventBus system**
   ```bash
   # Run unit tests
   npx jest tests/EventBus.test.js
   
   # Or open test.html in browser for interactive testing
   ```

3. **Explore the test data**
   ```bash
   # Validate test resources
   cd test-data
   node validate-resources.js
   ```

## 🎮 Console Testing

The runtime is designed to be testable directly in the browser console:

```javascript
// Load EventBus
const eventBus = new EventBus();

// Enable debug mode
eventBus.setDebugMode(true);

// Test multiple listeners
eventBus.subscribe('demo', (data) => console.log('Listener 1:', data));
eventBus.subscribe('demo', (data) => console.log('Listener 2:', data));

// Emit event
eventBus.emit('demo', { message: 'Testing multiple listeners' });

// Check statistics
console.log('Stats:', eventBus.getStats());
```

## 🔍 Development

### Code Quality
- ES6+ JavaScript with comprehensive documentation
- Modular architecture with clear separation of concerns
- Extensive error handling and validation
- Memory leak prevention and cleanup

### Testing Strategy
- Unit tests for all core components
- Integration tests for component interaction
- Console testing for manual validation
- Performance tests for memory and speed

## 📖 Documentation

- **[Specification](sillytavern-runtime-spec.md)** - Complete technical specification
- **[Task Breakdown](.project/tasks/task-breakdown.md)** - Detailed development roadmap
- **[API Documentation]** - Coming soon with StateManager implementation

## 🤝 Contributing

This project follows a structured development approach:

1. **Phase-based Development** - Components are built in logical phases
2. **Test-Driven Development** - All components must pass comprehensive tests
3. **Console Testing** - Manual testing capabilities for each component
4. **Documentation First** - Clear specifications before implementation

## 📝 License

This project is part of the SillyTavern ecosystem and follows the same licensing terms.

## 🔗 Related Projects

- **SillyTavern** - The main SillyTavern application
- **Character Card Specification** - Standard for character data format
- **Test Data Collection** - Comprehensive test resources for development

---

**Status**: Early Development - EventBus system complete, StateManager in progress

For detailed technical information, see the [specification document](sillytavern-runtime-spec.md). 