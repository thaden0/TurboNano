const EditWindow = require('../models/windows/EditWindow');
const blessed = require('blessed');
const KeyEvent = require('../models/KeyEvent');
const WindowFactory = require('../factories/WindowFactory');
const AIPrompt = require('../models/windows/AIPrompt');
const SettingsWindow = require('../models/windows/SettingsWindow');
const FileExplorer = require('../models/windows/FileExplorer');
const logger = require('./LoggingService');
/** @typedef {import('../interfaces/IWindow').IWindow} IWindow */

class WindowService {
    constructor(screen) {
        this.screen = screen;
        this.windowFactory = new WindowFactory();
        
        /** @type {Array<{window: IWindow, element: any}>} */
        this.windows = [];
        
        /** @type {IWindow} */
        this.currentWindow = null;
        this.insert = true;  // Initialize insert mode to true
        
        // The top menu bar height
        this.menuBarHeight = 1;

        // make sure the terminal cursor is visible
        this.screen.program.showCursor();

        // Handle window resize
        this.screen.on('resize', async () => {
            await this.recalculateLayout();
        });
        
        // Create an initial empty window with all four sides anchored
        // This ensures it will always fill the entire available space
        this.addWindow(this.windowFactory.createEmptyWindow(this, true, true, true, true));
    }
    
    /**
     * Adds a window to the screen
     * @param {IWindow} window - The window to add
     * @returns {IWindow} - The added window
     */
    addWindow(window) {
        // Create element using the window's createUIElement method
        let element;
        
        if (typeof window.createUIElement === 'function') {
            // Use the window's createUIElement method
            element = window.createUIElement(blessed);
        } else {
            // Fallback if createUIElement is not implemented
            logger.warn('WindowService', 'Window does not implement createUIElement, using default box');
            element = blessed.box({
                top: 0,
            left: 0,
            width: '100%',
                height: '100%',
                tags: true,
            border: {
                type: 'line',
            },
            style: {
                border: {
                    fg: 'yellow',
                    },
                    bg: 'blue',
            },
            mouse: true
        });
        }
        
        // Add the element to the screen
        this.screen.append(element);
        
        // Add window to our collection
        this.windows.push({ window, element });
        
        // If this is the first window, make it the current window
        if (!this.currentWindow) {
            this.currentWindow = window;
            
            // Add insert mode toggle event to current window
            if (!window.hasInsertEvent) {
                window.addEvent(new KeyEvent('insert', () => {
                    this.insert = !this.insert;
                    this.updateCursor();
                }));
                window.hasInsertEvent = true;
                logger.debug('WindowService', 'Added insert mode toggle event to window');
            }
        }
        
        // Setup mouse wheel scrolling for the window element
        element.on('wheeldown', async () => {
            if (this.currentWindow === window) {
                element.scroll(3);
                await window.redraw();
            }
        });

        element.on('wheelup', async () => {
            if (this.currentWindow === window) {
                element.scroll(-3);
                await window.redraw();
            }
        });
        
        // Setup click to focus
        element.on('click', () => {
            this.focusWindow(window);
        });
        
        // Calculate layout
        this.recalculateLayout();
        
        return window;
    }
    
    /**
     * Removes a window from the screen
     * @param {IWindow} window - The window to remove
     */
    removeWindow(window) {
        logger.debug('WindowService', `Attempting to remove a window, is AIPrompt: ${window instanceof AIPrompt}`);
        
        const index = this.windows.findIndex(w => w.window === window);
        logger.debug('WindowService', `Window index in collection: ${index}`);
        
        if (index >= 0) {
            const { element } = this.windows[index];
            
            // Remove the element from the screen
            logger.debug('WindowService', 'Detaching element from screen');
            element.detach();
            
            // Remove from our collection
            logger.debug('WindowService', `Removing window from collection at index ${index}`);
            this.windows.splice(index, 1);
            
            // If this was the current window, focus another window
            if (this.currentWindow === window) {
                logger.debug('WindowService', 'This was the current window, focusing another window');
                if (this.windows.length > 0) {
                    this.focusWindow(this.windows[0].window);
                } else {
                    this.currentWindow = null;
                }
            }
            
            // Recalculate layout
            logger.debug('WindowService', 'Recalculating layout after window removal');
            this.recalculateLayout();
            
            // Render the screen to apply changes
            logger.debug('WindowService', 'Rendering screen after window removal');
            this.screen.render();
        } else {
            logger.error('WindowService', 'Failed to find window in collection, cannot remove');
        }
    }
    
