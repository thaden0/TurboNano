const KeyEvent = require('../KeyEvent');
const logger = require('../../services/LoggingService');
const AIService = require('../../services/AIService');

/**
 * @class
 * @implements {import('../../interfaces/IWindow').IWindow}
 */
class AIPrompt {
    /**
     * Creates a new AIPrompt window
     * @param {Object} windowService - The window service instance
     */
    constructor(windowService = null) {
        this.windowService = windowService;
        this.promptText = '';
        this.cursorX = 0;
        this.cursorY = 0;
        this.scrollOffsetX = 0;
        this.scrollOffsetY = 0;
        this.currentFile = null;
        
        // Initialize the AI service
        this.aiService = new AIService();
        
        // Set anchoring properties
        this.anchorTop = false;
        this.anchorBottom = true;
        this.anchorLeft = true;
        this.anchorRight = true;
        this.width = null;      // Full width
        this.height = 3;        // Fixed height of 3
        
        // Set styling properties
        this.borderColor = 'green';
        this.focusBorderColor = 'brightGreen';
        this.backgroundColor = 'black';
        this.foregroundColor = 'white';
        
        /** @private */
        this.events = [];
        
        // Add key events
        this.addEvent(new KeyEvent('return', async () => await this._handleSubmit()));
        this.addEvent(new KeyEvent('enter', async () => await this._handleSubmit()));
        // Add additional key binding for Enter key that some terminals might send
        this.addEvent(new KeyEvent('C-m', async () => await this._handleSubmit()));
        this.addEvent(new KeyEvent('\r', async () => await this._handleSubmit()));
        this.addEvent(new KeyEvent('backspace', async () => await this._handleBackspace()));
        this.addEvent(new KeyEvent('up', async () => {})); // Prevent cursor movement to other windows
        this.addEvent(new KeyEvent('down', async () => {})); // Prevent cursor movement to other windows
        this.addEvent(new KeyEvent('left', async () => await this._moveCursor(-1, 0)));
        this.addEvent(new KeyEvent('right', async () => await this._moveCursor(1, 0)));
        this.addEvent(new KeyEvent('escape', async () => await this._handleEscape()));
        // Add additional key binding for Escape key that some terminals might send
        this.addEvent(new KeyEvent('C-[', async () => await this._handleEscape()));
    }
    
    /**
     * Creates a new AIPrompt with default values
     * @param {Object} windowService - The window service instance
     * @returns {AIPrompt}
     */
    static createEmpty(windowService) {
        return new AIPrompt(windowService);
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
        
        // Log the key information for debugging
        logger.debug('AIPrompt', `Key pressed: name=${key.name}, full=${key.full}, sequence=${JSON.stringify(key.sequence)}`);
        
        let eventFound = false;
        // Find and execute all matching event handlers
        for (const event of this.events) {
            if (event.binding === key.full) {
                eventFound = true;
                logger.debug('AIPrompt', `Found matching event handler for: ${key.full}`);
                try {
                    await event.callback(key, this);
                } catch (error) {
                    console.error(`Error in window event handler for ${key.full}:`, error);
                }
            }
        }
        
        // If no matching event was found, handle character input
        if (!eventFound && key.sequence) {
            logger.debug('AIPrompt', `No handler found, treating as character input: ${key.sequence}`);
            // Add the character to the prompt text at cursor position
            this.promptText = 
                this.promptText.substring(0, this.cursorX) + 
                key.sequence + 
                this.promptText.substring(this.cursorX);
            
            this.cursorX++; // Move cursor right after inserting
            await this.redraw();
        }
    }
    
