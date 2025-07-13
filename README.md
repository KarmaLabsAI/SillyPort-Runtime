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
│   ├── StateManager ✅       # Central state management (Complete)
│   ├── ConfigManager ✅      # Configuration handling (Complete)
│   ├── StorageManager ✅     # IndexedDB interface (Complete)
│   └── SillyTavernRuntime ✅ # Public API (Complete)
├── Character/
│   ├── CharacterCard ✅      # Character card system (Complete)
│   ├── PNGMetadataExtractor ✅ # PNG/JSON/YAML parsing (Complete)
│   ├── CardValidator ✅      # Validation system (Complete)
│   └── CardConverter ✅      # Format conversion (Complete)
├── Chat/
│   ├── ChatManager ✅        # Chat session management (Complete)
│   ├── MessageFormatter ✅   # Message formatting (Complete)
│   ├── FormatImporter ✅     # Import various formats (Complete)
│   └── GroupChatManager ✅   # Multi-character conversations (Complete)
├── Prompt/
│   ├── PromptBuilder ✅      # Prompt construction (Complete)
│   ├── OpenAIConverter ✅    # OpenAI format conversion (Complete)
│   ├── AnthropicConverter ✅ # Claude format conversion (Complete)
│   ├── TemplateEngine ✅     # Template processing (Complete)
│   └── ContextManager ✅     # Context window management (Complete)
├── Memory/
│   ├── MemoryManager        # Memory allocation
│   ├── CacheManager         # Caching strategies
│   └── StorageManager ✅     # IndexedDB interface (Complete)
└── Utils/
    ├── FileHandler          # File operations
    ├── ImageProcessor       # PNG processing
    ├── Compressor           # Data compression
    └── Validator            # Data validation
```

## 🎯 Current Status

### ✅ Phase 1: Core Infrastructure (Complete)
- [x] **EventBus System** - Complete with comprehensive testing
- [x] **StateManager** - Complete with reactive state management
- [x] **ConfigManager** - Complete with hierarchical configuration
- [x] **StorageManager** - Complete with IndexedDB integration
- [x] **SillyTavernRuntime** - Complete with full initialization

### ✅ Phase 2: Character System (Complete)
- [x] **PNG Metadata Extraction** - Complete with browser-native parsing
- [x] **Character Card System** - Complete with V2 specification support
- [x] **Character Management** - Complete with collection and caching
- [x] **Format Conversion** - Complete with PNG/JSON/YAML support

### ✅ Phase 3: Chat System (Complete)
- [x] **Chat Session Management** - Complete with multi-participant support
- [x] **Message Management** - Complete with CRUD operations
- [x] **Group Chat Support** - Complete with turn-based conversations
- [x] **Format Import** - Complete with Oobabooga, Agnai, CAI Tools, and native formats

### ✅ Phase 4: Prompt System (Complete)
- [x] **Prompt Builder** - Complete with context assembly and optimization
- [x] **Template Engine** - Complete with variable substitution and conditionals
- [x] **Context Optimization** - Complete with token counting and prioritization
- [x] **OpenAI Format Support** - Complete with ChatML conversion
- [x] **Anthropic Format Support** - Complete with Claude conversion

### 🔄 Phase 5: Memory & Performance (In Progress)
- [ ] Memory Management
- [ ] Cache Management
- [ ] Lazy Loading
- [ ] Data Compression

### 📋 Phase 6: Testing & Polish (In Progress)
- [x] Console Testing Interface
- [x] Comprehensive Test Suite
- [ ] Performance Optimization
- [ ] Documentation

## 🧪 Testing

### Comprehensive Test Coverage
The project has extensive test coverage with:
- ✅ **EventBus**: 27 tests covering all acceptance criteria
- ✅ **StateManager**: Complete test suite with reactive updates
- ✅ **ConfigManager**: Configuration validation and persistence tests
- ✅ **StorageManager**: IndexedDB integration and browser compatibility
- ✅ **CharacterCard**: PNG parsing and format conversion tests
- ✅ **ChatManager**: Session management and message handling tests
- ✅ **FormatImporter**: Multi-format import and conversion tests
- ✅ **PromptBuilder**: Context assembly and optimization tests
- ✅ **OpenAIConverter**: ChatML format conversion tests
- ✅ **AnthropicConverter**: Claude format conversion tests (32 tests)

### Running Tests

```bash
# Run Node.js tests (Jest)
npm test                    # Run all Node.js tests
npm run test:node          # Run only Node.js-safe tests
npm run test:watch         # Run tests in watch mode

