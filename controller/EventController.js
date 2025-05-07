const KeyEvent = require('../models/KeyEvent');
const MenuService = require('../services/MenuService');
const FileSelectModal = require('../modals/FileSelectModal');
const FileService = require('../services/FileService');
const FileMenu = require('../models/menus/FileMenu');
const ViewMenu = require('../models/menus/ViewMenu');
const AIMenu = require('../models/menus/AIMenu');
const TYPES = require('../ioc/types/TYPES');
/** @typedef {import('../interfaces/IWindow')} IWindow */

class EventController {
    /**
     * @param {Object} screen - The blessed screen instance
     * @param {Object} windowService - The window service instance
     * @param {Object} menuService - The menu service instance
     * @param {Object} fileService - The file service instance
     */
    constructor(screen, windowService, menuService, fileService) {
        /** @private */
        this.screen = screen;
        /** @private */
        this.windowService = windowService;
        /** @private */
        this.events = [];
        /** @private */
        this.modalActive = false;
        /** @private */
        this.fileService = fileService;
        /** @private */
        this.menuService = menuService;
        
        // Add file menu
        const fileMenu = new FileMenu(this.menuService, 'File', 'C-f');
        fileMenu.addItem('New File', async () => await this._handleNew());
        fileMenu.addItem('Open File', async () => await this._handleOpen());
        fileMenu.addItem('Save File', async () => await this._handleSave());
        fileMenu.addItem('Settings', async () => await this._handleSettings());
        fileMenu.addItem('Close Window', async () => await this._handleCloseWindow());
        fileMenu.addItem('Exit', () => process.exit(0));
        
        // Add view menu
        const viewMenu = new ViewMenu(this.windowService);
        
        // Add AI menu
        const aiMenu = new AIMenu(this.windowService);
        
        // Register the menus with the menu service
        this.menuService.addMenu(fileMenu);
        this.menuService.addMenu(viewMenu);
        this.menuService.addMenu(aiMenu);

        // Add Ctrl-F to show file menu
        this.screen.key(['C-f'], () => {
            if (!this.modalActive) {
                fileMenu.show();
            }
        });
        
        // Add Ctrl-V to show view menu
        this.screen.key(['C-v'], () => {
            if (!this.modalActive) {
                this.menuService.showMenu(viewMenu, 0, 1);
            }
        });
        
        // Add Ctrl-A to show AI menu
        this.screen.key(['C-a'], () => {
            if (!this.modalActive) {
                this.menuService.showMenu(aiMenu, 0, 1);
            }
        });
        
        // Add keyboard shortcuts for File Explorer
        // Both Ctrl-E and Ctrl-B can be used to toggle the explorer
        // Ctrl-E is common in many editors, while Ctrl-B is familiar to VS Code users
        this.screen.key(['C-e'], () => {
            if (!this.modalActive) {
                this._handleFileExplorer();
            }
        });
        
        // Add Ctrl-B to toggle File Explorer (alternative shortcut)
        this.screen.key(['C-b'], () => {
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
        
        // Add Ctrl-W to close the current window and select the next
        this.screen.key(['C-w'], () => {
            if (!this.modalActive && this.windowService) {
                this._handleCloseWindow();
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
     * Handles closing the current window and selecting the next
     * @private
     */
    async _handleCloseWindow() {
        if (this.windowService) {
            const currentWindow = this.windowService.getCurrentWindow();
            if (currentWindow) {
                // Make sure we don't close the last window
                if (this.windowService.windows.length > 1) {
                    // Switch to next window first, then remove the current one
                    this.windowService.next();
                    this.windowService.removeWindow(currentWindow);
                }
            }
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
            const currentWindow = this.windowService.getCurrentWindow();
            if (currentWindow) {
                await currentWindow.press(key);
            }
        }
    }
}

// Export a factory function for InversifyJS
module.exports = (screen, windowService, menuService, fileService) => {
    return new EventController(screen, windowService, menuService, fileService);
};
