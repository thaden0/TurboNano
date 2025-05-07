const KeyEvent = require('../KeyEvent');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../services/LoggingService');

/**
 * @class
 * @implements {import('../../interfaces/IWindow').IWindow}
 */
class FileExplorer {
    /**
     * Creates a new FileExplorer window
     * @param {Object} windowService - The window service instance
     */
    constructor(windowService = null) {
        this.windowService = windowService;
        this.currentFile = null;
        this.cursorX = 0;
        this.cursorY = 0;
        this.scrollOffsetX = 0;
        this.scrollOffsetY = 0;
        
        // Current directory and file list
        this.currentDirectory = process.cwd();
        this.fileList = [];
        this.selectedIndex = 0;
        
        // Set anchoring properties as specified
        this.anchorTop = false;      // Anchor to top
        this.anchorBottom = false;   // Anchor to bottom
        this.anchorLeft = true;     // Anchor to left edge
        this.anchorRight = false;   // Do not anchor to right edge
        this.width = 30;            // Fixed width of 30 characters (increased from 25 for better visibility)
        this.height = null;         // Full height (from top to bottom)
        
        // Set styling properties
        this.borderColor = 'blue';
        this.focusBorderColor = 'brightBlue';
        this.backgroundColor = 'black';
        this.foregroundColor = 'white';
        
        /** @private */
        this.events = [];
        
        // Add key events
        this.addEvent(new KeyEvent('up', async () => await this._handleUp()));
        this.addEvent(new KeyEvent('down', async () => await this._handleDown()));
        this.addEvent(new KeyEvent('enter', async () => await this._handleEnter()));
        this.addEvent(new KeyEvent('return', async () => await this._handleEnter()));
        this.addEvent(new KeyEvent('backspace', async () => await this._handleBackspace()));
        this.addEvent(new KeyEvent('escape', async () => await this._handleEscape()));
        
        // Load initial file list
        this._loadDirectory(this.currentDirectory);
    }
    
    /**
     * Creates a new FileExplorer with default values
     * @param {Object} windowService - The window service instance
     * @returns {FileExplorer}
     */
    static createEmpty(windowService) {
        return new FileExplorer(windowService);
    }
    
    /**
     * Adds an event handler to the window
     * @param {KeyEvent} event - The event to add
     */
    addEvent(event) {
        this.events.push(event);
    }
    
    /**
     * Handles a key press event for the window
     * @param {Object} key - The key event object from blessed
     */
    async press(key) {
        if (!key || !key.full) return;
        
        let eventFound = false;
        // Find and execute matching event handlers
        for (const event of this.events) {
            if (event.binding === key.full) {
                eventFound = true;
                logger.debug('FileExplorer', `Executing handler for key: ${key.full}`);
                try {
                    await event.callback(key, this);
                } catch (error) {
                    logger.error('FileExplorer', `Error in window event handler for ${key.full}: ${error.message}`);
                }
            }
        }
        
        // Character input is not used in the file explorer
    }
    
    /**
     * Redraws the window content
     */
    async redraw() {
        const element = this._getElement();
        
        if (this.windowService && element) {
            // Calculate visible range based on window height
            const height = element.height - 2; // Subtract 2 for borders
            const startIndex = Math.max(0, this.scrollOffsetY);
            const endIndex = Math.min(startIndex + height, this.fileList.length);
            
            // Get visible items
            const visibleItems = this.fileList.slice(startIndex, endIndex);
            
            // Generate directory header
            const header = `${this.currentDirectory}`;
            
            // Format the file list
            const content = [
                header,
                '-'.repeat(Math.min(header.length, this.width - 2)),
                ...visibleItems.map((item, index) => {
                    const isSelected = index + startIndex === this.selectedIndex;
                    const prefix = isSelected ? '> ' : '  ';
                    const suffix = item.isDirectory ? '/' : '';
                    return `${prefix}${item.name}${suffix}`;
                })
            ].join('\n');
            
            element.setContent(content);
            this.windowService.screen.render();
        }
    }
    
    /**
     * Gets the blessed UI element associated with this window
     * @private
     * @returns {Object|null} The blessed element or null if not found
     */
    _getElement() {
        if (!this.windowService || !this.windowService.windows) return null;
        
        const windowEntry = this.windowService.windows.find(w => w.window === this);
        return windowEntry ? windowEntry.element : null;
    }
    
    /**
     * Handles up key press - move selection up
     * @private
     */
    async _handleUp() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            
            // Scroll if necessary
            if (this.selectedIndex < this.scrollOffsetY) {
                this.scrollOffsetY = this.selectedIndex;
            }
            
