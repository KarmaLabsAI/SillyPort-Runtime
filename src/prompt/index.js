/**
 * Prompt System Module
 * 
 * Exports prompt-related classes and utilities for the SillyTavern Browser Runtime.
 */

const PromptBuilder = require('./PromptBuilder.js');
const OpenAIConverter = require('./OpenAIConverter.js');

module.exports = {
    PromptBuilder,
    OpenAIConverter
}; 