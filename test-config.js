const configService = require('./services/ConfigService');
const logger = require('./services/LoggingService');
const path = require('path');
const os = require('os');

async function testConfig() {
    try {
        // Print expected paths
        console.log('Expected config directory:', path.join(os.homedir(), '.turbollama'));
        console.log('Expected config file:', path.join(os.homedir(), '.turbollama', 'config.json'));
        
        // Ensure we're using the correct path
        const configPath = configService.getConfigFile();
        console.log('Using config file at:', configPath);
        
        // Get the config
        const editor = configService.get('editor', {});
        console.log('Editor config:', JSON.stringify(editor, null, 2));
        
        // Set a test value
        const result = await configService.set('testTime', new Date().toISOString());
        console.log('Set testTime:', result);
        
        // Read from file again to verify
        await configService.loadConfig();
        const testTime = configService.get('testTime');
        console.log('Read testTime:', testTime);
        
        console.log('Configuration test completed successfully');
    } catch (error) {
        console.error('Error in config test:', error.message);
    }
}

// Run the test
testConfig(); 