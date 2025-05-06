const Window = require('../models/Window');
const blessed = require('blessed');
const KeyEvent = require('../models/KeyEvent');

class WindowService {
    constructor(screen) {
        this.screen = screen;
        // Initialize with a default empty window
        this.currentWindow = Window.createEmpty(this);
        this.editorWindow = null;
        this.insert = true;  // Initialize insert mode to true

        // make sure the terminal cursor is visible
        this.screen.program.showCursor();

        // Add insert mode toggle event
        this.currentWindow.addEvent(new KeyEvent('insert', () => {
            this.insert = !this.insert;
            this.updateCursor();
        }));
    }

    /**
     * Opens a file in the window
     * @param {string} fileName - Name of the file to open
     * @returns {Promise<Window>} - The updated window state
     */
    async openFile(fileName) {
        // Create a new editor window with scrollbar
        this.editorWindow = blessed.box({
            top: 1, // Leave space for a potential status bar
            left: 0,
            width: '100%',
            height: '100%-1',
            border: {
                type: 'line',
                chars: {
                    top: '═',
                    bottom: '═',
                    left: '║',
                    right: '║',
                    topLeft: '╔',
                    topRight: '╗',
                    bottomLeft: '╚',
                    bottomRight: '╝'
                },
            },
            style: {
                border: {
                    fg: 'yellow',
                    bg: 'blue',
                },
                bg: 'blue'
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: '║',
                track: {
                    bg: 'blue'
                },
                style: {
                    inverse: true
                }
            },
            mouse: true
        });

        // Add the window to the screen
        this.screen.append(this.editorWindow);

        // Handle window resize
        const handleResize = () => {
            this.editorWindow.width = '100%';
            this.editorWindow.height = '100%-1';
            this.screen.render();
        };

        // Set up resize handler
        this.screen.on('resize', handleResize);

        // Clean up old resize handler if it exists
        if (this._resizeHandler) {
            this.screen.removeListener('resize', this._resizeHandler);
        }
        this._resizeHandler = handleResize;

        // Add scroll handlers
        this.editorWindow.key(['pagedown'], () => {
            this.editorWindow.scroll(this.editorWindow.height);
            this.screen.render();
        });

        this.editorWindow.key(['pageup'], () => {
            this.editorWindow.scroll(-this.editorWindow.height);
            this.screen.render();
        });

        // Mouse wheel scrolling
        this.editorWindow.on('wheeldown', () => {
            this.editorWindow.scroll(3);
            this.screen.render();
        });

        this.editorWindow.on('wheelup', () => {
            this.editorWindow.scroll(-3);
            this.screen.render();
        });

        // Set focus to the editor window
        this.editorWindow.focus();
        this.screen.render();

        // position & shape the cursor immediately
        this.updateCursor();
        console.log(`Opening file: ${fileName}`);
        return this.currentWindow;
    }

    /**
     * Gets the current window instance
     * @returns {Window} The current window
     */
    getCurrentWindow() {
        return this.currentWindow;
    }

    /**
     * Handles a key press event for the current window
     * @param {Object} key - The key event object from blessed
     */
    press(key) {
        this.currentWindow.press(key);
    }

    /**
     * Set terminal-cursor position & visibility
     */
    updateCursor() {
        const win = this.currentWindow;
        // editorWindow is drawn starting at row 1, and has a border
        const termX = win.cursorX + 1; // +1 for left border
        const termY = win.cursorY - win.scrollOffsetY + 2; // +2 for top position and border, adjust for scroll

        // Only draw cursor if it's in the visible area
        const editorHeight = this.editorWindow.height - 2; // Account for borders
        if (termY >= 2 && termY < editorHeight + 2) { // Check if cursor is in visible area
            // move the real cursor
            this.screen.program.move(termX, termY);
            
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
}

module.exports = WindowService;
