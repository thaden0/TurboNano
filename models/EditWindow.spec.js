const EditWindow = require('./EditWindow');
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

describe('EditWindow', () => {
    let editWindow;
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
        editWindow = new EditWindow(mockEditFile, 0, 0, 0, 0, mockWindowService);
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(editWindow.currentFile).toBe(mockEditFile);
            expect(editWindow.cursorX).toBe(0);
            expect(editWindow.cursorY).toBe(0);
            expect(editWindow.scrollOffsetX).toBe(0);
            expect(editWindow.scrollOffsetY).toBe(0);
            expect(editWindow.windowService).toBe(mockWindowService);
            expect(editWindow.indentationService).toBeInstanceOf(IndentationService);
            expect(editWindow.nanorcService).toBeInstanceOf(NanorcService);
            expect(editWindow.events.length).toBeGreaterThan(0);
        });

        it('should register default navigation events', () => {
            const eventKeys = editWindow.events.map(e => e.binding);
            
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
        it('should create a new EditWindow with default values', () => {
            const emptyWindow = EditWindow.createEmpty(mockWindowService);
            
            expect(emptyWindow).toBeInstanceOf(EditWindow);
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
            const initialEventCount = editWindow.events.length;
            const testEvent = new KeyEvent('test-key', jest.fn());
            
            editWindow.addEvent(testEvent);
            
            expect(editWindow.events.length).toBe(initialEventCount + 1);
            expect(editWindow.events).toContain(testEvent);
        });
    });

    describe('press', () => {
        it('should execute matching event callback', async () => {
            // Create a test event
            const callback = jest.fn();
            const testEvent = new KeyEvent('test-key', callback);
            editWindow.addEvent(testEvent);
            
            // Press the key
            await editWindow.press({ full: 'test-key' });
            
            expect(callback).toHaveBeenCalledWith({ full: 'test-key' }, editWindow);
        });

        it('should handle character input when no event matches', async () => {
            // Spy on EditFile.writeText
            const writeTextSpy = jest.spyOn(mockEditFile, 'writeText');
            const redrawSpy = jest.spyOn(editWindow, 'redraw').mockImplementation();
            
            // Press a key that doesn't match any event
            await editWindow.press({ full: 'a', sequence: 'a' });
            
            expect(writeTextSpy).toHaveBeenCalledWith('a', 0, 0, true);
            expect(editWindow.cursorX).toBe(1); // Cursor should move right
            expect(redrawSpy).toHaveBeenCalled();
        });

        it('should do nothing if key is undefined or has no full property', async () => {
            const writeTextSpy = jest.spyOn(mockEditFile, 'writeText');
            
            // Press undefined key
            await editWindow.press(undefined);
            expect(writeTextSpy).not.toHaveBeenCalled();
            
            // Press key with no full property
            await editWindow.press({});
            expect(writeTextSpy).not.toHaveBeenCalled();
        });
    });

    describe('redraw', () => {
        it('should redraw window content when windowService is available', async () => {
            // Setup mock EditFile with content
            editWindow.currentFile.fileData = ['line1', 'line2', 'line3'];
            editWindow.scrollOffsetY = 0;
            
            await editWindow.redraw();
            
            // Should have called style on each visible line
            expect(editWindow.nanorcService.style).toHaveBeenCalledTimes(3);
            
            // Should have set content on editor window
            expect(mockWindowService.editorWindow.setContent).toHaveBeenCalled();
            
            // Should have rendered screen
            expect(mockWindowService.screen.render).toHaveBeenCalled();
            
            // Should have updated cursor
            expect(mockWindowService.updateCursor).toHaveBeenCalled();
        });

        it('should handle scrolled view', async () => {
            // Setup mock EditFile with more content than visible
            editWindow.currentFile.fileData = Array(30).fill().map((_, i) => `line${i + 1}`);
            editWindow.scrollOffsetY = 5; // Scroll down 5 lines
            
            await editWindow.redraw();
            
            // We should see lines 5-29 (25 lines when height is 25 with borders)
            expect(editWindow.nanorcService.style).toHaveBeenCalledTimes(23); // 25 - 2 for borders
            
            // First call should be with line5
            expect(editWindow.nanorcService.style.mock.calls[0][0]).toBe('line6');
        });

        it('should do nothing if windowService or editorWindow is not available', async () => {
            // Remove windowService
            editWindow.windowService = null;
            
            await editWindow.redraw();
            
            // NanorcService.style should not be called
            expect(editWindow.nanorcService.style).not.toHaveBeenCalled();
        });
    });

    describe('_moveCursor', () => {
        it('should move cursor within bounds', async () => {
            // Setup file with content
            editWindow.currentFile.fileData = ['line1', 'line2', 'line3'];
            const redrawSpy = jest.spyOn(editWindow, 'redraw').mockImplementation();
            
            // Move cursor right
            await editWindow._moveCursor(1, 0);
            expect(editWindow.cursorX).toBe(1);
            expect(editWindow.cursorY).toBe(0);
            
            // Move cursor down
            await editWindow._moveCursor(0, 1);
            expect(editWindow.cursorX).toBe(1);
            expect(editWindow.cursorY).toBe(1);
            
            // Redraw should be called
            expect(redrawSpy).toHaveBeenCalledTimes(2);
        });

        it('should not move cursor outside vertical bounds', async () => {
            editWindow.currentFile.fileData = ['line1', 'line2'];
            
            // Try to move above the first line
            await editWindow._moveCursor(0, -1);
            expect(editWindow.cursorY).toBe(0);
            
            // Move to last line
            editWindow.cursorY = 1;
            
            // Try to move below the last line
            await editWindow._moveCursor(0, 1);
            expect(editWindow.cursorY).toBe(1);
        });

        it('should not move cursor outside horizontal bounds', async () => {
            editWindow.currentFile.fileData = ['line1'];
            
            // Try to move left of the first column
            await editWindow._moveCursor(-1, 0);
            expect(editWindow.cursorX).toBe(0);
            
            // Move to end of line
            editWindow.cursorX = 5;
            
            // Try to move right of the line length
            await editWindow._moveCursor(1, 0);
            expect(editWindow.cursorX).toBe(5);
        });

        it('should adjust horizontal position when moving to a shorter line', async () => {
            editWindow.currentFile.fileData = ['long line', 'short'];
            editWindow.cursorX = 8; // position at the 'e' in 'long line'
            
            // Move down to the shorter line
            await editWindow._moveCursor(0, 1);
            
            // Cursor X should be adjusted to the end of the shorter line
            expect(editWindow.cursorX).toBe(5); // 'short' length
            expect(editWindow.cursorY).toBe(1);
        });
    });

    describe('_handleTab', () => {
        it('should insert indentation at cursor position', async () => {
            const redrawSpy = jest.spyOn(editWindow, 'redraw').mockImplementation();
            
            await editWindow._handleTab();
            
            expect(mockEditFile.writeText).toHaveBeenCalledWith('  ', 0, 0, true);
            expect(editWindow.cursorX).toBe(2); // Move cursor by indentation length
            expect(redrawSpy).toHaveBeenCalled();
        });
    });

    describe('_handleBackspace', () => {
        it('should delete character before cursor', async () => {
            editWindow.cursorX = 1;
            const redrawSpy = jest.spyOn(editWindow, 'redraw').mockImplementation();
            
            await editWindow._handleBackspace();
            
            expect(mockEditFile.deleteChar).toHaveBeenCalledWith(0, 0);
            expect(editWindow.cursorX).toBe(0); // Move cursor left
            expect(redrawSpy).toHaveBeenCalled();
        });

        it('should join with previous line when at start of line', async () => {
            editWindow.currentFile.fileData = ['line1', 'line2'];
            editWindow.cursorY = 1;
            editWindow.cursorX = 0;
            
            await editWindow._handleBackspace();
            
            // Should have removed the current line
            expect(editWindow.currentFile.fileData).toEqual(['line1line2']);
            
            // Cursor should move to end of previous line
            expect(editWindow.cursorY).toBe(0);
            expect(editWindow.cursorX).toBe(5); // 'line1' length
        });
    });

    describe('_handleDelete', () => {
        it('should delete character at cursor position', async () => {
            editWindow.currentFile.fileData = ['line1'];
            
            await editWindow._handleDelete();
            
            expect(mockEditFile.deleteChar).toHaveBeenCalledWith(0, 0);
        });

        it('should join with next line when at end of line', async () => {
            editWindow.currentFile.fileData = ['line1', 'line2'];
            editWindow.cursorX = 5; // at the end of 'line1'
            
            await editWindow._handleDelete();
            
            // Should have removed the next line and joined it
            expect(editWindow.currentFile.fileData).toEqual(['line1line2']);
        });
    });

    describe('_handleEnter', () => {
        it('should split line at cursor position', async () => {
            editWindow.currentFile.fileData = ['line1line2'];
            editWindow.cursorX = 5; // After 'line1'
            
            await editWindow._handleEnter();
            
            // Line should be split
            expect(editWindow.currentFile.fileData).toEqual(['line1', 'line2']);
            
            // Cursor should move to start of new line
            expect(editWindow.cursorY).toBe(1);
            expect(editWindow.cursorX).toBe(0);
        });
    });

    // Tests for page navigation
    describe('_handlePageUp', () => {
        it('should move cursor up by a page', async () => {
            // Setup file with many lines
            editWindow.currentFile.fileData = Array(50).fill().map((_, i) => `line${i + 1}`);
            editWindow.cursorY = 30;
            
            await editWindow._handlePageUp();
            
            // Should move cursor up by ~90% of editor height
            expect(editWindow.cursorY).toBeLessThan(30);
            expect(editWindow.scrollOffsetY).toBeLessThan(30);
        });
    });

    describe('_handlePageDown', () => {
        it('should move cursor down by a page', async () => {
            // Setup file with many lines
            editWindow.currentFile.fileData = Array(50).fill().map((_, i) => `line${i + 1}`);
            editWindow.cursorY = 10;
            
            await editWindow._handlePageDown();
            
            // Should move cursor down by ~90% of editor height
            expect(editWindow.cursorY).toBeGreaterThan(10);
            expect(editWindow.scrollOffsetY).toBeGreaterThan(0);
        });
    });

    describe('_handleHome', () => {
        it('should move cursor to start of line', async () => {
            editWindow.cursorX = 10;
            
            await editWindow._handleHome();
            
            expect(editWindow.cursorX).toBe(0);
        });
    });

    describe('_handleEnd', () => {
        it('should move cursor to end of line', async () => {
            editWindow.currentFile.fileData = ['line1'];
            editWindow.cursorX = 0;
            
            await editWindow._handleEnd();
            
            expect(editWindow.cursorX).toBe(5); // 'line1' length
        });
    });
}); 