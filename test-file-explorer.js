// test-file-explorer.js - Test script for FileExplorer file opening functionality
const blessed = require('blessed');
const WindowService = require('./services/WindowService');
const logger = require('./services/LoggingService');

/**
 * Creates a test environment to verify the FileExplorer can open files
 */
async function testFileExplorer() {
    logger.info('TestScript', 'Starting FileExplorer test...');
    
    // Create a screen
    const screen = blessed.screen({
        smartCSR: true,
        title: 'TurboNano - FileExplorer Test'
    });
    
    // Create key bindings to exit the application
    screen.key(['q', 'C-c'], () => {
        screen.destroy();
        process.exit(0);
    });
    
    // Create a window service
    const windowService = new WindowService(screen);
    logger.info('TestScript', 'WindowService created');
    
    // Create a file explorer
    const fileExplorer = windowService.createFileExplorer();
    logger.info('TestScript', 'FileExplorer created');
    
    // Add instructions to the screen
    const instructions = blessed.box({
        top: 0,
        right: 0,
        width: 30,
        height: 8,
        content: 'FileExplorer Test\n\n' +
                'Use arrow keys to navigate\n' +
                'Enter to open file\n' +
                'Backspace to go up\n' +
                'q or Ctrl+C to quit',
        border: { type: 'line' },
        style: { border: { fg: 'green' } }
    });
    
    screen.append(instructions);
    
    // Render the screen
    screen.render();
    
    logger.info('TestScript', 'Test environment ready - navigate with arrow keys, press Enter to open a file');
}

// Run the test
testFileExplorer().catch(error => {
    console.error('Error during test:', error);
    process.exit(1);
}); 