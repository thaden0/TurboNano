const KeyEvent = require('./KeyEvent');

class Menu {
    constructor() {
        /** @private */        
        this.items = new Map(); // Map<KeyEvent, string>
    }

    /**
     * Adds a menu item with an associated event and label
     * @param {KeyEvent} event - The event to trigger
     * @param {string} label - The label to display
     * @throws {Error} If event is not a KeyEvent instance
     */
    addEvent(event, label) {
        if (!(event instanceof KeyEvent)) {
            throw new Error('Event must be an instance of KeyEvent');
        }
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