    /**
     * Redraws the window content
     */
    async redraw() {
        const element = this._getElement();
        
        if (this.windowService && element) {
            const promptLines = this.promptText.split('\n');
            const displayText = promptLines.join('\n');
            
            logger.debug('AIPrompt', `Redrawing with text: "${displayText.substring(0, 50)}${displayText.length > 50 ? '...' : ''}"`);
            
            element.setContent(displayText || 'Type your AI prompt here...');
            this.windowService.screen.render();
            
            // re-position the terminal cursor after redrawing
            this.windowService.updateCursor();
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
     * Moves the cursor within the bounds of the prompt text
     * @param {number} dx - Horizontal movement (-1 for left, 1 for right)
     * @param {number} dy - Vertical movement (-1 for up, 1 for down)
     * @private
     */
    async _moveCursor(dx, dy) {
        const newX = this.cursorX + dx;
        
        // Check horizontal bounds
        if (newX >= 0 && newX <= this.promptText.length) {
            this.cursorX = newX;
            await this.redraw();
        }
    }
    
    /**
     * Handles backspace key press
     * @private
     */
    async _handleBackspace() {
        if (this.cursorX > 0) {
            this.promptText = 
                this.promptText.substring(0, this.cursorX - 1) + 
                this.promptText.substring(this.cursorX);
            
            this.cursorX--;
            await this.redraw();
        }
    }
    
    /**
     * Handles enter/return key press - submits the prompt
     * @private
     */
    async _handleSubmit() {
        if (!this.promptText.trim()) {
            // No text, just close the window
            this._closeWindow();
            return;
        }
        
        logger.debug('AIPrompt', `Submitting prompt: "${this.promptText}"`);
        
        // Create result window with initial "Loading..." message
        this._createResultWindow("Loading AI response...");
        
        // Process the prompt with the AI service
        try {
            logger.info('AIPrompt', 'Sending prompt to AI service');
            
            // Get response from AI service
            const response = await this.aiService.generateResponse(this.promptText);
            
            // Log the response to the logging service
            logger.info('AIPrompt', '===== AI RESPONSE =====');
            logger.info('AIPrompt', response);
            logger.info('AIPrompt', '=======================');
            
            // Update the result window with the response
            this._updateResultWindow(response);
            
            logger.info('AIPrompt', 'AI response received and displayed');
        } catch (error) {
            // Show error in result window
            this._updateResultWindow(`Error: ${error.message}`);
            logger.error('AIPrompt', `Error getting AI response: ${error.message}`);
            
            // Log error to the logging service
            logger.error('AIPrompt', '===== AI ERROR =====');
            logger.error('AIPrompt', error.message);
            logger.error('AIPrompt', '===================');
        }
        
        // Clear the prompt text
        this.promptText = '';
        this.cursorX = 0;
        
        // Close the prompt window
        this._closeWindow();
    }
    
    /**
     * Creates a result window to display AI responses
     * @param {string} initialContent - Initial content to display
     * @private
     */
    _createResultWindow(initialContent) {
        if (!this.windowService) return;
        
        // Create a new EditWindow with the response content
        const window = this.windowService.windowFactory.createWindow({
            fileName: 'AI Response',
            content: initialContent,
            windowService: this.windowService,
            // Position it above the prompt
            anchorTop: false,
            anchorBottom: true,
            anchorLeft: true,
            anchorRight: true,
            // Make it taller than the prompt
            height: 15
        });
        
        // Add it to the screen
        this.windowService.addWindow(window);
        
        // Store a reference to this window
        this.resultWindow = window;
    }
    
    /**
     * Updates the content of the result window
     * @param {string} content - The content to display
     * @private
     */
    _updateResultWindow(content) {
        if (!this.resultWindow || !this.resultWindow.currentFile) return;
        
        // Update the content
        this.resultWindow.currentFile.fileData = content.split('\n');
        
        // Redraw the window
        this.resultWindow.redraw();
    }
    
    /**
     * Closes the prompt window
     * @private
     */
    _closeWindow() {
        if (!this.windowService) return;
        
        logger.debug('AIPrompt', 'Closing prompt window');
        try {
            // Find ourselves in the WindowService's windows collection
            const windowIndex = this.windowService.windows.findIndex(w => w.window === this);
            
            if (windowIndex >= 0) {
                // Get our element
                const { element } = this.windowService.windows[windowIndex];
                
                // Remove us from the collection
                this.windowService.windows.splice(windowIndex, 1);
                
                // Detach from screen
                if (element && element.detach) {
                    element.detach();
                }
                
                // If this was the current window, focus another window
                if (this.windowService.currentWindow === this) {
                    if (this.windowService.windows.length > 0) {
                        // Focus the result window if available, otherwise the first window
                        const windowToFocus = this.resultWindow || this.windowService.windows[0].window;
                        this.windowService.focusWindow(windowToFocus);
                    } else {
                        this.windowService.currentWindow = null;
                    }
                }
                
                // Recalculate layout
                if (this.windowService.recalculateLayout) {
                    this.windowService.recalculateLayout();
                }
                
                // Render the screen
                this.windowService.screen.render();
                
                logger.debug('AIPrompt', 'Window removed successfully');
            } else {
                logger.error('AIPrompt', 'Window not found in WindowService collection');
                // As a fallback, try the regular method
                this.windowService.removeWindow(this);
            }
        } catch (error) {
            logger.error('AIPrompt', `Error removing window: ${error.message}`);
            console.error('Error removing window:', error);
        }
    }
    
    /**
     * Handles escape key press - clears the prompt
     * @private
     */
    async _handleEscape() {
        logger.debug('AIPrompt', 'Escape pressed, clearing prompt and closing window');
        
        // Clear the prompt text
        this.promptText = '';
        this.cursorX = 0;
        
        // Close the window
        this._closeWindow();
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
            inputOnFocus: true,
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
        
        return blessed.textarea({
            top: 0,
            left: 0,
            width: '100%',
            height: this.height || 3,
            ...style
        });
    }
}

module.exports = AIPrompt; 