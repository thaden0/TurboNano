const blessed = require('blessed');
const KeyEvent = require('./models/KeyEvent');
const WindowService = require('./services/WindowService');
const EventController = require('./controller/EventController');

// Create screen first
const screen = blessed.screen({
  smartCSR: true,
  title: 'Text Editor',
  fullUnicode: true
});

// Initialize services
const windowService = new WindowService(screen);
const eventController = new EventController(screen, windowService);

console.log(
  'MENU ITEMS:',
  [...eventController.getMenuService().getMenuItems()].map(
    ([evt,label]) => `${label}@${evt.binding}`
  )
);

const background = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  tags: false,
  style: {
    fg: 'gray',
    bg: 'black'
  }
});

screen.append(background);
background.setBack();

function fill(char = '░') {
  const width = screen.width;
  const height = screen.height;
  let content = '';
  for (let i = 0; i < height; i++) {
    content += char.repeat(width) + '\n';
  }
  background.setContent(content);
  screen.render();
}

fill();

screen.on('resize', () => {
  fill();
});

// Register key events
eventController.addEvent(new KeyEvent('C-c', () => process.exit(0)));

// Handle all keypresses through the event controller
screen.on('keypress', (ch, key) => {
  eventController.press(key);
});

// Open default file when application starts
windowService.openFile('example.txt').catch(console.error);