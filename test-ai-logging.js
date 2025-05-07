const AIService = require('./services/AIService');
const logger = require('./services/LoggingService');
const configService = require('./services/ConfigService');

// Log start of test
logger.info('Test', 'Starting AI logging test');

// Set up configuration for Ollama with an available model
configService.config.aiProvider = 'ollama';
configService.config.ollama = {
    baseUrl: 'http://localhost:11434',
    model: 'mistral'  // Using mistral model which is available
};

// Create AI service
const ai = new AIService();

// Log AI service initialization
logger.info('Test', `AI Provider: ${configService.get('aiProvider')}`);
logger.info('Test', `Ollama Base URL: ${configService.get('ollama').baseUrl}`);
logger.info('Test', `Ollama Model: ${configService.get('ollama').model}`);

// Function to test the AI service
async function testAI() {
    try {
        logger.info('Test', 'Sending prompt to AI service');
        
        // Simple test prompt
        const response = await ai.generateResponse('Tell me a short joke about programming');
        
        // Log the response
        logger.info('AIPrompt', '===== AI RESPONSE =====');
        logger.info('AIPrompt', response);
        logger.info('AIPrompt', '=======================');
        
        logger.info('Test', 'AI response received and logged');
        
        // Also print to console for immediate feedback
        console.log('\n===== AI RESPONSE =====');
        console.log(response);
        console.log('=======================\n');
    } catch (error) {
        logger.error('AIPrompt', '===== AI ERROR =====');
        logger.error('AIPrompt', error.message);
        logger.error('AIPrompt', '===================');
        
        logger.error('Test', `Error testing AI: ${error.message}`);
        console.error('Error:', error.message);
    }
    
    // Ensure logs are flushed before exiting
    await logger.cleanup();
    console.log('Test completed, check the logs at ~/.turbollama/logs/editor.log');
}

// Run the test
testAI(); 