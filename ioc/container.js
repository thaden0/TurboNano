const { Container } = require('inversify');
const TYPES = require('./types/TYPES');
const blessed = require('blessed');

// Import all our services, controllers, and models
const WindowService = require('../services/WindowService');
const MenuService = require('../services/MenuService');
const FileService = require('../services/FileService');
const LoggingService = require('../services/LoggingService');
const ConfigService = require('../services/ConfigService');
const NanorcService = require('../services/NanorcService');
const IndentationService = require('../services/IndentationService');
const AIService = require('../services/AIService');

const EventControllerFactory = require('../controller/EventController');
const WindowFactory = require('../factories/WindowFactory');

// Create and configure container
const container = new Container();

// Create the screen instance
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

// Create background
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

// Bind UI components
container.bind(TYPES.Screen).toConstantValue(screen);
container.bind(TYPES.Background).toConstantValue(background);

// Bind singleton services
container.bind(TYPES.LoggingService).toConstantValue(LoggingService);
container.bind(TYPES.ConfigService).toConstantValue(ConfigService);

// Bind non-singleton services
container.bind(TYPES.WindowService).toConstantValue(new WindowService(screen));
container.bind(TYPES.MenuService).toConstantValue(new MenuService(screen));
container.bind(TYPES.FileService).toConstantValue(new FileService());
container.bind(TYPES.NanorcService).toConstantValue(new NanorcService());
container.bind(TYPES.IndentationService).toConstantValue(new IndentationService());
container.bind(TYPES.AIService).toConstantValue(new AIService());

// Bind controllers using factory functions
container.bind(TYPES.EventController).toDynamicValue((context) => {
    return EventControllerFactory(
        context.container.get(TYPES.Screen),
        context.container.get(TYPES.WindowService),
        context.container.get(TYPES.MenuService),
        context.container.get(TYPES.FileService)
    );
}).inSingletonScope();

// Bind factories
container.bind(TYPES.WindowFactory).toConstantValue(new WindowFactory());

// Export the configured container
module.exports = container; 