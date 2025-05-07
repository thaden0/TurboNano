// Import reflect-metadata at the very top
require('reflect-metadata');

const container = require('./ioc/container');
const TYPES = require('./ioc/types/TYPES');
const logger = require('./services/LoggingService');

// Set log level to debug for development
process.env.LOG_LEVEL = 'debug';

// Get services from container
const screen = container.get(TYPES.Screen);
const background = container.get(TYPES.Background);
const eventController = container.get(TYPES.EventController);
const windowService = container.get(TYPES.WindowService);

function fill(char = '░') {
  const width = screen.width;
  const height = screen.height;
  let content = '';
  
  // Start at row 1 to leave space for the menu bar
  for (let i = 1; i < height; i++) {
    content += char.repeat(width) + '\n';
  }
  
  background.setContent(content);
  screen.render();
}

// Fill the background initially
fill();

// Handle window resize
screen.on('resize', () => {
  fill();
});

// Ensure screen is re-rendered to show menu bar
screen.render();

// Handle all keypresses through the event controller
screen.on('keypress', async (ch, key) => {
  // Special key handler for AI Prompt
  if (key && key.full === 'C-space') {
    // Create or toggle AI prompt
    const aiPrompt = windowService.createAIPrompt();
    logger.info('App', 'AI Prompt window activated');
    screen.render();
    return;
  }
  
  // Cycle through windows with Alt+Tab
  if (key && key.full === 'M-tab') {
    windowService.next();
    logger.info('App', 'Switched to next window');
    screen.render();
    return;
  }
  
  // Cycle through windows with Ctrl+Tab
  if (key && key.full === 'C-tab') {
    windowService.next();
    logger.info('App', 'Switched to next window with Ctrl+Tab');
    screen.render();
    return;
  }
  
  // Close current window with Ctrl+W
  if (key && key.full === 'C-w') {
    const currentWindow = windowService.getCurrentWindow();
    // Make sure we don't close the last window
    if (currentWindow && windowService.windows.length > 1) {
      logger.info('App', 'Closing current window with Ctrl+W');
      // Switch to next window first, then remove the current one
      windowService.next();
      windowService.removeWindow(currentWindow);
      screen.render();
      return;
    }
  }
  
  await eventController.press(key);
});

// Get file name from command line arguments
const fileName = process.argv[2] || '';

// Log startup
logger.info('App', 'Editor started successfully');
if (fileName) {
  logger.info('App', `Opening file: ${fileName}`);
  
  // Open the specified file if provided as an argument
  windowService.openFile(fileName).catch(error => {
    logger.error('App', `Error opening file "${fileName}":`, error);
  });
} else {
  logger.info('App', 'Using default empty file');
  // Don't create another window since WindowService already created one
}

// Final render of the screen
screen.render();