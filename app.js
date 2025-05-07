const blessed = require('blessed');
const KeyEvent = require('./models/KeyEvent');
const WindowService = require('./services/WindowService');
const EventController = require('./controller/EventController');

// Set log level to debug for development
process.env.LOG_LEVEL = 'debug';

const logger = require('./services/LoggingService');

// Create a screen object
const screen = blessed.screen({
  smartCSR: true,
  title: 'TurboNano',
  cursor: {
    artificial: true,
    shape: 'line',
    blink: true,
    color: null // Use default terminal cursor color
  }
});

// Create background first
const background = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  tags: false,
  style: {
    fg: 'gray',
    bg: 'black'
  },
  zIndex: 0 // Set background to lowest z-index
});

screen.append(background);

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

// Create services - ensure EventController is created before WindowService
// to make sure menu bar has higher z-index
const eventController = new EventController(screen, null); // Pass null initially
const windowService = new WindowService(screen);

// Now update the windowService reference in the eventController
eventController.windowService = windowService;


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
  
  await eventController.press(key);
});

// Get file name from command line arguments
const fileName = process.argv[2] || '';

// Log startup
logger.info('App', 'Editor started successfully');
if (fileName) {
  logger.info('App', `Opening file: ${fileName}`);
} else {
  logger.info('App', 'Opening new empty file');
}


// Open the specified file or create a new empty file if no argument provided
windowService.openFile(fileName).catch(error => {
  logger.error('App', `Error opening file "${fileName}":`, error);
  // If there's an error opening the file, create a new empty file
  windowService.openFile('').catch(console.error);
});

// Final render of the screen
screen.render();