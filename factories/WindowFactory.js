const EditWindow = require('../models/windows/EditWindow');
const EditFile = require('../models/EditFile');

/**
 * @class
 * @implements {import('../interfaces/IWindowFactory').IWindowFactory}
 */
class WindowFactory {
    /**
     * Creates a new window with the specified options
     * @param {Object} options - Window creation options
     * @param {string} options.fileName - Name of the file
     * @param {string} options.content - File content
     * @param {number} options.cursorX - Initial cursor X position
     * @param {number} options.cursorY - Initial cursor Y position
     * @param {number} options.scrollOffsetX - Initial horizontal scroll offset
     * @param {number} options.scrollOffsetY - Initial vertical scroll offset
     * @param {Object} options.windowService - Window service instance
     * @param {boolean} options.anchorTop - Whether to anchor to top of screen
     * @param {boolean} options.anchorBottom - Whether to anchor to bottom of screen
     * @param {boolean} options.anchorLeft - Whether to anchor to left of screen
     * @param {boolean} options.anchorRight - Whether to anchor to right of screen
     * @param {number} options.width - Window width when not anchored to both sides
     * @param {number} options.height - Window height when not anchored to top and bottom
     * @returns {import('../interfaces/IWindow').IWindow} The created window
     */
    createWindow(options) {
        const {
            fileName = '',
            content = '',
            cursorX = 0,
            cursorY = 0,
            scrollOffsetX = 0,
            scrollOffsetY = 0,
            windowService = null,
            anchorTop = false,
            anchorBottom = false,
            anchorLeft = false,
            anchorRight = false,
            width = null,
            height = null
        } = options;

        const editFile = new EditFile(fileName, content);
        const window = new EditWindow(editFile, cursorX, cursorY, scrollOffsetX, scrollOffsetY, windowService);
        
        // Set the anchor and dimension properties
        window.anchorTop = anchorTop;
        window.anchorBottom = anchorBottom;
        window.anchorLeft = anchorLeft;
        window.anchorRight = anchorRight;
        window.width = width;
        window.height = height;
        
        return window;
    }

    /**
     * Creates an empty window with default values
     * @param {Object} windowService - The window service
     * @param {boolean} [anchorTop=false] - Whether to anchor to top of screen
     * @param {boolean} [anchorBottom=false] - Whether to anchor to bottom of screen
     * @param {boolean} [anchorLeft=false] - Whether to anchor to left of screen
     * @param {boolean} [anchorRight=false] - Whether to anchor to right of screen
     * @param {number} [width=null] - Window width when not anchored to both sides
     * @param {number} [height=null] - Window height when not anchored to top and bottom
     * @returns {import('../interfaces/IWindow').IWindow} The created window
     */
    createEmptyWindow(windowService, anchorTop = false, anchorBottom = false, 
                     anchorLeft = false, anchorRight = false, width = null, height = null) {
        const window = EditWindow.createEmpty(windowService);
        
        // Set the anchor and dimension properties
        window.anchorTop = anchorTop;
        window.anchorBottom = anchorBottom;
        window.anchorLeft = anchorLeft;
        window.anchorRight = anchorRight;
        window.width = width;
        window.height = height;
        
        return window;
    }
}

module.exports = WindowFactory; 