const GoogleConverter = require('./src/prompt/GoogleConverter.js');

const converter = new GoogleConverter();

// Test the role mapping
console.log('=== Role Mapping Test ===');
console.log('human ->', converter.normalizeRole('human'));
console.log('character ->', converter.normalizeRole('character'));
console.log('assistant ->', converter.normalizeRole('assistant'));

// Test the parsing
console.log('\n=== Parsing Test ===');
const prompt = {
    messages: [
        { role: 'human', content: 'Hello' },
        { role: 'character', content: 'Hi there' }
    ]
};

const components = converter.parsePrompt(prompt);
console.log('Parsed components:', JSON.stringify(components, null, 2));

// Test the conversion step by step
console.log('\n=== Step-by-Step Conversion Test ===');
const config = { wrap: true, input_sequence: 'user', output_sequence: 'model' };
const model = 'gemini-pro';

components.messages.forEach((message, i) => {
    console.log(`\nProcessing message ${i}:`);
    console.log('  Original role:', message.role);
    console.log('  Content:', message.content);
    
    let role = message.role;
    let formattedContent = '';
    
    if (role === 'system') {
        console.log('  -> System message');
        formattedContent = converter.formatSystemMessage(message.content, config);
    } else if (role === 'user') {
        console.log('  -> User message');
        formattedContent = converter.formatUserMessage(message.content, config);
    } else if (role === 'model') {
        console.log('  -> Model message');
        formattedContent = converter.formatModelMessage(message.content, config);
    }
    
    console.log('  Final role:', role);
    console.log('  Formatted content:', formattedContent);
});

// Test the conversion
console.log('\n=== Conversion Test ===');
const result = converter.convert(prompt);
console.log('Result messages:', result.messages.map(m => ({ role: m.role, content: m.content.substring(0, 30) + '...' }))); 