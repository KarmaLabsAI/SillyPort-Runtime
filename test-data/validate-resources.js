#!/usr/bin/env node

/**
 * Test Resources Validation Script
 * Verifies all copied test resources are properly structured
 */

const fs = require('fs');
const path = require('path');

const testDataDir = __dirname;
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function test(name, assertion) {
    try {
        const result = assertion();
        if (result) {
            results.passed++;
            results.tests.push({ name, status: 'PASS' });
            console.log(`✓ ${name}`);
        } else {
            results.failed++;
            results.tests.push({ name, status: 'FAIL' });
            console.log(`✗ ${name}`);
        }
    } catch (error) {
        results.failed++;
        results.tests.push({ name, status: 'ERROR', error: error.message });
        console.log(`✗ ${name} - Error: ${error.message}`);
    }
}

console.log('Validating Test Resources...\n');

// Configuration files
test('Server config exists', () => {
    const configPath = path.join(testDataDir, 'config', 'server-config.yaml');
    return fs.existsSync(configPath) && fs.statSync(configPath).size > 0;
});

test('Client settings exists', () => {
    const settingsPath = path.join(testDataDir, 'config', 'client-settings.json');
    return fs.existsSync(settingsPath) && fs.statSync(settingsPath).size > 0;
});

test('Client settings is valid JSON', () => {
    const settingsPath = path.join(testDataDir, 'config', 'client-settings.json');
    const content = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object';
});

// Character resources
test('Default character card exists', () => {
    const cardPath = path.join(testDataDir, 'characters', 'default_Seraphina.png');
    return fs.existsSync(cardPath) && fs.statSync(cardPath).size > 100000; // Should be ~539KB
});

test('Character emotions directory exists', () => {
    const emotionsPath = path.join(testDataDir, 'characters', 'Seraphina');
    return fs.existsSync(emotionsPath) && fs.statSync(emotionsPath).isDirectory();
});

test('Character emotions contain files', () => {
    const emotionsPath = path.join(testDataDir, 'characters', 'Seraphina');
    const files = fs.readdirSync(emotionsPath);
    return files.length > 20; // Should have ~28 emotion sprites
});

// Preset files
test('Context presets directory exists', () => {
    const contextPath = path.join(testDataDir, 'presets', 'context');
    return fs.existsSync(contextPath) && fs.statSync(contextPath).isDirectory();
});

test('Context presets contain files', () => {
    const contextPath = path.join(testDataDir, 'presets', 'context');
    const files = fs.readdirSync(contextPath);
    return files.length > 10; // Should have multiple preset files
});

test('Instruct presets directory exists', () => {
    const instructPath = path.join(testDataDir, 'presets', 'instruct');
    return fs.existsSync(instructPath) && fs.statSync(instructPath).isDirectory();
});

test('Instruct presets contain files', () => {
    const instructPath = path.join(testDataDir, 'presets', 'instruct');
    const files = fs.readdirSync(instructPath);
    return files.length > 5; // Should have multiple instruct templates
});

// Assets
test('User avatar exists', () => {
    const avatarPath = path.join(testDataDir, 'assets', 'user-default.png');
    return fs.existsSync(avatarPath) && fs.statSync(avatarPath).size > 0;
});

test('World info example exists', () => {
    const worldInfoPath = path.join(testDataDir, 'assets', 'world-info-example.json');
    return fs.existsSync(worldInfoPath) && fs.statSync(worldInfoPath).size > 0;
});

test('World info example is valid JSON', () => {
    const worldInfoPath = path.join(testDataDir, 'assets', 'world-info-example.json');
    const content = fs.readFileSync(worldInfoPath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object';
});

test('Workflow templates exist', () => {
    const workflow1 = path.join(testDataDir, 'assets', 'Char_Avatar_Comfy_Workflow.json');
    const workflow2 = path.join(testDataDir, 'assets', 'Default_Comfy_Workflow.json');
    return fs.existsSync(workflow1) && fs.existsSync(workflow2);
});

// File format validation
test('Sample context preset is valid JSON', () => {
    const contextPath = path.join(testDataDir, 'presets', 'context');
    const files = fs.readdirSync(contextPath);
    const sampleFile = files.find(f => f.endsWith('.json'));
    if (!sampleFile) return false;
    
    const content = fs.readFileSync(path.join(contextPath, sampleFile), 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object';
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests completed: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Success rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests.filter(t => t.status !== 'PASS').forEach(t => {
        console.log(`  - ${t.name}: ${t.status}`);
        if (t.error) console.log(`    Error: ${t.error}`);
    });
}

process.exit(results.failed > 0 ? 1 : 0); 