# Run browser tests
# Open browser-tests.html in your browser
# Or use the test server:
python3 -m http.server 8000
# Then visit http://localhost:8000/browser-tests.html
```

### Test Organization

The project uses a compartmentalized testing approach:

- **Node.js Tests** (`tests/node/`): Run with Jest, use mocks for browser APIs
- **Browser Tests** (`browser-tests.html`): Require real browser APIs (IndexedDB, localStorage)
- **Browser Bundle** (`dist/sillyport-runtime.browser.js`): All classes exposed globally for browser testing

### Browser Testing

For tests that require real browser APIs:

1. **Start the test server:**
   ```bash
   python3 -m http.server 8000
   ```

2. **Open browser tests:**
   - Visit `http://localhost:8000/browser-tests.html`
   - Or use `http://localhost:8000/test-browser-bundle.html` for quick verification

3. **Available test suites:**
   - StorageManager (IndexedDB integration)
   - SillyTavernRuntime (full integration)
   - ChatManager (with storage)
   - CharacterCard (PNG parsing)
   - FormatImporter (multi-format support)

### Manual Console Testing

```javascript
// Test basic runtime functionality
const runtime = new SillyTavernRuntime();
await runtime.init();
console.log('Runtime initialized:', runtime.initialized);

// Test character loading
const response = await fetch('test-data/characters/default_Seraphina.png');
const blob = await response.blob();
const character = await CharacterCard.fromPNG(blob);
console.log('Character loaded:', character.data.name);

// Test chat management
const chatManager = new ChatManager(eventBus, stateManager);
const chat = await chatManager.createChat(['character1', 'character2']);
console.log('Chat created:', chat.id);
```

## 📁 Project Structure

```
sillyport-runtime/
├── src/
│   ├── core/
│   │   ├── EventBus.js ✅           # Complete event system
│   │   ├── StateManager.js ✅       # Reactive state management
│   │   ├── ConfigManager.js ✅      # Configuration handling
│   │   ├── StorageManager.js ✅     # IndexedDB integration
│   │   └── SillyTavernRuntime.js ✅ # Main runtime class
│   ├── character/
│   │   ├── CharacterCard.js ✅      # Character card system
│   │   ├── PNGMetadataExtractor.js ✅ # PNG parsing
│   │   └── index.js ✅              # Character module exports
│   ├── chat/
│   │   ├── ChatManager.js ✅        # Chat session management
│   │   ├── FormatImporter.js ✅     # Multi-format import
│   │   └── index.js ✅              # Chat module exports
│   ├── prompt/
│   │   ├── PromptBuilder.js ✅      # Prompt construction
│   │   ├── OpenAIConverter.js ✅    # OpenAI format conversion
│   │   ├── AnthropicConverter.js ✅ # Claude format conversion
│   │   └── index.js ✅              # Prompt module exports
│   ├── memory/                      # Memory management (planned)
│   ├── utils/                       # Utility functions (planned)
│   └── index.js ✅                  # Main exports
├── tests/
│   ├── node/                        # Node.js test suites
│   │   ├── EventBus.simple.test.js ✅
│   │   ├── StateManager.simple.test.js ✅
│   │   ├── ConfigManager.simple.test.js ✅
│   │   ├── StorageManager.simple.test.js ✅
│   │   ├── CharacterCard.simple.test.js ✅
│   │   ├── ChatManager.simple.test.js ✅
│   │   ├── FormatImporter.simple.test.js ✅
│   │   ├── PromptBuilder.simple.test.js ✅
│   │   ├── OpenAIConverter.simple.test.js ✅
│   │   └── AnthropicConverter.simple.test.js ✅
│   └── core/                        # Core integration tests
├── test-data/                       # Comprehensive test resources
│   ├── characters/
│   │   ├── default_Seraphina.png ✅ # Character Card V2 (539KB)
│   │   └── Seraphina/ ✅            # 28 emotion sprites
│   ├── presets/
│   │   ├── context/ ✅              # 30+ context templates
│   │   └── instruct/ ✅             # 30+ instruction formats
│   ├── config/ ✅                   # Configuration templates
│   └── assets/ ✅                   # Example assets
├── dist/
│   └── sillyport-runtime.browser.js # Browser bundle
├── browser-tests.html ✅            # Browser testing interface
├── .project/
│   ├── spec/
│   │   └── sillytavern-runtime-spec.md ✅ # Complete specification
│   └── tasks/
│       └── task-breakdown.md ✅     # Development roadmap
└── README.md                        # This file
```

