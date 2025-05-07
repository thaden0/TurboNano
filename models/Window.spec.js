const Window = require('./Window');
const EditFile = require('./EditFile');
const KeyEvent = require('./KeyEvent');
const IndentationService = require('../services/IndentationService');
const NanorcService = require('../services/NanorcService');

// Mock dependent services
jest.mock('../services/IndentationService');
jest.mock('../services/NanorcService');
jest.mock('../services/LoggingService', () => ({
    debug: jest.fn(),
    error: jest.fn()
}));

describe('Window', () => {
    let window;
    let mockWindowService;
    let mockEditFile;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock WindowService
        mockWindowService = {
            editorWindow: {
                height: 25,
                scrollTo: jest.fn(),
                setContent: jest.fn()
            },
            insert: true,
            updateCursor: jest.fn(),
            screen: {
                render: jest.fn()
            }
        };

        // Setup mock EditFile
        mockEditFile = new EditFile('test.txt', 'line1\nline2\nline3');
        mockEditFile.deleteChar = jest.fn();

        // Mock IndentationService
        IndentationService.prototype.getIndentation.mockReturnValue('  ');

        // Mock NanorcService
        NanorcService.prototype.style.mockImplementation((line) => Promise.resolve(line));

        // Create window instance
        window = new Window(mockEditFile, 0, 0, 0, 0, mockWindowService);
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(window.currentFile).toBe(mockEditFile);
            expect(window.cursorX).toBe(0);
            expect(window.cursorY).toBe(0);
            expect(window.scrollOffsetX).toBe(0);
            expect(window.scrollOffsetY).toBe(0);
            expect(window.windowService).toBe(mockWindowService);
            expect(window.indentationService).toBeInstanceOf(IndentationService);
            expect(window.nanorcService).toBeInstanceOf(NanorcService);
            expect(window.events.length).toBeGreaterThan(0);
        });

        it('should register default navigation events', () => {
            const eventKeys = window.events.map(e => e.binding);
            
            // Check if basic navigation events are registered
            expect(eventKeys).toContain('backspace');
            expect(eventKeys).toContain('up');
            expect(eventKeys).toContain('down');
            expect(eventKeys).toContain('left');
            expect(eventKeys).toContain('right');
            expect(eventKeys).toContain('tab');
            expect(eventKeys).toContain('delete');
            expect(eventKeys).toContain('enter');
        });
    });

    describe('createEmpty', () => {
        it('should create a new Window with default values', () => {
            const emptyWindow = Window.createEmpty(mockWindowService);
            
            expect(emptyWindow).toBeInstanceOf(Window);
            expect(emptyWindow.currentFile).toBeInstanceOf(EditFile);
            expect(emptyWindow.cursorX).toBe(0);
            expect(emptyWindow.cursorY).toBe(0);
            expect(emptyWindow.scrollOffsetX).toBe(0);
            expect(emptyWindow.scrollOffsetY).toBe(0);
            expect(emptyWindow.windowService).toBe(mockWindowService);
        });
    });

    describe('addEvent', () => {
        it('should add an event to the events array', () => {
            const initialEventCount = window.events.length;
            const testEvent = new KeyEvent('test-key', jest.fn());
            
            window.addEvent(testEvent);
            
            expect(window.events.length).toBe(initialEventCount + 1);
            expect(window.events).toContain(testEvent);
        });
    });

    describe('press', () => {
        it('should execute matching event callback', async () => {
            // Create a test event
            const callback = jest.fn();
            const testEvent = new KeyEvent('test-key', callback);
            window.addEvent(testEvent);
            
            // Press the key
            await window.press({ full: 'test-key' });
            
            expect(callback).toHaveBeenCalledWith({ full: 'test-key' }, window);
        });

        it('should handle character input when no event matches', async () => {
            // Spy on EditFile.writeText
            const writeTextSpy = jest.spyOn(mockEditFile, 'writeText');
            const redrawSpy = jest.spyOn(window, 'redraw').mockImplementation();
            
            // Press a key that doesn't match any event
            await window.press({ full: 'a', sequence: 'a' });
            
            expect(writeTextSpy).toHaveBeenCalledWith('a', 0, 0, true);
            expect(window.cursorX).toBe(1); // Cursor should move right
            expect(redrawSpy).toHaveBeenCalled();
        });

        it('should do nothing if key is undefined or has no full property', async () => {
            const writeTextSpy = jest.spyOn(mockEditFile, 'writeText');
            
            // Press undefined key
            await window.press(undefined);
            expect(writeTextSpy).not.toHaveBeenCalled();
            
            // Press key with no full property
            await window.press({});
            expect(writeTextSpy).not.toHaveBeenCalled();
        });
    });

    describe('redraw', () => {
        it('should redraw window content when windowService is available', async () => {
            // Setup mock EditFile with content
            window.currentFile.fileData = ['line1', 'line2', 'line3'];
            window.scrollOffsetY = 0;
            
            await window.redraw();
            
            // Should have called style on each visible line
            expect(window.nanorcService.style).toHaveBeenCalledTimes(3);
            
            // Should have set content on editor window
            expect(mockWindowService.editorWindow.setContent).toHaveBeenCalled();
            
            // Should have rendered screen
            expect(mockWindowService.screen.render).toHaveBeenCalled();
            
            // Should have updated cursor
            expect(mockWindowService.updateCursor).toHaveBeenCalled();
        });

        it('should handle scrolled view', async () => {
            // Setup mock EditFile with more content than visible
            window.currentFile.fileData = Array(30).fill().map((_, i) => `line${i + 1}`);
            window.scrollOffsetY = 5; // Scroll down 5 lines
            
            await window.redraw();
            
            // We should see lines 5-29 (25 lines when height is 25 with borders)
            expect(window.nanorcService.style).toHaveBeenCalledTimes(23); // 25 - 2 for borders
            
            // First call should be with line5
            expect(window.nanorcService.style.mock.calls[0][0]).toBe('line6');
        });

        it('should do nothing if windowService or editorWindow is not available', async () => {
            // Remove windowService
            window.windowService = null;
            
            await window.redraw();
            
            // NanorcService.style should not be called
            expect(window.nanorcService.style).not.toHaveBeenCalled();
        });
    });

    describe('_moveCursor', () => {
        it('should move cursor within bounds', async () => {
            // Setup file with content
            window.currentFile.fileData = ['line1', 'line2', 'line3'];
            const redrawSpy = jest.spyOn(window, 'redraw').mockImplementation();
            
            // Move cursor right
            await window._moveCursor(1, 0);
            expect(window.cursorX).toBe(1);
            expect(window.cursorY).toBe(0);
            
            // Move cursor down
            await window._moveCursor(0, 1);
            expect(window.cursorX).toBe(1);
            expect(window.cursorY).toBe(1);
            
            // Redraw should be called
            expect(redrawSpy).toHaveBeenCalledTimes(2);
        });

        it('should not move cursor outside vertical bounds', async () => {
            window.currentFile.fileData = ['line1', 'line2'];
            
            // Try to move above the first line
            await window._moveCursor(0, -1);
            expect(window.cursorY).toBe(0);
            
            // Move to last line
            window.cursorY = 1;
            
            // Try to move below the last line
            await window._moveCursor(0, 1);
            expect(window.cursorY).toBe(1);
        });

        it('should not move cursor outside horizontal bounds', async () => {
            window.currentFile.fileData = ['line1'];
            
            // Try to move left of the first column
            await window._moveCursor(-1, 0);
            expect(window.cursorX).toBe(0);
            
            // Move to end of line
            window.cursorX = 5;
            
            // Try to move right of the line length
            await window._moveCursor(1, 0);
            expect(window.cursorX).toBe(5);
        });

        it('should adjust horizontal position when moving to a shorter line', async () => {
            window.currentFile.fileData = ['long line', 'short'];
            window.cursorX = 8; // position at the 'e' in 'long line'
            
            // Move down to the shorter line
            await window._moveCursor(0, 1);
            
            // Cursor X should be adjusted to the end of the shorter line
            expect(window.cursorX).toBe(5); // 'short' length
            expect(window.cursorY).toBe(1);
        });

        it('should scroll view when cursor moves beyond visible area', async () => {
            // Setup a file with many lines
            window.currentFile.fileData = Array(50).fill().map((_, i) => `line${i + 1}`);
            
            // Set visible area (editorWindow height - 2 for borders = 23 visible lines)
            mockWindowService.editorWindow.height = 25;
            
            // Move cursor to bottom of visible area
            window.cursorY = 22; // (0-based, so 22 is the 23rd line)
            
            // Move one line down (beyond visible area)
            await window._moveCursor(0, 1);
            
            // Should scroll down
            expect(mockWindowService.editorWindow.scrollTo).toHaveBeenCalled();
            expect(window.scrollOffsetY).toBeGreaterThan(0);
        });
    });

    describe('_handleTab', () => {
        it('should insert indentation at cursor position', async () => {
            const writeTextSpy = jest.spyOn(mockEditFile, 'writeText');
            const redrawSpy = jest.spyOn(window, 'redraw').mockImplementation();
            
            await window._handleTab();
            
            expect(window.indentationService.getIndentation).toHaveBeenCalledWith(0);
            expect(writeTextSpy).toHaveBeenCalledWith('  ', 0, 0, true);
            expect(window.cursorX).toBe(2); // '  ' is 2 spaces
            expect(redrawSpy).toHaveBeenCalled();
        });
    });

    describe('_handleBackspace', () => {
        it('should delete character before cursor when not at start of line', async () => {
            // Position cursor after first character
            window.cursorX = 1;
            window.currentFile.fileData = ['line1'];
            
            const deleteCharSpy = jest.spyOn(mockEditFile, 'deleteChar');
            const redrawSpy = jest.spyOn(window, 'redraw').mockImplementation();
            
            await window._handleBackspace();
            
            expect(deleteCharSpy).toHaveBeenCalledWith(0, 0);
            expect(window.cursorX).toBe(0);
            expect(redrawSpy).toHaveBeenCalled();
        });

        it('should join with previous line when at start of line', async () => {
            // Position cursor at start of second line
            window.cursorY = 1;
            window.cursorX = 0;
            window.currentFile.fileData = ['line1', 'line2'];
            
            const redrawSpy = jest.spyOn(window, 'redraw').mockImplementation();
            
            await window._handleBackspace();
            
            // Should have joined lines
            expect(window.currentFile.fileData).toEqual(['line1line2']);
            expect(window.cursorY).toBe(0);
            expect(window.cursorX).toBe(5); // Position after 'line1'
            expect(redrawSpy).toHaveBeenCalled();
        });

        it('should do nothing when at start of first line', async () => {
            // Position cursor at start of first line
            window.cursorY = 0;
            window.cursorX = 0;
            window.currentFile.fileData = ['line1'];
            
            const deleteCharSpy = jest.spyOn(mockEditFile, 'deleteChar');
            
            await window._handleBackspace();
            
            expect(deleteCharSpy).not.toHaveBeenCalled();
            expect(window.currentFile.fileData).toEqual(['line1']);
            expect(window.cursorY).toBe(0);
            expect(window.cursorX).toBe(0);
        });
    });
}); 