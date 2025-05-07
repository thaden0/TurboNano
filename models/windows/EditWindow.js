const KeyEvent = require('../KeyEvent');
const EditFile = require('../EditFile');
const IndentationService = require('../../services/IndentationService');
const NanorcService = require('../../services/NanorcService');
const logger = require('../../services/LoggingService');
const clipboardy = require('clipboardy');

/**
 * @class
 * @implements {import('../../interfaces/IWindow').IWindow}
 */
class EditWindow {
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
        this.nanorcService = new NanorcService();
        
        // Initialize window positioning properties
        this.anchorTop = false;    // No anchoring by default
        this.anchorBottom = false;
        this.anchorLeft = false;   // No anchoring by default
        this.anchorRight = false;
        this.width = null;         // null means fill available space
        this.height = null;        // null means fill available space
        
        // Set styling properties
        this.borderColor = 'yellow';
        this.focusBorderColor = 'white';
        this.backgroundColor = 'blue';
        this.foregroundColor = 'white';
        
        /** @private */
        this.events = [];

        this._registerDefaultKeyEvents();
    }

    /**
     * Register default key events for the window
     * @private
     */
    _registerDefaultKeyEvents() {
        // Add navigation events
        this.addEvent(new KeyEvent('backspace', async (key, win) => await this._handleBackspace()));
        this.addEvent(new KeyEvent('up', async (key, win) => await this._moveCursor(0, -1)));
        this.addEvent(new KeyEvent('down', async (key, win) => await this._moveCursor(0, 1)));
        this.addEvent(new KeyEvent('left', async (key, win) => await this._moveCursor(-1, 0)));
        this.addEvent(new KeyEvent('right', async (key, win) => await this._moveCursor(1, 0)));
        this.addEvent(new KeyEvent('tab', async (key, win) => await this._handleTab()));
        this.addEvent(new KeyEvent('delete', async (key, win) => await this._handleDelete()));
        this.addEvent(new KeyEvent('enter', async (key, win) => await this._handleEnter()));
        
        // Add page navigation events
        this.addEvent(new KeyEvent('pageup', async (key, win) => await this._handlePageUp()));
        this.addEvent(new KeyEvent('pagedown', async (key, win) => await this._handlePageDown()));
        this.addEvent(new KeyEvent('home', async (key, win) => await this._handleHome()));
        this.addEvent(new KeyEvent('end', async (key, win) => await this._handleEnd()));
        
        // Add clipboard events
        this.addEvent(new KeyEvent('C-v', async (key, win) => await this._handlePaste()));
    }

    /**
     * Creates a new EditWindow with default values
     * @param {WindowService} windowService - The window service instance
     * @returns {EditWindow}
     */
    static createEmpty(windowService) {
        return new EditWindow(new EditFile('', ''), 0, 0, 0, 0, windowService);
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
        // Find and execute all matching event handlers
        for (const event of this.events) {
            if (event.binding === key.full) {
                eventFound = true;
                try {
                    await event.callback(key, this);
                } catch (error) {
                    logger.error('EditWindow', `Error in window event handler for ${key.full}: ${error.message}`);
                }
            }
        }

        // If no matching event was found, handle character input
        if (!eventFound && key.sequence) {
            const x = this.cursorX + this.scrollOffsetX;
            const y = this.cursorY + this.scrollOffsetY;
            this.currentFile.writeText(key.sequence, x, y, this.windowService.insert);
            this.cursorX++; // Move cursor right after inserting
            await this.redraw();
        }
    }

    /**
     * Redraws the window content
     */
    async redraw() {
        const element = this._getElement();
        
        if (!this.windowService || !element) return;
            
        // Get the visible area dimensions
        const editorHeight = this._getContentHeight();
        const startLine = this.scrollOffsetY;
        const endLine = Math.min(startLine + editorHeight, this.currentFile.fileData.length);

        // Get the filename for syntax highlighting
        const filename = this.currentFile.fileName || '';
        logger.debug('Window', `Redrawing window with file: ${filename}`);
        logger.debug('Window', `Visible lines: ${startLine} to ${endLine}`);

        // Process only the visible lines
        const visibleLines = this.currentFile.fileData
            .slice(startLine, endLine)
            .map(line => line.replace(/[\r\n]/g, '')); // Remove any existing newlines
        
        logger.debug('Window', `Number of visible lines: ${visibleLines.length}`);

        // Apply syntax highlighting to each line
        logger.debug('Window', 'Applying syntax highlighting to visible lines...');
        const styledLines = await Promise.all(visibleLines.map(async (line, index) => {
            const styled = await this.nanorcService.style(line, filename);
            logger.debug('Window', `Line ${index + startLine} styled result: "${styled.substring(0, 50)}${styled.length > 50 ? '...' : ''}"`);
            return styled;
        }));

        // Join the styled lines with newlines
        const content = styledLines.join('\n');
        logger.debug('Window', `Setting content with ${styledLines.length} styled lines`);
        logger.debug('Window', `Final content preview: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);

        element.setContent(content);
        this.windowService.screen.render();
        
        // re-position the terminal cursor after redrawing
        this.windowService.updateCursor();
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
     * Gets the height of the content area (excluding borders)
     * @private
     * @returns {number} The content height
     */
    _getContentHeight() {
        const element = this._getElement();
        return element ? element.height - 2 : 0; // Subtract 2 for borders
    }
    
    /**
     * Scrolls the element to the specified position
     * @private
     * @param {number} position - The position to scroll to
     */
    _scrollTo(position) {
        const element = this._getElement();
        if (element && element.scrollTo) {
            element.scrollTo(position);
        }
    }

    /**
     * Adjusts scroll position to keep cursor visible
     * @private
     */
    _adjustScrollForCursor() {
        const editorHeight = this._getContentHeight();
        const visibleBottom = this.scrollOffsetY + editorHeight - 1;
        const visibleTop = this.scrollOffsetY;

        // Scroll if cursor moves beyond visible area
        if (this.cursorY > visibleBottom) {
            this.scrollOffsetY = Math.min(
                this.cursorY - editorHeight + 1,
                Math.max(0, this.currentFile.fileData.length - editorHeight)
            );
            this._scrollTo(this.scrollOffsetY);
        } else if (this.cursorY < visibleTop) {
            this.scrollOffsetY = Math.max(0, this.cursorY);
            this._scrollTo(this.scrollOffsetY);
        }
    }

    /**
     * Gets absolute position (accounting for scroll)
     * @private
     * @returns {Object} x and y coordinates
     */
    _getAbsolutePosition() {
        return {
            x: this.cursorX + this.scrollOffsetX,
            y: this.cursorY + this.scrollOffsetY
        };
    }

    /**
     * Moves the cursor within the bounds of the file content
     * @param {number} dx - Horizontal movement (-1 for left, 1 for right)
     * @param {number} dy - Vertical movement (-1 for up, 1 for down)
     * @private
     */
    async _moveCursor(dx, dy) {
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
                this._adjustScrollForCursor();
            }
        }
        await this.redraw();
    }

    /**
     * Handles tab key press
     * @private
     */
    async _handleTab() {
        const pos = this._getAbsolutePosition();
        const indentation = this.indentationService.getIndentation(pos.x);
        this.currentFile.writeText(indentation, pos.x, pos.y, this.windowService.insert);
        this.cursorX += indentation.length;
        await this.redraw();
    }

    /**
     * Handles backspace key press
     * @private
     */
    async _handleBackspace() {
        const pos = this._getAbsolutePosition();
        
        if (pos.x > 0) {
            // If we're not at the start of a line, just delete the previous character
            this.currentFile.deleteChar(pos.x - 1, pos.y);
            this.cursorX--;
        } else if (pos.y > 0) {
            // If we're at the start of a line (but not the first line),
            // join this line with the previous line
            const currentLine = this.currentFile.fileData[pos.y];
            const previousLine = this.currentFile.fileData[pos.y - 1];
            
            // Remove the current line and append its content to the previous line
            this.currentFile.fileData.splice(pos.y, 1);
            this.cursorX = previousLine.length;
            this.cursorY--;
            
            if (currentLine.length > 0) {
                this.currentFile.fileData[pos.y - 1] = previousLine + currentLine;
            }
        }
        
        await this.redraw();
    }

    /**
     * Handles delete key press
     * @private
     */
    async _handleDelete() {
        const pos = this._getAbsolutePosition();
        
        if (pos.x < this.currentFile.fileData[pos.y].length) {
            // If we're not at the end of a line, just delete the current character
            this.currentFile.deleteChar(pos.x, pos.y);
        } else if (pos.y < this.currentFile.fileData.length - 1) {
            // If we're at the end of a line (but not the last line),
            // join this line with the next line
            const currentLine = this.currentFile.fileData[pos.y];
            const nextLine = this.currentFile.fileData[pos.y + 1];
            
            // Remove the next line and append its content to the current line
            this.currentFile.fileData.splice(pos.y + 1, 1);
            if (nextLine.length > 0) {
                this.currentFile.fileData[pos.y] = currentLine + nextLine;
            }
        }
        
        await this.redraw();
    }

    /**
     * Handles enter key press
     * @private
     */
    async _handleEnter() {
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
        
        // Adjust scroll if needed
        this._adjustScrollForCursor();
        
        await this.redraw();
    }

    /**
     * Handles page up key press - moves cursor up by editor height
     * @private
     */
    async _handlePageUp() {
        const editorHeight = this._getContentHeight();
        const moveAmount = Math.max(1, Math.floor(editorHeight * 0.9)); // Move 90% of visible area
        
        // Calculate new cursor position and scroll offset
        const newY = Math.max(0, this.cursorY - moveAmount);
        const targetLine = this.currentFile.fileData[newY] || '';
        this.cursorX = Math.min(this.cursorX, targetLine.length);
        this.cursorY = newY;
        
        // Update scroll offset to keep cursor visible
        this.scrollOffsetY = Math.max(0, this.cursorY - Math.floor(editorHeight / 2));
        this._scrollTo(this.scrollOffsetY);
        
        await this.redraw();
    }

    /**
     * Handles page down key press - moves cursor down by editor height
     * @private
     */
    async _handlePageDown() {
        const editorHeight = this._getContentHeight();
        const moveAmount = Math.max(1, Math.floor(editorHeight * 0.9)); // Move 90% of visible area
        const lastLine = this.currentFile.fileData.length - 1;
        
        // Calculate new cursor position and scroll offset
        const newY = Math.min(lastLine, this.cursorY + moveAmount);
        const targetLine = this.currentFile.fileData[newY] || '';
        this.cursorX = Math.min(this.cursorX, targetLine.length);
        this.cursorY = newY;
        
        // Update scroll offset to keep cursor visible
        const maxScroll = Math.max(0, this.currentFile.fileData.length - editorHeight);
        this.scrollOffsetY = Math.min(maxScroll, this.cursorY - Math.floor(editorHeight / 2));
        this._scrollTo(this.scrollOffsetY);
        
        await this.redraw();
    }

    /**
     * Handles home key press - moves cursor to start of line
     * @private
     */
    async _handleHome() {
        this.cursorX = 0;
        await this.redraw();
    }

    /**
     * Handles end key press - moves cursor to end of line
     * @private
     */
    async _handleEnd() {
        const currentLine = this.currentFile.fileData[this.cursorY] || '';
        this.cursorX = currentLine.length;
        await this.redraw();
    }

    /**
     * Handles paste operation (Ctrl+V)
     * @private
     */
    async _handlePaste() {
        try {
            // Get text from system clipboard
            const clipboardText = await clipboardy.read();
            
            if (!clipboardText || clipboardText.length === 0) {
                logger.debug('EditWindow', 'Clipboard is empty, nothing to paste');
                return;
            }
            
            logger.debug('EditWindow', `Pasting content from clipboard, length: ${clipboardText.length}`);
            
            // Split clipboard text into lines
            const lines = clipboardText.split(/\r?\n/);
            const pos = this._getAbsolutePosition();
            
            if (lines.length === 1) {
                // Single line paste - insert at cursor position
                this.currentFile.writeText(clipboardText, pos.x, pos.y, this.windowService.insert);
                this.cursorX += clipboardText.length;
            } else {
                // Multi-line paste
                const firstLine = lines[0];
                const remainingLines = lines.slice(1);
                
                // Get current line and position
                const currentLine = this.currentFile.fileData[pos.y] || '';
                
                // Split current line at cursor
                const beforeCursor = currentLine.slice(0, pos.x);
                const afterCursor = currentLine.slice(pos.x);
                
                // Update current line with first part of pasted text
                this.currentFile.fileData[pos.y] = beforeCursor + firstLine;
                
                // Insert remaining lines
                for (let i = 0; i < remainingLines.length; i++) {
                    const lineContent = remainingLines[i] + (i === remainingLines.length - 1 ? afterCursor : '');
                    this.currentFile.fileData.splice(pos.y + i + 1, 0, lineContent);
                }
                
                // Update cursor position to end of pasted text
                this.cursorY += remainingLines.length;
                if (remainingLines.length > 0) {
                    this.cursorX = remainingLines[remainingLines.length - 1].length;
                } else {
                    this.cursorX += firstLine.length;
                }
            }
            
            // Adjust scroll if needed
            this._adjustScrollForCursor();
            
            await this.redraw();
        } catch (error) {
            logger.error('EditWindow', `Error pasting from clipboard: ${error.message}`);
        }
    }

    /**
     * Gets the styling information for the window's UI element
     * @returns {Object} Style object with border, background, and other styling properties
     */
    getStyle() {
        return {
            border: {
                type: 'line',
            },
            style: {
                border: {
                    fg: this.borderColor,
                    bg: this.backgroundColor,
                },
                bg: this.backgroundColor,
                fg: this.foregroundColor,
                focus: {
                    border: {
                        fg: this.focusBorderColor
                    }
                }
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: '║',
                track: {
                    bg: this.backgroundColor
                },
                style: {
                    inverse: true
                }
            },
            mouse: true
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
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            tags: true,
            zIndex: 5,
            ...style
        });
    }
}

module.exports = EditWindow;
