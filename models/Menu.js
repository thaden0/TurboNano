const KeyEvent = require('./KeyEvent');

class Menu {
    /**
     * Creates a new menu
     * @param {string} label - Menu label to show in the menu bar
     * @param {string} shortcut - Keyboard shortcut for this menu (e.g., 'C-f' for Ctrl+F)
     */
    constructor(label = '', shortcut = '') {
        /** @private */        
        this.items = new Map(); // Map<KeyEvent, string>
        
        /**
         * Menu label shown in the menu bar
         * @type {string}
         */
        this.label = label;
        
        /**
         * Keyboard shortcut to activate this menu
         * @type {string}
         */
        this.shortcut = shortcut;
    }

    /**
     * Adds a menu item with an associated event and label
     * @param {KeyEvent|string} eventOrLabel - The event to trigger or a label string
     * @param {Function|string} callbackOrLabel - Callback function if first param is label, or label if first param is event
     * @throws {Error} If parameters don't match expected types
     */
    addEvent(eventOrLabel, callbackOrLabel) {
        let event, label;
        
        if (eventOrLabel instanceof KeyEvent) {
            // Original format: addEvent(event, label)
            event = eventOrLabel;
            label = callbackOrLabel;
        } else if (typeof eventOrLabel === 'string' && typeof callbackOrLabel === 'function') {
            // New format: addEvent(label, callback) - create KeyEvent internally
            label = eventOrLabel;
            event = new KeyEvent('unknown', callbackOrLabel);
        } else {
            throw new Error('Invalid parameters for addEvent');
        }
        
        this.items.set(event, label);
    }
    
    /**
     * Adds a menu item with a label and callback
     * @param {string} label - The label to display
     * @param {Function} callback - Function to call when selected
     */
    addItem(label, callback) {
        const event = new KeyEvent('unknown', callback);
        this.items.set(event, label);
    }

    /**
     * Gets all menu items
     * @returns {Map<KeyEvent, string>} Map of events to labels
     */
    getItems() {
        return new Map(this.items);
    }
}

module.exports = Menu; 