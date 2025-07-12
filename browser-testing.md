# Browser Testing Guide

This document explains how to run tests that require real browser APIs (IndexedDB, localStorage, etc.) in the SillyTavern Runtime project.

## Overview

The SillyTavern Runtime has been designed with a clear separation between:
- **Node.js Tests**: Core logic, utilities, and mocked browser APIs
- **Browser Tests**: Full integration tests requiring real browser APIs
- **Programmatic Testing**: Automated verification of browser bundle and infrastructure

## Test Environments

### Node.js Environment (`npm test`)
- **Purpose**: Unit tests, core logic validation, mocked browser APIs
- **Configuration**: `jest.config.node.js`
- **Setup**: `tests/setup.node.js` (provides mocks for browser APIs)
- **What's Tested**: 
  - EventBus functionality
  - StateManager logic
  - ConfigManager (with mocked localStorage)
  - ChatManager message management (with mocked storage)
  - PNG metadata extraction
  - Core utility functions

### Browser Environment (`browser-tests.html`)
- **Purpose**: Full integration tests, real browser API validation
- **Configuration**: Real browser environment
- **Setup**: Loads browser bundle (`dist/sillyport-runtime.browser.js`)
- **What's Tested**:
  - StorageManager with real IndexedDB
  - SillyTavernRuntime full initialization
  - ChatManager with real storage persistence
  - Component integration with real browser APIs
  - Lifecycle events and state management

### Programmatic Environment (Automated Verification)
- **Purpose**: Automated infrastructure validation, bundle verification
- **Configuration**: Command-line tools (curl, grep, etc.)
- **Setup**: HTTP server serving test files
- **What's Verified**:
  - Browser bundle accessibility and structure
  - Global class exposure
  - Test file configuration
  - Server infrastructure

## Running Browser Tests

### Method 1: Direct Browser Testing
1. Open `browser-tests.html` in a modern web browser
2. Use the test controls to run specific test suites or all tests
3. Check the console for detailed output
4. Review the visual test results on the page

### Method 2: Development Server (Recommended)
```bash
# Start the development server
python3 -m http.server 8000
# or
npx serve .

# Then open http://localhost:8000/browser-tests.html
```

### Method 3: Programmatic Verification (Automated)
```bash
# Start the server
python3 -m http.server 8000 &

# Verify browser bundle accessibility
curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | head -10

# Check global class exposure
curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | grep -c "window.SillyTavernRuntime"

# Verify all classes are exposed
curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | grep -E "window\.(EventBus|StateManager|ConfigManager|StorageManager|ChatManager|SillyTavernRuntime)" | wc -l

# Check test file configuration
curl -s http://localhost:8000/browser-tests.html | grep -c "sillyport-runtime.browser.js"
```

## Test Categories

### Infrastructure Tests (Programmatic)
- **Bundle Accessibility**: Verify browser bundle is served correctly
- **Global Exposure**: Confirm all classes are exposed globally
- **File Configuration**: Check test files load the correct bundle
- **Server Infrastructure**: Validate HTTP server functionality

### Storage Tests
- **IndexedDB Integration**: Database creation, object stores, CRUD operations
- **localStorage Integration**: Configuration persistence
- **Data Persistence**: Cross-instance data survival

### Runtime Tests
- **Initialization**: Full runtime bootstrap with all components
- **Component Integration**: Component dependency management
- **Lifecycle Events**: Event emission and subscription

### Chat Tests
- **Session Management**: Chat creation, participant management
- **Message Management**: Message CRUD with real storage
- **Storage Integration**: Persistent chat data

## Test Results

### Visual Indicators (Browser Tests)
- ✅ **Green**: Test passed
- ❌ **Red**: Test failed (with error details)
- ⏭ **Gray**: Test skipped (with reason)
- **Progress Bar**: Overall test completion percentage

### Console Output (Browser Tests)
All tests also log detailed information to the browser console for debugging:
```javascript
console.log('=== Running StorageManager IndexedDB Tests ===');
console.log('✓ IndexedDB is available');
console.log('✗ StorageManager can initialize: Database open failed');
```

### Programmatic Verification Results
Automated checks return specific counts and confirmations:
```bash
# Expected results:
# - Bundle accessibility: File content returned
# - Global class exposure: 6 classes exposed
# - Test file configuration: 1 reference found
# - Server status: HTTP 200 responses
```

## Troubleshooting

### Common Issues

1. **IndexedDB Not Available**
   - Ensure you're using a modern browser
   - Check if IndexedDB is enabled in browser settings
   - Try incognito/private browsing mode

2. **Tests Timing Out**
   - Some storage operations can be slow
   - Check browser console for detailed error messages
   - Ensure no other tabs are using the same database

