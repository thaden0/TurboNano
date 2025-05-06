const Window = require('../models/Window');
const blessed = require('blessed');

class WindowService {
    constructor(screen) {
        this.screen = screen;
        // Initialize with a default empty window
        this.currentWindow = Window.createEmpty(this);
        this.editorWindow = null;
        this.insert = true;  // Initialize insert mode to true
    }

    /**
     * Opens a file in the window (stub implementation)
     * @param {string} fileName - Name of the file to open
     * @returns {Promise<Window>} - The updated window state
     */
    async openFile(fileName) {
        // Create a new editor window
        this.editorWindow = blessed.box({
            top: 1, // Leave space for a potential status bar
            left: 0,
            width: '100%',
            height: '100%-1',
            border: {
                type: 'line',
                // override the characters it uses:
                // ╔═╗ ║ ╚═╝
                // these codepoints are the "double line" box-drawing chars
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
            }
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

        // Set focus to the editor window
        this.editorWindow.focus();
        this.screen.render();

        console.log(`Opening file: ${fileName}`);
        return this.currentWindow;
    }

    /**
     * Gets the current window state
     * @returns {Window} - The current window state
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
}

module.exports = WindowService;
