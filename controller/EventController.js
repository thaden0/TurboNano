const KeyEvent = require('../models/KeyEvent');
const MenuService = require('../services/MenuService');
const FileSelectModal = require('../modals/FileSelectModal');
const FileService = require('../services/FileService');
const FileMenu = require('../models/menus/FileMenu');
/** @typedef {import('../interfaces/IWindow')} IWindow */

class EventController {
    /**
     * @param {Object} screen - The blessed screen instance
     * @param {Object} windowService - The window service instance
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
        this.menuService = new MenuService(screen);
        
        // Add file menu
        const fileMenu = new FileMenu(this.menuService, 'File', 'C-f');
        fileMenu.addItem('New File', async () => await this._handleNew());
        fileMenu.addItem('Open File', async () => await this._handleOpen());
        fileMenu.addItem('Save File', async () => await this._handleSave());
        fileMenu.addItem('File Explorer', async () => await this._handleFileExplorer());
        fileMenu.addItem('AI Prompt', async () => await this._handleAIPrompt());
        fileMenu.addItem('Settings', async () => await this._handleSettings());
        fileMenu.addItem('Exit', () => process.exit(0));
        
        // Register the menu with the menu service
        this.menuService.addMenu(fileMenu);

        // Add Ctrl-F to show file menu
        this.screen.key(['C-f'], () => {
            if (!this.modalActive) {
                fileMenu.show();
            }
        });
        
        // Add Ctrl-P to activate AI Prompt
        this.screen.key(['C-p'], () => {
            if (!this.modalActive) {
                this._handleAIPrompt();
            }
        });
        
        // Add Ctrl-E to toggle File Explorer
        this.screen.key(['C-e'], () => {
            if (!this.modalActive) {
                this._handleFileExplorer();
            }
        });
        
        // Add F6 to cycle through windows
        this.screen.key(['f6'], () => {
            if (!this.modalActive && this.windowService) {
                this.windowService.next();
            }
        });
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
     * Handles creating a new file
     * @private
     */
    async _handleNew() {
        const currentWindow = this.windowService.getCurrentWindow();
        currentWindow.currentFile = null;
        currentWindow.cursorX = 0;
        currentWindow.cursorY = 0;
        await currentWindow.redraw();
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
                    await currentWindow.redraw();
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
     * Handles saving a file
     * @private
     */
    async _handleSave() {
        const currentWindow = this.windowService.getCurrentWindow();
        if (currentWindow.currentFile) {
            try {
                await this.fileService.saveTextFile(currentWindow.currentFile);
            } catch (error) {
                console.error('Error saving file:', error);
            }
        }
    }

    /**
     * Handles activating the AI Prompt
     * @private
     */
    async _handleAIPrompt() {
        if (this.windowService) {
            this.windowService.createAIPrompt();
        }
    }

    /**
     * Handles opening the settings window
     * @private
     */
    async _handleSettings() {
        if (this.windowService) {
            this.windowService.createSettingsWindow();
        }
    }

    /**
     * Handles toggling the file explorer
     * @private
     */
    async _handleFileExplorer() {
        if (this.windowService) {
            this.windowService.createFileExplorer();
        }
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
    async press(key) {
        if (!key || !key.full) return;
        
        // Find and execute all matching event handlers
        for (const event of this.events) {
            if (event.binding === key.full) {
                try {
                    await event.callback(key);
                } catch (error) {
                    console.error(`Error in event handler for ${key.full}:`, error);
                }
            }
        }

        // Only forward key press to window if no modal is active
        if (!this.modalActive) {
            await this.windowService.getCurrentWindow().press(key);
        }
    }
}

module.exports = EventController;
