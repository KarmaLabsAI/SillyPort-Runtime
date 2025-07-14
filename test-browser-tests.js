// Test script to run all browser tests and verify constructor issues are fixed
const puppeteer = require('puppeteer');

async function testAllBrowserTests() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        // Load the browser tests page
        await page.goto('http://localhost:8000/browser-tests.html');
        
        // Wait for the page to load
        await page.waitForSelector('#all-results');
        
        // Run all tests
        await page.evaluate(() => {
            // Clear any existing results
            document.getElementById('all-results').innerHTML = '';
            document.getElementById('storage-indexeddb-results').innerHTML = '';
            document.getElementById('storage-localstorage-results').innerHTML = '';
            document.getElementById('storage-persistence-results').innerHTML = '';
            document.getElementById('runtime-init-results').innerHTML = '';
            document.getElementById('runtime-component-results').innerHTML = '';
            document.getElementById('runtime-lifecycle-results').innerHTML = '';
            document.getElementById('chat-session-results').innerHTML = '';
            document.getElementById('chat-message-results').innerHTML = '';
            document.getElementById('chat-storage-results').innerHTML = '';
            document.getElementById('stress-results').innerHTML = '';
            
            // Run all test functions
            runStorageIndexedDBTests();
            runStorageLocalStorageTests();
            runStoragePersistenceTests();
            runRuntimeInitTests();
            runRuntimeComponentTests();
            runRuntimeLifecycleTests();
            runChatSessionTests();
            runChatMessageTests();
            runChatStorageTests();
            runStressTests();
        });
        
        // Wait for tests to complete
        await page.waitForFunction(() => {
            const total = parseInt(document.getElementById('total-tests').textContent);
            const passed = parseInt(document.getElementById('passed-tests').textContent);
            const failed = parseInt(document.getElementById('failed-tests').textContent);
            return total > 0 && (passed + failed) === total;
        }, { timeout: 15000 });
        
        // Get the test results
        const results = await page.evaluate(() => {
            const allResults = document.getElementById('all-results').innerHTML;
            const summary = {
                total: parseInt(document.getElementById('total-tests').textContent),
                passed: parseInt(document.getElementById('passed-tests').textContent),
                failed: parseInt(document.getElementById('failed-tests').textContent),
                skipped: parseInt(document.getElementById('skipped-tests').textContent)
            };
            
            return {
                summary,
                allResults
            };
        });
        
        console.log('All Browser Test Results:');
        console.log('Summary:', results.summary);
        console.log('Results:', results.allResults);
        
        // Check if all tests passed
        const allPassed = results.summary.failed === 0 && results.summary.passed > 0;
        
        // Check for specific constructor errors
        const hasConstructorErrors = results.allResults.includes('not a constructor') || 
                                   results.allResults.includes('Illegal constructor') ||
                                   results.allResults.includes('not defined');
        
        return {
            success: allPassed && !hasConstructorErrors,
            summary: results.summary,
            results: results.allResults,
            hasConstructorErrors
        };
        
    } catch (error) {
        console.error('Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await browser.close();
    }
}

// Run the test
testAllBrowserTests().then(result => {
    if (result.success) {
        console.log('✅ All browser tests passed! Constructor issues are fixed.');
    } else {
        console.log('❌ Browser tests failed:', result);
    }
    process.exit(result.success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
}); 