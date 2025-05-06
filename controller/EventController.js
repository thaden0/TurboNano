const KeyEvent = require('../models/KeyEvent');
const MenuService = require('../services/MenuService');
const FileSelectModal = require('../modals/FileSelectModal');
const FileService = require('../services/FileService');
const FileMenu = require('../models/FileMenu');
const fs = require('fs').promises;

class EventController {
    /**
     * @param {Object} screen - The blessed screen instance
     * @param {WindowService} windowService - The window service instance
     */
    constructor(screen, windowService) {
        /** @private */
        this.screen = screen;
        /** @private */
        this.windowService = windowService;
        /** @private */
        this.events = [];
        /** @private */
        this.modalActive = false;
        /** @private */
        this.fileService = new FileService();
        /** @private */
        this.fileMenu = new FileMenu(this);
        
        // Initialize menu service
        this.menuService = new MenuService(screen);
        this._setupDefaultMenuItems();
    }

    /**
     * Adds an event to the controller
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
     * Saves the current file
     * @private
     */
    async _handleSave() {
        this.modalActive = true;
        const modal = new FileSelectModal(this.screen, {
            startDir: process.cwd(),
            onSelect: async (filePath) => {
                try {
                    const currentWindow = this.windowService.getCurrentWindow();
                    const content = currentWindow.currentFile.fileData.join('\n');
                    await fs.writeFile(filePath, content, 'utf8');
                    currentWindow.currentFile.fileName = filePath;
                    // Redraw to update any UI elements showing the filename
                    currentWindow.redraw();
                } catch (error) {
                    console.error('Error saving file:', error);
                } finally {
                    this.modalActive = false;
                }
            },
            onCancel: () => {
                this.modalActive = false;
            }
        });
        modal.show();
    }

    /**
     * Handles opening a file
     * @private
     */
    async _handleOpen() {
        this.modalActive = true;
        const modal = new FileSelectModal(this.screen, {
            startDir: process.cwd(),
            onSelect: async (filePath) => {
                try {
                    const editFile = await this.fileService.getTextFile(filePath);
                    const currentWindow = this.windowService.getCurrentWindow();
                    currentWindow.currentFile = editFile;
                    currentWindow.cursorX = 0;
                    currentWindow.cursorY = 0;
                    currentWindow.redraw();
                } catch (error) {
                    console.error('Error opening file:', error);
                } finally {
                    this.modalActive = false;
                }
            },
            onCancel: () => {
                this.modalActive = false;
            }
        });
        modal.show();
    }

    /**
     * Sets up default menu items
     * @private
     */
    _setupDefaultMenuItems() {        
        this.menuService.addEvent(
            new KeyEvent('C-f', () => this.menuService.showMenu(this.fileMenu, 2, 2)),
            'File'
        );
    }

    /**
     * Gets the menu service instance
     * @returns {MenuService}
     */
    getMenuService() {
        return this.menuService;
    }

    /**
     * Gets all registered events
     * @returns {Array<Event>} Array of registered events
     */
    getEvents() {
        return [...this.events]; // Return a copy to prevent direct modification
    }

    /**
     * Clears all registered events
     */
    clearEvents() {
        this.events = [];
    }

    /**
     * Handles key press events by triggering matching event callbacks
     * @param {Object} key - The key event object from blessed
     */
    press(key) {
        if (!key || !key.full) return;
        
        // Find and execute all matching event handlers
        this.events.forEach(event => {
            if (event.binding === key.full) {
                try {
                    event.callback(key);
                } catch (error) {
                    console.error(`Error in event handler for ${key.full}:`, error);
                }
            }
        });

        // Only forward key press to window if no modal is active
        if (!this.modalActive) {
            this.windowService.getCurrentWindow().press(key);
        }
    }
}

module.exports = EventController;
