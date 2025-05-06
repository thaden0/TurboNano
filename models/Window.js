const KeyEvent = require('./KeyEvent');
const EditFile = require('./EditFile');
const IndentationService = require('../services/IndentationService');

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
        this.indentationService = new IndentationService();
        
        /** @private */
        this.events = [];

        // Add navigation events
        this.addEvent(new KeyEvent('backspace', (key, win) => this._handleBackspace()));
        this.addEvent(new KeyEvent('up', (key, win) => this._moveCursor(0, -1)));
        this.addEvent(new KeyEvent('down', (key, win) => this._moveCursor(0, 1)));
        this.addEvent(new KeyEvent('left', (key, win) => this._moveCursor(-1, 0)));
        this.addEvent(new KeyEvent('right', (key, win) => this._moveCursor(1, 0)));
        this.addEvent(new KeyEvent('tab', (key, win) => this._handleTab()));
        this.addEvent(new KeyEvent('delete', (key, win) => this._handleDelete()));
        this.addEvent(new KeyEvent('enter', (key, win) => this._handleEnter()));
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
            // Join lines with newlines and trim any extra newlines
            const content = this.currentFile.fileData
                .map(line => line.replace(/[\r\n]/g, '')) // Remove any existing newlines in the lines
                .join('\n');
            this.windowService.editorWindow.setContent(content);
            this.windowService.screen.render();
            // re-position the terminal cursor after redrawing
            this.windowService.updateCursor();
        }
    }

    /**
     * Handles backspace key press
     * @private
     */
    _handleBackspace() {
        if (this.cursorX > 0 || this.cursorY > 0) {
            const currentLine = this.currentFile.fileData[this.cursorY] || '';
            
            if (this.cursorX > 0) {
                // Remove character from current line
                const newLine = currentLine.slice(0, this.cursorX - 1) + currentLine.slice(this.cursorX);
                this.currentFile.fileData[this.cursorY] = newLine;
                this.cursorX--;
            } else if (this.cursorY > 0) {
                // Merge with previous line
                const previousLine = this.currentFile.fileData[this.cursorY - 1] || '';
                this.cursorX = previousLine.length;
                this.currentFile.fileData[this.cursorY - 1] = previousLine + currentLine;
                this.currentFile.fileData.splice(this.cursorY, 1);
                this.cursorY--;
            }
            this.redraw();
        }
    }

    /**
     * Moves the cursor within the bounds of the file content
     * @param {number} dx - Horizontal movement (-1 for left, 1 for right)
     * @param {number} dy - Vertical movement (-1 for up, 1 for down)
     * @private
     */
    _moveCursor(dx, dy) {
        const newY = this.cursorY + dy;
        let newX = this.cursorX + dx;

        // Check vertical bounds
        if (newY >= 0 && newY < this.currentFile.fileData.length) {
            const targetLine = this.currentFile.fileData[newY] || '';
            
            // Adjust horizontal position if moving to a shorter/longer line
            if (dy !== 0) {
                newX = Math.min(this.cursorX, targetLine.length);
            }
            
            // Check horizontal bounds
            if (newX >= 0 && newX <= targetLine.length) {
                this.cursorX = newX;
                this.cursorY = newY;

                // Get editor window dimensions (accounting for borders)
                const editorHeight = this.windowService.editorWindow.height - 2;
                const visibleBottom = this.scrollOffsetY + editorHeight - 1;
                const visibleTop = this.scrollOffsetY;

                // Scroll if cursor moves beyond visible area
                if (this.cursorY > visibleBottom) {
                    this.scrollOffsetY = Math.min(
                        this.cursorY - editorHeight + 1,
                        Math.max(0, this.currentFile.fileData.length - editorHeight)
                    );
                    this.windowService.editorWindow.scrollTo(this.scrollOffsetY);
                } else if (this.cursorY < visibleTop) {
                    this.scrollOffsetY = Math.max(0, this.cursorY);
                    this.windowService.editorWindow.scrollTo(this.scrollOffsetY);
                }
            }
        }
    }

    /**
     * Handles tab key press
     * @private
     */
    _handleTab() {
        const x = this.cursorX + this.scrollOffsetX;
        const indentation = this.indentationService.getIndentation(x);
        this.currentFile.writeText(indentation, x, this.cursorY + this.scrollOffsetY, this.windowService.insert);
        this.cursorX += indentation.length;
        this.redraw();
    }

    /**
     * Handles delete key press
     * @private
     */
    _handleDelete() {
        const currentLine = this.currentFile.fileData[this.cursorY] || '';
        
        if (this.cursorX < currentLine.length) {
            // Delete character at cursor position
            const newLine = currentLine.slice(0, this.cursorX) + currentLine.slice(this.cursorX + 1);
            this.currentFile.fileData[this.cursorY] = newLine;
        } else if (this.cursorY < this.currentFile.fileData.length - 1) {
            // At end of line, join with next line
            const nextLine = this.currentFile.fileData[this.cursorY + 1] || '';
            this.currentFile.fileData[this.cursorY] = currentLine + nextLine;
            this.currentFile.fileData.splice(this.cursorY + 1, 1);
        }
        
        this.redraw();
    }

    /**
     * Handles enter key press
     * @private
     */
    _handleEnter() {
        const currentLine = this.currentFile.fileData[this.cursorY] || '';
        
        // Split the current line at cursor position, removing any newline characters
        const beforeCursor = currentLine.slice(0, this.cursorX).replace(/[\r\n]/g, '');
        const afterCursor = currentLine.slice(this.cursorX).replace(/[\r\n]/g, '');
        
        // Update current line to be everything before cursor
        this.currentFile.fileData[this.cursorY] = beforeCursor;
        
        // Insert new line with everything after cursor
        this.currentFile.fileData.splice(this.cursorY + 1, 0, afterCursor);
        
        // Move cursor to start of new line
        this.cursorY++;
        this.cursorX = 0;

        // Check if we need to scroll
        const editorHeight = this.windowService.editorWindow.height - 2;
        const visibleBottom = this.scrollOffsetY + editorHeight - 1;
        
        if (this.cursorY > visibleBottom) {
            this.scrollOffsetY = Math.min(
                this.cursorY - editorHeight + 1,
                Math.max(0, this.currentFile.fileData.length - editorHeight)
            );
            this.windowService.editorWindow.scrollTo(this.scrollOffsetY);
        }
        
        this.redraw();
    }
}

module.exports = Window;
