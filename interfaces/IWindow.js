/**
 * @interface IWindow
 * Interface that defines the contract for window implementations
 */

/**
 * Adds an event handler to the window
 * @function
 * @name IWindow#addEvent
 * @param {KeyEvent} event - The event to add
 */

/**
 * Handles a key press event for the window
 * @function
 * @name IWindow#press
 * @param {Object} key - The key event object from blessed
 * @returns {Promise<void>}
 */

/**
 * Redraws the window content
 * @function
 * @name IWindow#redraw
 * @returns {Promise<void>}
 */

/**
 * Creates a new IWindow with default values
 * @function
 * @name IWindow.createEmpty
 * @param {Object} windowService - The window service instance
 * @returns {IWindow}
 */

/**
 * The currently opened file
 * @member {EditFile} IWindow#currentFile
 */

/**
 * Current X position of the cursor
 * @member {number} IWindow#cursorX
 */

/**
 * Current Y position of the cursor
 * @member {number} IWindow#cursorY
 */

/**
 * Horizontal scroll offset
 * @member {number} IWindow#scrollOffsetX
 */

/**
 * Vertical scroll offset
 * @member {number} IWindow#scrollOffsetY
 */

/**
 * The window service instance
 * @member {Object} IWindow#windowService
 */

/**
 * Whether the window is anchored to the top of the screen
 * @member {boolean} IWindow#anchorTop
 */

/**
 * Whether the window is anchored to the bottom of the screen
 * @member {boolean} IWindow#anchorBottom
 */

/**
 * Whether the window is anchored to the left of the screen
 * @member {boolean} IWindow#anchorLeft
 */

/**
 * Whether the window is anchored to the right of the screen
 * @member {boolean} IWindow#anchorRight
 */

/**
 * The width of the window when not anchored to both left and right
 * If both anchorLeft and anchorRight are true, it will be the full screen width inside the border
 * @member {number} IWindow#width
 */

/**
 * The height of the window when not anchored to both top and bottom
 * If both anchorTop and anchorBottom are true, it will be the full height of the screen under the menu bar and inside the border
 * @member {number} IWindow#height
 */

/**
 * Border color for the window when focused
 * @member {string} IWindow#focusBorderColor
 */

/**
 * Border color for the window when not focused
 * @member {string} IWindow#borderColor
 */

/**
 * Background color for the window
 * @member {string} IWindow#backgroundColor
 */

/**
 * Foreground (text) color for the window
 * @member {string} IWindow#foregroundColor
 */

/**
 * Gets the styling information for the window's UI element
 * @function
 * @name IWindow#getStyle
 * @returns {Object} Style object with border, background, and other styling properties
 */

/**
 * Creates the UI element for this window
 * @function
 * @name IWindow#createUIElement
 * @param {Object} blessed - The blessed library object
 * @returns {Object} A blessed UI element for this window
 */

module.exports = {}; // Empty export, as this is just a JSDoc interface definition 