## 🔧 Technology Stack

- **Runtime**: Modern browsers (Chrome/Edge 90+, Firefox 88+, Safari 14+)
- **Storage**: IndexedDB for persistent data
- **File Processing**: Native File API with PNG metadata extraction
- **State Management**: Event-driven reactive architecture
- **Format Support**: JSON, YAML, PNG metadata parsing, multi-format chat import
- **Testing**: Jest for unit tests, browser console for integration
- **Prompt Formats**: OpenAI ChatML, Anthropic Claude, custom templates

## 📊 Test Data

The project includes comprehensive test data for development and validation:

### Character Resources
- `test-data/characters/default_Seraphina.png` - Character Card V2 with embedded metadata (539KB)
- `test-data/characters/Seraphina/` - 28 emotion sprites for testing

### Configuration Templates
- `test-data/config/server-config.yaml` - Complete server configuration (9.7KB)
- `test-data/config/client-settings.json` - Full client settings (26KB)

### Preset Collections
- `test-data/presets/context/` - 30+ context templates for different AI models
- `test-data/presets/instruct/` - 30+ instruction formats including ChatML and Claude

### Asset Examples
- `test-data/assets/world-info-example.json` - World info structure (8.4KB)
- `test-data/assets/user-default.png` - Default user avatar (51KB)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/KarmaLabsAI/SillyPort-Runtime.git
   cd SillyPort-Runtime
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   # Run all Node.js tests
   npm test
   
   # Run browser tests
   python3 -m http.server 8000
   # Then visit http://localhost:8000/browser-tests.html
   ```

4. **Test in browser console**
   ```bash
   # Start server
   python3 -m http.server 8000
   
   # Open browser console and test:
   const runtime = new SillyTavernRuntime();
   await runtime.init();
   ```

## 🎮 Console Testing

The runtime is designed to be testable directly in the browser console:

```javascript
// Initialize runtime
const runtime = new SillyTavernRuntime();
await runtime.init();

// Load test character
const response = await fetch('test-data/characters/default_Seraphina.png');
const blob = await response.blob();
const character = await CharacterCard.fromPNG(blob);

// Create chat session
const chatManager = new ChatManager(eventBus, stateManager);
const chat = await chatManager.createChat(['user', character.data.name]);

// Test prompt building
const promptBuilder = new PromptBuilder();
const contextPreset = await fetch('test-data/presets/context/Default.json').then(r => r.json());
const prompt = await promptBuilder.buildPrompt(character, [], contextPreset);

// Test format conversion
const anthropicConverter = new AnthropicConverter(eventBus);
const claudeFormat = anthropicConverter.convert(prompt);
console.log('Claude format:', claudeFormat);
```

## 🔍 Development

### Code Quality
- ES6+ JavaScript with comprehensive documentation
- Modular architecture with clear separation of concerns
- Extensive error handling and validation
- Memory leak prevention and cleanup
- Event-driven architecture for loose coupling

### Testing Strategy
- Unit tests for all core components
- Integration tests for component interaction
- Console testing for manual validation
- Performance tests for memory and speed
- Browser compatibility testing

## 📖 Documentation

- **[Specification](.project/spec/sillytavern-runtime-spec.md)** - Complete technical specification
- **[Task Breakdown](.project/tasks/task-breakdown.md)** - Detailed development roadmap
- **[Browser Testing](browser-testing.md)** - Browser testing guide
- **[Test Organization](TEST_ORGANIZATION.md)** - Testing strategy documentation

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

**Status**: Phase 4 Complete - Core infrastructure, character system, chat system, and prompt system fully implemented and tested. Memory & Performance phase in progress.

For detailed technical information, see the [specification document](.project/spec/sillytavern-runtime-spec.md). 