3. **Permission Errors**
   - Some browsers require user interaction for storage access
   - Try clicking on the page before running tests
   - Check browser storage permissions

4. **Bundle Not Loading**
   - Verify `dist/sillyport-runtime.browser.js` exists
   - Check HTTP server is running on correct port
   - Ensure no CORS issues with file:// protocol

5. **Programmatic Verification Fails**
   - Check if HTTP server is running: `curl -I http://localhost:8000/`
   - Verify bundle file exists: `ls -la dist/sillyport-runtime.browser.js`
   - Check file permissions and content

### Debug Mode
Enable debug mode in the browser console:
```javascript
// Enable debug logging for specific components
localStorage.setItem('debug', 'true');

// Or enable for specific components
localStorage.setItem('debug:StorageManager', 'true');
localStorage.setItem('debug:ChatManager', 'true');
```

## Test Development

### Adding New Browser Tests
1. Add test functions to the appropriate section in `browser-tests.html`
2. Use the `test(name, testFunction)` utility
3. Use `assert(condition, message)` for assertions
4. Use `skip(name, reason)` for tests that can't run in current environment

### Adding Programmatic Verification
1. Add verification commands to your CI/CD pipeline
2. Use curl/grep to check specific aspects of the infrastructure
3. Verify expected counts and content patterns
4. Include server health checks

### Example Test Structure
```javascript
async function runMyNewTests() {
    console.log('=== Running My New Tests ===');
    
    test('My test name', () => {
        assert(condition, 'Failure message');
    });
    
    test('Async test', async () => {
        const result = await someAsyncOperation();
        assert(result.success, 'Async operation failed');
    });
}
```

### Example Programmatic Verification
```bash
#!/bin/bash
# verify-infrastructure.sh

echo "Verifying browser testing infrastructure..."

# Check server is running
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ | grep -q "200"; then
    echo "❌ Server not responding"
    exit 1
fi

# Check bundle exists and is accessible
if ! curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | grep -q "SillyTavern Browser Runtime"; then
    echo "❌ Browser bundle not accessible"
    exit 1
fi

# Verify all classes are exposed
CLASS_COUNT=$(curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | grep -E "window\.(EventBus|StateManager|ConfigManager|StorageManager|ChatManager|SillyTavernRuntime)" | wc -l)
if [ "$CLASS_COUNT" -ne 6 ]; then
    echo "❌ Expected 6 classes, found $CLASS_COUNT"
    exit 1
fi

echo "✅ Infrastructure verification passed"
```

## Integration with CI/CD

For continuous integration, you can use multiple approaches:

### 1. Programmatic Verification (Fastest)
```bash
# Quick infrastructure check
python3 -m http.server 8000 &
sleep 2
curl -s http://localhost:8000/dist/sillyport-runtime.browser.js | grep -q "SillyTavern Browser Runtime" && echo "✅ Bundle OK" || echo "❌ Bundle failed"
```

### 2. Headless Browser Testing
Use headless browsers (Puppeteer, Playwright) for full browser tests:
```javascript
const puppeteer = require('puppeteer');

async function runBrowserTests() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8000/browser-tests.html');
    
    // Wait for tests to complete
    await page.waitForFunction(() => {
        return document.getElementById('total-tests').textContent > 0;
    });
    
    // Extract results
    const results = await page.evaluate(() => {
        return {
            total: document.getElementById('total-tests').textContent,
            passed: document.getElementById('passed-tests').textContent,
            failed: document.getElementById('failed-tests').textContent
        };
    });
    
    await browser.close();
    return results;
}
```

### 3. Hybrid Approach (Recommended)
Combine programmatic verification with selective browser testing:
```bash
# Step 1: Quick infrastructure check
./verify-infrastructure.sh

# Step 2: Run critical browser tests only
puppeteer run-browser-tests.js --critical-only

# Step 3: Full browser test suite (optional)
puppeteer run-browser-tests.js --full-suite
```

## Best Practices

1. **Always run Node.js tests first** - they're faster and catch most issues
2. **Use programmatic verification for infrastructure** - quick checks before browser tests
3. **Use browser tests for integration validation** - after infrastructure verification passes
4. **Check console output** - for detailed debugging information
5. **Test in multiple browsers** - for cross-browser compatibility
6. **Keep browser tests focused** - on integration and browser-specific features
7. **Automate infrastructure checks** - include in CI/CD pipelines for early failure detection

## Reporting Issues

When reporting test failures:
1. Include the browser and version
2. Provide console output
3. Mention which test suite failed
4. Include any error messages from the test results
5. Specify if the issue occurs in Node.js tests, browser tests, programmatic verification, or all three
6. Include programmatic verification results if infrastructure issues are suspected 