// Test script to verify CacheManager is accessible in browser bundle
const puppeteer = require('puppeteer');

async function testCacheManager() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        // Load the test HTML page
        await page.goto('http://localhost:8000/test-cache-manager.html');
        
        // Wait for the test to complete
        await page.waitForFunction(() => {
            const results = document.getElementById('results');
            return results && results.textContent.includes('All tests completed');
        }, { timeout: 10000 });
        
        // Get the test results
        const results = await page.evaluate(() => {
            return document.getElementById('results').textContent;
        });
        
        console.log('Test results:', results);
        
        // Check if tests passed
        const hasError = results.includes('ERROR: CacheManager not found');
        const hasSuccess = results.includes('All tests completed');
        
        return {
            success: hasSuccess && !hasError,
            results: results
        };
        
    } catch (error) {
        console.error('Test failed:', error);
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

// Run the test
testCacheManager().then(result => {
    console.log('Final test result:', result);
    process.exit(result.error ? 1 : 0);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
}); 