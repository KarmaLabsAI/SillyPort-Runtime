// Test script to run all stress tests from browser-tests.html
const puppeteer = require('puppeteer');

async function testStressTests() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        // Load the browser tests page
        await page.goto('http://localhost:8000/browser-tests.html');
        
        // Wait for the page to load
        await page.waitForSelector('#stress-results');
        
        // Run the stress tests
        await page.evaluate(() => {
            // Clear any existing results
            document.getElementById('stress-results').innerHTML = '';
            document.getElementById('all-results').innerHTML = '';
            
            // Reset test counters
            window.testResults = { total: 0, passed: 0, failed: 0, skipped: 0 };
        });
        
        // Execute the stress tests
        await page.evaluate(() => {
            return window.runStressTests();
        });
        
        // Wait for tests to complete
        await page.waitForFunction(() => {
            const results = document.getElementById('all-results');
            return results && results.children.length >= 5; // Should have 5 stress tests
        }, { timeout: 30000 });
        
        // Get the test results
        const results = await page.evaluate(() => {
            const allResults = document.getElementById('all-results');
            const stressResults = document.getElementById('stress-results');
            const summary = {
                total: window.testResults.total,
                passed: window.testResults.passed,
                failed: window.testResults.failed,
                skipped: window.testResults.skipped
            };
            
            return {
                summary,
                allResults: allResults.innerHTML,
                stressResults: stressResults.innerHTML
            };
        });
        
        console.log('Stress Test Results:');
        console.log('Summary:', results.summary);
        console.log('All Results:', results.allResults);
        console.log('Stress Results:', results.stressResults);
        
        // Check if all tests passed
        const allPassed = results.summary.failed === 0 && results.summary.passed >= 5;
        
        // Alternative check: count the actual pass/fail results
        const passCount = (results.allResults.match(/class="test-result pass"/g) || []).length;
        const failCount = (results.allResults.match(/class="test-result fail"/g) || []).length;
        const actualAllPassed = failCount === 0 && passCount >= 5;
        
        return {
            success: actualAllPassed,
            summary: results.summary,
            results: results.allResults,
            actualCounts: { pass: passCount, fail: failCount }
        };
        
    } catch (error) {
        console.error('Test failed:', error);
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

// Run the test
testStressTests().then(result => {
    console.log('Final stress test result:', result);
    if (result.success) {
        console.log('✅ All stress tests passed! Task 6.2.2 is complete.');
    } else {
        console.log('❌ Some stress tests failed.');
    }
    process.exit(result.success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
}); 