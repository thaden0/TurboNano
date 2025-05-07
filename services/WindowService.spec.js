const WindowService = require('./WindowService');
const Window = require('../models/Window');
const KeyEvent = require('../models/KeyEvent');

// Mock blessed
jest.mock('blessed', () => {
    const mockBox = {
        destroy: jest.fn(),
        key: jest.fn(),
        append: jest.fn(),
        focus: jest.fn(),
        on: jest.fn(),
        setContent: jest.fn(),
        scroll: jest.fn(),
        width: '100%',
        height: '100%-1'
    };

    return {
        box: jest.fn(() => mockBox)
    };
});

// Mock process.stdout.write for cursor styling
const originalStdoutWrite = process.stdout.write;
jest.spyOn(process.stdout, 'write').mockImplementation((data) => {
    // Don't actually write to stdout in tests
    return true;
});

describe('WindowService', () => {
    let windowService;
    let mockScreen;
    let mockBox;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup screen mock
        mockScreen = {
            render: jest.fn(),
            append: jest.fn(),
            on: jest.fn(),
            removeListener: jest.fn(),
            program: {
                showCursor: jest.fn(),
                move: jest.fn()
            }
        };

        // Get mockBox reference
        mockBox = require('blessed').box();

        // Create service
        windowService = new WindowService(mockScreen);
    });

    afterEach(() => {
        // Clean up
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with screen and an empty window', () => {
            expect(windowService.screen).toBe(mockScreen);
            expect(windowService.currentWindow).toBeDefined();
            expect(windowService.editorWindow).toBeNull();
            expect(windowService.insert).toBe(true);
        });

        it('should show the cursor', () => {
            expect(mockScreen.program.showCursor).toHaveBeenCalled();
        });

        it('should add insert mode toggle event', () => {
            const events = windowService.currentWindow.events;
            const insertEvent = events.find(event => event.binding === 'insert');
            expect(insertEvent).toBeDefined();
        });

        it('should set up keypress event handler', () => {
            expect(mockScreen.on).toHaveBeenCalledWith('keypress', expect.any(Function));
        });
    });

    describe('openFile', () => {
        it('should create and configure editor window', async () => {
            await windowService.openFile('test.txt');

            expect(require('blessed').box).toHaveBeenCalledWith(expect.objectContaining({
                top: 1,
                left: 0,
                width: '100%',
                height: '100%-1',
                border: expect.any(Object),
                scrollable: true
            }));

            expect(mockScreen.append).toHaveBeenCalledWith(mockBox);
            expect(mockBox.key).toHaveBeenCalledWith(['pagedown'], expect.any(Function));
            expect(mockBox.key).toHaveBeenCalledWith(['pageup'], expect.any(Function));
            expect(mockBox.on).toHaveBeenCalledWith('wheeldown', expect.any(Function));
            expect(mockBox.on).toHaveBeenCalledWith('wheelup', expect.any(Function));
            expect(mockBox.focus).toHaveBeenCalled();
        });

        it('should set up resize handler', async () => {
            await windowService.openFile('test.txt');
            
            expect(mockScreen.on).toHaveBeenCalledWith('resize', expect.any(Function));
            
            // Call the resize handler
            const resizeHandler = mockScreen.on.mock.calls.find(call => call[0] === 'resize')[1];
            await resizeHandler();
            
            // Should have updated dimensions and redrawn
            expect(mockBox.width).toBe('100%');
            expect(mockBox.height).toBe('100%-1');
        });

        it('should clean up old resize handler if one exists', async () => {
            // First file open
            await windowService.openFile('test1.txt');
            
            const removeListenerSpy = jest.spyOn(mockScreen, 'removeListener');
            
            // Second file open should clean up old resize handler
            await windowService.openFile('test2.txt');
            
            expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        });

        it('should return the current window', async () => {
            const result = await windowService.openFile('test.txt');
            expect(result).toBe(windowService.currentWindow);
        });
    });

    describe('updateCursor', () => {
        beforeEach(() => {
            // Setup with editor window
            windowService.editorWindow = mockBox;
            windowService.editorWindow.height = 25; // Set a height for visibility testing
        });

        it('should position cursor correctly when in visible area', () => {
            const win = windowService.currentWindow;
            win.cursorX = 5;
            win.cursorY = 10;
            win.scrollOffsetY = 2;

            windowService.updateCursor();

            // X position: cursorX + 1 (for border)
            // Y position: cursorY - scrollOffsetY + 2 (for top position and border)
            expect(mockScreen.program.move).toHaveBeenCalledWith(6, 10);
            
            // Should render screen
            expect(mockScreen.render).toHaveBeenCalled();
        });

        it('should set insert mode cursor style', () => {
            windowService.insert = true;
            windowService.currentWindow.cursorY = 10; // Ensure visible

            windowService.updateCursor();

            // Vertical bar cursor (DECSCUSR 5)
            expect(process.stdout.write).toHaveBeenCalledWith('\x1b[5 q');
        });

        it('should set normal mode cursor style', () => {
            windowService.insert = false;
            windowService.currentWindow.cursorY = 10; // Ensure visible

            windowService.updateCursor();

            // Block cursor (DECSCUSR 2)
            expect(process.stdout.write).toHaveBeenCalledWith('\x1b[2 q');
        });

        it('should not position cursor when outside visible area', () => {
            const win = windowService.currentWindow;
            
            // Set cursor position outside visible area (25 height - 2 borders = 23 visible lines)
            win.cursorY = 30;
            win.scrollOffsetY = 2;

            windowService.updateCursor();

            // Move should not be called
            expect(mockScreen.program.move).not.toHaveBeenCalled();
            
            // Should still render screen
            expect(mockScreen.render).toHaveBeenCalled();
        });
    });

    describe('getCurrentWindow', () => {
        it('should return the current window', () => {
            expect(windowService.getCurrentWindow()).toBe(windowService.currentWindow);
        });
    });
}); 