    /**
     * Focuses a window, making it the current window
     * @param {IWindow} window - The window to focus
     */
    focusWindow(window) {
        if (window && this.windows.some(w => w.window === window)) {
            // Switch current window
            this.currentWindow = window;
            
            // Bring window element to front
            const { element } = this.windows.find(w => w.window === window);
            element.focus();
            
            // Update border colors based on focus state
            this.windows.forEach(entry => {
                const isFocused = entry.window === window;
                const borderColor = isFocused ? 
                    entry.window.focusBorderColor || 'white' : 
                    entry.window.borderColor || 'yellow';
                
                if (entry.element && entry.element.style && entry.element.style.border) {
                    entry.element.style.border.fg = borderColor;
                }
            });
            
            // Update cursor for new window
            this.updateCursor();
            
            // Render changes
            this.screen.render();
        }
    }
    
    /**
     * Recalculates the layout of all windows
     * @returns {Promise<void>}
     */
    async recalculateLayout() {
        logger.debug('WindowService', 'Recalculating layout');
        
        // Get screen dimensions
        const screenWidth = this.screen.width;
        const screenHeight = this.screen.height;
        const menuBarHeight = this.menuBarHeight;
        
        // Find specific window types
        const fileExplorerEntries = this.windows.filter(entry => entry.window instanceof FileExplorer);
        const aiPromptEntries = this.windows.filter(entry => entry.window instanceof AIPrompt);
        const otherWindows = this.windows.filter(entry => 
            !(entry.window instanceof FileExplorer) && 
            !(entry.window instanceof AIPrompt));
        
        // Log window counts
        logger.debug('WindowService', `Window counts - FileExplorers: ${fileExplorerEntries.length}, AIPrompts: ${aiPromptEntries.length}, Others: ${otherWindows.length}`);
        
        // Step 1: Place FileExplorer if present (always on left side)
        let fileExplorerWidth = 0;
        if (fileExplorerEntries.length > 0) {
            for (const { window, element } of fileExplorerEntries) {
                // Calculate dimensions
                element.top = menuBarHeight;
                element.left = 0;
                element.width = window.width || 30; // Default width if not specified
                element.height = screenHeight - menuBarHeight;
                
                fileExplorerWidth = element.width;
            }
        }
        
        // Step 2: Place AIPrompt if present (always at bottom)
        let aiPromptHeight = 0;
        if (aiPromptEntries.length > 0) {
            for (const { window, element } of aiPromptEntries) {
                // Calculate dimensions
                element.height = window.height || 3; // Default height if not specified
                element.top = screenHeight - element.height;
                element.left = fileExplorerWidth; // Start after FileExplorer
                element.width = screenWidth - fileExplorerWidth;
                
                aiPromptHeight = element.height;
            }
        }
        
        // Step 3: Place other windows in remaining space
        const hasAIPrompt = aiPromptEntries.length > 0;
        const hasFileExplorer = fileExplorerEntries.length > 0;
        
        for (const { window, element } of otherWindows) {
            // Default to full screen (minus menu bar)
            element.top = menuBarHeight;
            element.left = 0;
            element.width = screenWidth;
            element.height = screenHeight - menuBarHeight;
            
            // Adjust for FileExplorer if present
            if (hasFileExplorer) {
                element.left = fileExplorerWidth;
                element.width = screenWidth - fileExplorerWidth;
            }
            
            // Adjust for AIPrompt if present
            if (hasAIPrompt) {
                element.height = screenHeight - menuBarHeight - aiPromptHeight;
            }
        }
        
        // Log final window positions
        logger.debug('WindowService', '=== FINAL WINDOW LAYOUT ===');
        for (const entry of this.windows) {
            const { window, element } = entry;
            const type = window.constructor.name;
            logger.debug('WindowService', 
                `${type}: pos(${element.left},${element.top}) size(${element.width}x${element.height})`);
        }
        
        // Redraw all windows
        for (const { window } of this.windows) {
            await window.redraw();
        }
        
        // Update screen
        this.screen.render();
    }
    
    /**
     * Opens a file in a window
     * @param {string} fileName - Name of the file to open
     * @returns {Promise<IWindow>} - The updated window state
     */
    async openFile(fileName) {
        logger.info('WindowService', `Opening file: ${fileName}`);
        
        // Check if we already have a file explorer window
        const hasFileExplorer = this.windows.some(w => w.window instanceof FileExplorer);
        
        // Create a new window for the file with appropriate anchoring
        const window = this.windowFactory.createWindow({
            fileName,
            windowService: this,
            // If file explorer is present, anchor to all sides except left
            // Otherwise anchor to all sides
            anchorTop: true,
            anchorBottom: true, 
            anchorLeft: !hasFileExplorer,  // Don't anchor to left if file explorer exists
            anchorRight: true
        });
        
        // Add the window
        this.addWindow(window);
        
        // Focus the new window
        this.focusWindow(window);
        
        // Redraw to show file content
        await window.redraw();
        
        // Ensure proper layout with other windows
        await this.recalculateLayout();
        
        // Position cursor
        this.updateCursor();
        
        return window;
    }

