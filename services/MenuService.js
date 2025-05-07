const KeyEvent = require('../models/KeyEvent');
const blessed = require('blessed');
const Menu = require('../models/Menu');

class MenuService {
  /**
   * @param {Screen} screen – the blessed screen instance
   */
  constructor(screen) {
    /** @private */ this.screen = screen;
    /** @private */ this.menuItems = new Map(); // Map<KeyEvent, string>
    /** @private */ this.currentBox = null;
    /** @private */ this.currentMenu = null;
    /** @private */ this.selectedIndex = 0;
    /** @private */ this.currentMenuItems = []; // Array of current menu items

    // Initial build (empty)
    this._rebuildListBar();

    // Repaint on resize
    this.screen.on('resize', () => this.screen.render());
  }

  /**
   * Adds a menu item (and key binding) to the bar.
   * @param {KeyEvent} event – must be instanceof KeyEvent
   * @param {string} label – text to show in the menu
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
    if (this.currentListBar) this.currentListBar.destroy();

    // Build commands object expected by blessed.listbar
    const commands = {};
    for (const [event, label] of this.menuItems.entries()) {
      commands[label] = {
        keys: [ event.binding ],
        callback: event.callback
      };
    }

    // Create a new listbar at the top
    this.currentListBar = blessed.listbar({
      parent:     this.screen,
      top:        0,
      left:       0,
      width:      '100%',
      height:     1,
      zIndex:     100, // Ensure menu bar is on top of everything
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
      commands   // the map of "Label → { keys, callback }"
    });

    // Make sure listbar stays on top
    this.currentListBar.setFront();
    
    // Add a default menu item if none exists
    if (Object.keys(commands).length === 0) {
      this.currentListBar.setContent('File (Ctrl+F)');
    }

    this.screen.render();
  }

  /**
   * Shows a menu at the specified position
   * @param {Menu} menu - The menu to display
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  showMenu(menu, x, y) {
    // Clean up any existing menu
    if (this.currentBox) {
      this.currentBox.destroy();
    }

    // Store current menu and reset selection
    this.currentMenu = menu;
    this.selectedIndex = 0;
    this.currentMenuItems = Array.from(menu.getItems());

    // Calculate dimensions
    const labels = this.currentMenuItems.map(([_, label]) => label);
    const maxLength = Math.max(...labels.map(label => label.length));
    const width = maxLength + 4;
    const height = labels.length;

    // Create the menu box
    this.currentBox = blessed.box({
      parent: this.screen,
      top: y,
      left: x,
      width: width,
      height: height,
      style: {
        bg: 'grey',
        fg: 'white',
      },
      tags: true,
      keys: true,
      mouse: true
    });

    // Add key handlers for navigation
    this.currentBox.key(['up'], () => {
      this.selectedIndex = (this.selectedIndex - 1 + height) % height;
      this._renderMenuItems();
    });

    this.currentBox.key(['down'], () => {
      this.selectedIndex = (this.selectedIndex + 1) % height;
      this._renderMenuItems();
    });

    this.currentBox.key(['enter'], () => {
      const [event] = this.currentMenuItems[this.selectedIndex];
      this.hideMenu();
      if (event.callback) {
        event.callback();
      }
    });

    this.currentBox.key(['escape'], () => {
      this.hideMenu();
    });

    // Initial render of menu items
    this._renderMenuItems();

    // Focus the box
    this.currentBox.focus();
    this.screen.render();
  }

  /**
   * @private
   * Renders the current menu items with the selected item highlighted
   */
  _renderMenuItems() {
    if (!this.currentBox || !this.currentMenuItems.length) return;

    const content = this.currentMenuItems.map(([_, label], index) => {
      const isSelected = index === this.selectedIndex;
      return isSelected ? `{red-fg}${label}{/red-fg}` : label;
    }).join('\n');

    this.currentBox.setContent(content);
    this.screen.render();
  }

  /**
   * Hides the current menu if one is shown
   */
  hideMenu() {
    if (this.currentBox) {
      this.currentBox.destroy();
      this.currentBox = null;
      this.currentMenu = null;
      this.screen.render();
    }
  }

  /**
   * Adds a complete menu to the service
   * @param {Menu} menu - The menu to add
   */
  addMenu(menu) {
    if (!menu) return;
    
    // If the menu has a label, create a key binding for it
    if (menu.label) {
      // When the menu key event is triggered, show the menu
      const keyEvent = new KeyEvent(menu.shortcut || 'unknown', () => {
        // Show menu at a position below the menu bar
        this.showMenu(menu, 0, 1);
      });
      
      this.addEvent(keyEvent, menu.label);
    }
  }
}

module.exports = MenuService;
