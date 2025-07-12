# Test Organization Guide

This document explains the clear separation between Node.js and browser tests in the SillyTavern Runtime project.

## Directory Structure

```
tests/
├── node/                    # Node.js-safe tests (fast, mocked APIs)
│   ├── EventBus.test.js
│   ├── StateManager.test.js
│   ├── ChatManager.simple.test.js
│   ├── ChatManager-message-management.test.js
│   ├── SillyTavernRuntime.simple.test.js
│   ├── StorageManager.simple.test.js
│   ├── PNGMetadataExtractor.test.js
│   ├── CharacterManager.test.js
│   └── CharacterMetadata.test.js
├── browser/                 # Browser-specific tests (real APIs)
│   ├── StorageManager.test.js
│   ├── StorageManager-1.4.2.test.js
│   ├── ConfigManager.test.js
│   ├── SillyTavernRuntime.test.js
│   ├── SillyTavernRuntime.integration.test.js
│   ├── ChatManager.test.js
│   ├── CharacterCard.test.js
│   └── CharacterCardFormatConversion.test.js
├── setup.node.js           # Node.js test setup (mocks)
└── setup.js                # Browser test setup (jsdom)
```

## Test Categories

### Node.js Tests (`tests/node/`)
**Purpose**: Fast unit tests, core logic validation, mocked browser APIs
**When to use**: 
- Testing pure JavaScript logic
- Testing with mocked browser APIs
- Fast feedback during development
- CI/CD pipeline tests

**Characteristics**:
- ✅ Fast execution (< 1 second per test)
- ✅ No real browser APIs
- ✅ Mocked IndexedDB, localStorage, etc.
- ✅ Can run in any Node.js environment
- ✅ Perfect for TDD and rapid iteration

**Examples**:
- EventBus functionality
- StateManager logic
- ChatManager message management (with mocked storage)
- PNG metadata extraction
- Core utility functions

### Browser Tests (`tests/browser/`)
**Purpose**: Full integration tests, real browser API validation
**When to use**:
- Testing real browser APIs (IndexedDB, localStorage)
- Full component integration
- End-to-end functionality
- Before production deployment

**Characteristics**:
- ⏱️ Slower execution (real APIs, async operations)
- 🌐 Requires browser environment
- 🔗 Real IndexedDB, localStorage, etc.
- 🧪 Full integration testing
- 📊 Comprehensive validation

**Examples**:
- StorageManager with real IndexedDB
- SillyTavernRuntime full initialization
- ChatManager with real storage persistence
- Component integration with real browser APIs

## Running Tests

### Node.js Tests (Fast)
```bash
npm test                    # Run all Node.js tests
npm run test:watch         # Watch mode for Node.js tests
npm run test:coverage      # Coverage for Node.js tests
```

### Browser Tests (Comprehensive)
```bash
npm run test:browser       # Run browser tests with jsdom
npm run test:browser-html  # Open browser-tests.html for manual testing
```

### All Tests
```bash
npm run test:all           # Node.js tests + reminder for browser tests
```

## Creating New Tests

### For Node.js Tests (`tests/node/`)
1. **File naming**: `ComponentName.test.js` or `ComponentName.feature.test.js`
2. **Location**: `tests/node/`
3. **Use mocks**: Always mock browser APIs
4. **Keep it fast**: Focus on logic, not integration

```javascript
// tests/node/MyComponent.test.js
const MyComponent = require('../../src/components/MyComponent');

describe('MyComponent', () => {
    test('should do something', () => {
        // Test pure logic here
        const result = MyComponent.someFunction(input);
        expect(result).toBe(expected);
    });
});
```

### For Browser Tests (`tests/browser/`)
1. **File naming**: `ComponentName.test.js` or `ComponentName.integration.test.js`
2. **Location**: `tests/browser/`
3. **Use real APIs**: IndexedDB, localStorage, etc.
4. **Test integration**: Full component interaction

```javascript
// tests/browser/MyComponent.test.js
const MyComponent = require('../../src/components/MyComponent');

describe('MyComponent Integration', () => {
    test('should work with real browser APIs', async () => {
        // Test with real browser APIs here
        const component = new MyComponent();
        await component.init(); // Uses real IndexedDB
        expect(component.isReady()).toBe(true);
    });
});
```

## Test Naming Conventions

### Node.js Tests
- `ComponentName.test.js` - Basic functionality
- `ComponentName.feature.test.js` - Specific features
- `ComponentName.simple.test.js` - Simplified versions of complex tests

### Browser Tests
- `ComponentName.test.js` - Full integration tests
- `ComponentName.integration.test.js` - Complex integration scenarios
- `ComponentName.e2e.test.js` - End-to-end workflows

## When to Use Each Type

### Use Node.js Tests When:
- ✅ Testing pure JavaScript logic
- ✅ Testing with mocked dependencies
- ✅ Need fast feedback during development
- ✅ Running in CI/CD pipeline
- ✅ Testing utility functions
- ✅ Testing event handling logic

### Use Browser Tests When:
- 🌐 Testing real browser APIs (IndexedDB, localStorage)
- 🔗 Testing full component integration
- 🧪 Testing end-to-end workflows
- 📊 Validating production behavior
- 🔍 Debugging browser-specific issues
- 🚀 Before major releases

## Migration Guide

### Moving Tests Between Categories

**From Node.js to Browser:**
- Test requires real browser APIs
- Test is too slow for Node.js environment
- Test needs full integration validation

**From Browser to Node.js:**
- Test can be mocked effectively
- Test is pure logic without browser dependencies
- Test needs to run faster for development

### Example Migration

```javascript
// Before: Mixed test (confusing)
describe('StorageManager', () => {
    test('should save data', async () => {
        // This might work in Node.js with mocks
        // But really needs real IndexedDB
    });
});

// After: Clear separation
// tests/node/StorageManager.simple.test.js
describe('StorageManager Logic', () => {
    test('should validate data before saving', () => {
        // Pure logic test - fast and reliable
    });
});

// tests/browser/StorageManager.test.js
describe('StorageManager Integration', () => {
    test('should save data to IndexedDB', async () => {
        // Real browser API test - comprehensive
    });
});
```

## Best Practices

1. **Start with Node.js tests** - Fast feedback for development
2. **Add browser tests for integration** - Validate real behavior
3. **Keep Node.js tests fast** - < 1 second per test
4. **Use descriptive names** - Make it clear what each test does
5. **Document browser requirements** - Note which APIs are needed
6. **Run both before releases** - Ensure comprehensive coverage

## Troubleshooting

### Node.js Test Issues
- **Import errors**: Check module paths and mocks
- **Timeout errors**: Test might be too complex for Node.js
- **Mock issues**: Ensure browser APIs are properly mocked

### Browser Test Issues
- **API not available**: Check if running in browser environment
- **Timeout errors**: Real APIs are slower, increase timeout
- **Integration issues**: Check component dependencies

## Summary

This organization provides:
- 🚀 **Fast development** with Node.js tests
- 🔍 **Comprehensive validation** with browser tests
- 📁 **Clear separation** of concerns
- 🎯 **Obvious placement** for new tests
- ⚡ **Efficient CI/CD** with appropriate test selection 