    /**
     * Update terminal cursor position & visibility
     */
    updateCursor() {
        if (!this.currentWindow) return;
        
        const win = this.currentWindow;
        const { element } = this.windows.find(w => w.window === win) || {};
        
        if (!element) return;
        
        // Calculate cursor position relative to the window element
        const termX = win.cursorX + 1; // +1 for left border
        const termY = win.cursorY - win.scrollOffsetY + 1; // +1 for top border, adjust for scroll
        
        // Calculate absolute position on screen
        const absX = element.left + termX;
        const absY = element.top + termY;

        // Only draw cursor if it's in the visible area
        const elementHeight = element.height - 2; // Account for borders
        if (termY >= 1 && termY <= elementHeight) {
            // Move the real cursor
            this.screen.program.move(absX, absY);
            
            // Set cursor style based on insert mode using ANSI escape sequences
            if (this.insert) {
                // Vertical bar cursor (DECSCUSR 5)
                process.stdout.write('\x1b[5 q');
            } else {
                // Block cursor (DECSCUSR 2)
                process.stdout.write('\x1b[2 q');
            }
        }
        
        this.screen.render();
    }

    /**
     * Gets the current window
     * @returns {IWindow} The current window
     */
    getCurrentWindow() {
        return this.currentWindow;
    }

    /**
     * Creates or toggles an AI prompt window anchored to the bottom of the screen
     * @returns {IWindow} - The created or toggled AI prompt window
     */
    createAIPrompt() {
        // Check if we already have an AI prompt window
        const existingPromptIndex = this.windows.findIndex(w => w.window instanceof AIPrompt);
        
        if (existingPromptIndex >= 0) {
            // We already have an AI prompt, focus it
            const aiPrompt = this.windows[existingPromptIndex].window;
            this.focusWindow(aiPrompt);
            return aiPrompt;
        }
        
        // Create a new AI prompt window
        const aiPrompt = new AIPrompt(this);
        
        // Add it to the screen
        this.addWindow(aiPrompt);
        
        // Focus on it
        this.focusWindow(aiPrompt);
        
        // Return the created window
        return aiPrompt;
    }
    
    /**
     * Creates or toggles a settings window to edit the configuration file
     * @returns {IWindow} - The created or toggled settings window
     */
    createSettingsWindow() {
        // Check if we already have a settings window
        const existingSettingsIndex = this.windows.findIndex(w => w.window instanceof SettingsWindow);
        
        if (existingSettingsIndex >= 0) {
            // We already have a settings window, focus it
            const settingsWindow = this.windows[existingSettingsIndex].window;
            this.focusWindow(settingsWindow);
            return settingsWindow;
        }
        
        // Create a new settings window
        const settingsWindow = new SettingsWindow(this);
        
        // Add it to the screen
        this.addWindow(settingsWindow);
        
        // Focus on it
        this.focusWindow(settingsWindow);
        
        // Return the created window
        return settingsWindow;
    }

    /**
     * Creates or toggles a file explorer window on the left side of the screen
     * @returns {IWindow} - The created or toggled file explorer window
     */
    createFileExplorer() {
        // Check if we already have a file explorer window
        const existingExplorerIndex = this.windows.findIndex(w => w.window instanceof FileExplorer);
        
        if (existingExplorerIndex >= 0) {
            // We already have a file explorer, so toggle its visibility
            if (this.currentWindow === this.windows[existingExplorerIndex].window) {
                // If it's focused, focus something else
                this.next();
                // And remove it
                this.removeWindow(this.windows[existingExplorerIndex].window);
                return null;
            } else {
                // Otherwise focus it
                this.focusWindow(this.windows[existingExplorerIndex].window);
                return this.windows[existingExplorerIndex].window;
            }
        } else {
            // Create a new file explorer
            const fileExplorer = new FileExplorer(this);
            
            // Add to window list
            this.addWindow(fileExplorer);
            
            // Focus it
            this.focusWindow(fileExplorer);
            
            // Recalculate layout
            this.recalculateLayout();
            
            return fileExplorer;
        }
    }

    /**
     * Changes focus to the next window in the list
     * Cycles back to the first window if currently on the last window
     */
    next() {
        logger.debug('WindowService', 'Switching to next window');
        
        if (this.windows.length <= 1) {
            logger.debug('WindowService', 'Only one window available, not switching');
            return; // Nothing to do if we have 0 or 1 windows
        }
        
        // Find current window index
        const currentIndex = this.windows.findIndex(w => w.window === this.currentWindow);
        logger.debug('WindowService', `Current window index: ${currentIndex}`);
        
        if (currentIndex === -1) {
            // Current window not found, focus first window
            logger.debug('WindowService', 'Current window not found in list, focusing first window');
            this.focusWindow(this.windows[0].window);
            return;
        }
        
        // Calculate next index (wrap around to 0 if at the end)
        const nextIndex = (currentIndex + 1) % this.windows.length;
        logger.debug('WindowService', `Switching to window index: ${nextIndex}`);
        
        // Focus the next window
        this.focusWindow(this.windows[nextIndex].window);
    }
}

module.exports = WindowService;
