const Menu = require('../Menu');
const KeyEvent = require('../KeyEvent');

class FileMenu extends Menu {
    /**
     * @param {MenuService} menuService - The menu service instance
     * @param {string} label - Menu label (defaults to 'File')
     * @param {string} shortcut - Keyboard shortcut (defaults to 'C-f')
     */
    constructor(menuService, label = 'File', shortcut = 'C-f') {
        super(label, shortcut);
        this.menuService = menuService;
    }

    /**
     * Shows the file menu
     */
    show() {
        this.menuService.showMenu(this, 0, 1);
    }

    /**
     * Adds a menu item
     * @param {string} label - The menu item label
     * @param {Function} callback - The callback to execute when selected
     */
    addItem(label, callback) {
        const event = new KeyEvent(label.toLowerCase().charAt(0), callback);
        this.items.set(event, label);
    }
}

module.exports = FileMenu; 