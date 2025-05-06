const KeyEvent = require('./KeyEvent');
const EditFile = require('./EditFile');

class Window {
    /**
     * @param {EditFile} currentFile - The currently opened file
     * @param {number} cursorX - Current X position of the cursor
     * @param {number} cursorY - Current Y position of the cursor
     * @param {number} scrollOffsetX - Horizontal scroll offset
     * @param {number} scrollOffsetY - Vertical scroll offset
     * @param {Object} windowService - The window service instance
     */
    constructor(currentFile = null, cursorX = 0, cursorY = 0, scrollOffsetX = 0, scrollOffsetY = 0, windowService = null) {
        this.currentFile = currentFile;
        this.cursorX = cursorX;
        this.cursorY = cursorY;
        this.scrollOffsetX = scrollOffsetX;
        this.scrollOffsetY = scrollOffsetY;
        this.windowService = windowService;
        
        /** @private */
        this.events = [];
    }

    /**
     * Creates a new Window with default values
     * @param {WindowService} windowService - The window service instance
     * @returns {Window}
     */
    static createEmpty(windowService) {
        return new Window(new EditFile('', ''), 0, 0, 0, 0, windowService);
    }

    /**
     * Adds an event handler to the window
     * @param {Event} event - The event to add
     * @throws {Error} If the event is not an instance of Event
     */
    addEvent(event) {
        if (!(event instanceof KeyEvent)) {
            throw new Error('Event must be an instance of KeyEvent class');
        }
        this.events.push(event);
    }

    /**
     * Handles a key press event for the window
     * @param {Object} key - The key event object from blessed
     */
    press(key) {
        if (!key || !key.full) return;
        
        let eventFound = false;
        // Find and execute all matching event handlers
        this.events.forEach(event => {
            if (event.binding === key.full) {
                eventFound = true;
                try {
                    event.callback(key, this);
                } catch (error) {
                    console.error(`Error in window event handler for ${key.full}:`, error);
                }
            }
        });

        // If no matching event was found, handle character input
        if (!eventFound && key.sequence) {
            const x = this.cursorX + this.scrollOffsetX;
            const y = this.cursorY + this.scrollOffsetY;
            this.currentFile.writeText(key.sequence, x, y, this.windowService.insert);
            this.cursorX++; // Move cursor right after inserting
        }

        // Update the window content
        this.redraw();
    }

    /**
     * Redraws the window content
     */
    redraw() {
        if (this.windowService && this.windowService.editorWindow) {
            // Join all lines with newlines to create the content
            const content = this.currentFile.fileData.join('\n');
            this.windowService.editorWindow.setContent(content);
            this.windowService.screen.render();
        }
    }
}

module.exports = Window;
