const KeyEvent = require('../models/KeyEvent');
const blessed  = require('blessed');

class MenuService {
  /**
   * @param {Screen} screen – the blessed screen instance
   */
  constructor(screen) {
    /** @private */ this.screen    = screen;
    /** @private */ this.menuItems = new Map(); // Map<KeyEvent, string>

    // Initial build (empty)
    this._rebuildListBar();

    // Repaint on resize
    this.screen.on('resize', () => this.screen.render());
  }

  /**
   * Adds a menu item (and key binding) to the bar.
   * @param {KeyEvent} event – must be instanceof KeyEvent
   * @param {string}  label – text to show in the menu
   */
  addEvent(event, label) {
    if (!(event instanceof KeyEvent)) {
      throw new Error('Event must be an instance of KeyEvent');
    }
    this.menuItems.set(event, label);
    this._rebuildListBar();
  }

  /**
   * Returns a copy of the current menu items map.
   * @returns {Map<KeyEvent, string>}
   */
  getMenuItems() {
    return new Map(this.menuItems);
  }

  /** @private Recreate the blessed.listbar with current items */
  _rebuildListBar() {
    // Tear down old bar (if any)
    if (this.listBar) this.listBar.destroy();

    // Build commands object expected by blessed.listbar
    const commands = {};
    for (const [event, label] of this.menuItems.entries()) {
      commands[label] = {
        keys: [ event.binding ],
        callback: event.callback
      };
    }

    // Create a new listbar at the top
    this.listBar = blessed.listbar({
      parent:     this.screen,
      top:        0,
      left:       0,
      width:      '100%',
      height:     1,
      zIndex: 10,
      keys:       true,
      mouse:      true,
      // we supply our own keys, so disable autoCommandKeys
      autoCommandKeys: false,
      style: {
        bg: 'grey',
        item: {
          fg: 'black',
          bg: 'grey',
          hover: { bg: 'blue' }
        },
        selected: { bg: 'blue' }
      },
      commands   // the map of “Label → { keys, callback }”
    });

    this.screen.render();
  }
}

module.exports = MenuService;