            await this.redraw();
        }
    }
    
    /**
     * Handles down key press - move selection down
     * @private
     */
    async _handleDown() {
        if (this.selectedIndex < this.fileList.length - 1) {
            this.selectedIndex++;
            
            // Calculate visible height
            const element = this._getElement();
            const visibleHeight = element ? element.height - 2 : 10;
            
            // Scroll if necessary
            if (this.selectedIndex >= this.scrollOffsetY + visibleHeight) {
                this.scrollOffsetY = this.selectedIndex - visibleHeight + 1;
            }
            
            await this.redraw();
        }
    }
    
    /**
     * Handles enter key press - open selected file or directory
     * @private
     */
    async _handleEnter() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.fileList.length) {
            const selected = this.fileList[this.selectedIndex];
            
            if (selected.isDirectory) {
                // Open directory
                const newPath = path.join(this.currentDirectory, selected.name);
                await this._loadDirectory(newPath);
            } else {
                // Open file
                if (this.windowService) {
                    const filePath = path.join(this.currentDirectory, selected.name);
                    logger.info('FileExplorer', `Opening file: ${filePath}`);
                    
                    // Open the file in a new window
                    const newWindow = await this.windowService.openFile(filePath);
                    
                    // Ensure the newly opened file window is focused
                    if (newWindow) {
                        this.windowService.focusWindow(newWindow);
                        
                        // Log info about the newly opened window
                        logger.info('FileExplorer', `Successfully opened file in new window: ${filePath}`);
                    } else {
                        logger.error('FileExplorer', `Failed to open file: ${filePath}`);
                    }
                }
            }
        }
    }
    
    /**
     * Handles backspace key press - go up one directory
     * @private
     */
    async _handleBackspace() {
        const parentDir = path.dirname(this.currentDirectory);
        if (parentDir !== this.currentDirectory) {
            await this._loadDirectory(parentDir);
        }
    }
    
    /**
     * Handles escape key press
     * @private
     */
    async _handleEscape() {
        // Focus the main edit window if available
        if (this.windowService && this.windowService.windows.length > 0) {
            const editWindow = this.windowService.windows.find(w => 
                w.window.constructor.name === 'EditWindow' &&
                w.window !== this
            );
            
            if (editWindow) {
                this.windowService.focusWindow(editWindow.window);
            }
        }
    }
    
    /**
     * Loads a directory into the file explorer
     * @param {string} directoryPath - Path to the directory to load
     * @private
     */
    async _loadDirectory(directoryPath) {
        try {
            // Read directory contents
            const items = await fs.readdir(directoryPath, { withFileTypes: true });
            
            // Create a sorted list with directories first
            this.fileList = items
                .map(item => ({
                    name: item.name,
                    isDirectory: item.isDirectory()
                }))
                .sort((a, b) => {
                    // Directories first, then alphabetical
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
            
            // Add parent directory entry if not at root
            const parentDir = path.dirname(directoryPath);
            if (parentDir !== directoryPath) {
                this.fileList.unshift({
                    name: '..',
                    isDirectory: true
                });
            }
            
            // Update current directory
            this.currentDirectory = directoryPath;
            
            // Reset selection and scroll position
            this.selectedIndex = 0;
            this.scrollOffsetY = 0;
            
            // Redraw to show new content
            await this.redraw();
        } catch (error) {
            logger.error('FileExplorer', `Error loading directory ${directoryPath}: ${error.message}`);
        }
    }
    
    /**
     * Gets the styling information for the window's UI element
     * @returns {Object} Style object with border, background, and other styling properties
     */
    getStyle() {
        // Get the current window to determine if this window is focused
        const isFocused = this.windowService && 
                         this.windowService.getCurrentWindow() === this;
        
        return {
            border: {
                type: 'line',
                fg: isFocused ? this.focusBorderColor : this.borderColor
            },
            bg: this.backgroundColor,
            fg: this.foregroundColor,
            label: ' Files ',
            scrollbar: {
                bg: 'blue',
                fg: 'white'
            }
        };
    }
    
    /**
     * Creates the UI element for this window
     * @param {Object} blessed - The blessed library object
     * @returns {Object} A blessed UI element for this window
     */
    createUIElement(blessed) {
        const style = this.getStyle();
        
        return blessed.box({
            top: 0,          // Will be positioned by WindowService
            left: 0,         // Will be positioned by WindowService
            width: '100%',   // Will be resized by WindowService
            height: '100%',  // Will be resized by WindowService
            content: 'Loading file explorer...',
            tags: true,
            border: style.border,
            label: style.label,
            style: {
                fg: style.fg,
                bg: style.bg,
                border: style.border,
                scrollbar: style.scrollbar
            },
            scrollable: true,
            mouse: true,
            keys: true,
            vi: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                inverse: true
            }
        });
    }
}

module.exports = FileExplorer; 