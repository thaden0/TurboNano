const EventController = require('./EventController');
const KeyEvent = require('../models/KeyEvent');
const MenuService = require('../services/MenuService');
const FileSelectModal = require('../modals/FileSelectModal');
const FileService = require('../services/FileService');
const FileMenu = require('../models/FileMenu');

// Mock dependencies
jest.mock('../services/MenuService');
jest.mock('../modals/FileSelectModal');
jest.mock('../services/FileService');
jest.mock('../models/FileMenu');

describe('EventController', () => {
    let controller;
    let mockScreen;
    let mockWindowService;
    let mockCurrentWindow;
    let mockFileMenu;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock screen
        mockScreen = {
            key: jest.fn(),
        };

        // Create mock current window
        mockCurrentWindow = {
            currentFile: { fileName: 'test.txt', fileData: ['test content'] },
            cursorX: 0,
            cursorY: 0,
            redraw: jest.fn().mockResolvedValue(undefined),
            press: jest.fn().mockResolvedValue(undefined)
        };

        // Create mock window service
        mockWindowService = {
            getCurrentWindow: jest.fn().mockReturnValue(mockCurrentWindow)
        };

        // Create mock file menu
        mockFileMenu = {
            addItem: jest.fn(),
            show: jest.fn()
        };
        FileMenu.mockImplementation(() => mockFileMenu);

        // Create controller instance
        controller = new EventController(mockScreen, mockWindowService);
    });

    describe('constructor', () => {
        it('should initialize with the provided screen and window service', () => {
            expect(controller.screen).toBe(mockScreen);
            expect(controller.windowService).toBe(mockWindowService);
            expect(controller.events).toEqual([]);
            expect(controller.modalActive).toBe(false);
        });

        it('should set up file menu items', () => {
            expect(mockFileMenu.addItem).toHaveBeenCalledTimes(4);
            expect(mockFileMenu.addItem).toHaveBeenCalledWith('New File', expect.any(Function));
            expect(mockFileMenu.addItem).toHaveBeenCalledWith('Open File', expect.any(Function));
            expect(mockFileMenu.addItem).toHaveBeenCalledWith('Save File', expect.any(Function));
            expect(mockFileMenu.addItem).toHaveBeenCalledWith('Exit', expect.any(Function));
        });

        it('should set up Ctrl-F shortcut for file menu', () => {
            expect(mockScreen.key).toHaveBeenCalledWith(['C-f'], expect.any(Function));
        });
    });

    describe('addEvent', () => {
        it('should add valid KeyEvent to events array', () => {
            const event = new KeyEvent('test', () => {});
            controller.addEvent(event);
            expect(controller.events).toContain(event);
        });

        it('should throw error for non-KeyEvent objects', () => {
            expect(() => {
                controller.addEvent({ binding: 'test', callback: () => {} });
            }).toThrow('Event must be an instance of KeyEvent class');
        });
    });

    describe('_handleNew', () => {
        it('should reset current window state', async () => {
            await controller._handleNew();
            expect(mockCurrentWindow.currentFile).toBeNull();
            expect(mockCurrentWindow.cursorX).toBe(0);
            expect(mockCurrentWindow.cursorY).toBe(0);
            expect(mockCurrentWindow.redraw).toHaveBeenCalled();
        });
    });

    describe('_handleOpen', () => {
        it('should set modalActive and show FileSelectModal', () => {
            controller._handleOpen();
            expect(controller.modalActive).toBe(true);
            expect(FileSelectModal).toHaveBeenCalledWith(
                mockScreen,
                expect.objectContaining({
                    startDir: expect.any(String),
                    onSelect: expect.any(Function),
                    onCancel: expect.any(Function)
                })
            );
        });

        it('should handle file selection success', async () => {
            const mockEditFile = { fileName: 'test.txt', fileData: ['content'] };
            const mockFileService = {
                getTextFile: jest.fn().mockResolvedValue(mockEditFile)
            };
            FileService.mockImplementation(() => mockFileService);

            // Create a new controller instance with our mocked services
            const controller = new EventController(mockScreen, mockWindowService);
            
            // Call _handleOpen to get the actual onSelect callback
            controller._handleOpen();
            
            // Get the onSelect callback that was passed to FileSelectModal
            const onSelect = FileSelectModal.mock.calls[0][1].onSelect;
            
            // Call the callback directly
            await onSelect('test.txt');
            
            expect(mockFileService.getTextFile).toHaveBeenCalledWith('test.txt');
            expect(mockCurrentWindow.currentFile).toEqual(mockEditFile);
            expect(mockCurrentWindow.cursorX).toBe(0);
            expect(mockCurrentWindow.cursorY).toBe(0);
            expect(mockCurrentWindow.redraw).toHaveBeenCalled();
            expect(controller.modalActive).toBe(false);
        });

        it('should handle file selection error', async () => {
            const mockFileService = {
                getTextFile: jest.fn().mockRejectedValue(new Error('File error'))
            };
            FileService.mockImplementation(() => mockFileService);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Create a new controller instance with our mocked services
            const controller = new EventController(mockScreen, mockWindowService);
            
            // Call _handleOpen to get the actual onSelect callback
            controller._handleOpen();
            
            // Get the onSelect callback that was passed to FileSelectModal
            const onSelect = FileSelectModal.mock.calls[0][1].onSelect;
            
            // Call the callback directly
            await onSelect('test.txt');
            
            expect(mockFileService.getTextFile).toHaveBeenCalledWith('test.txt');
            expect(consoleSpy).toHaveBeenCalledWith('Error opening file:', expect.any(Error));
            expect(controller.modalActive).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('_handleSave', () => {
        it('should save current file if it exists', async () => {
            const mockFileService = {
                saveTextFile: jest.fn().mockResolvedValue(undefined)
            };
            FileService.mockImplementation(() => mockFileService);

            const controller = new EventController(mockScreen, mockWindowService);

            await controller._handleSave();
            expect(mockFileService.saveTextFile).toHaveBeenCalledWith(mockCurrentWindow.currentFile);
        });

        it('should handle save error', async () => {
            const mockFileService = {
                saveTextFile: jest.fn().mockRejectedValue(new Error('Save error'))
            };
            FileService.mockImplementation(() => mockFileService);

            const controller = new EventController(mockScreen, mockWindowService);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await controller._handleSave();
            expect(consoleSpy).toHaveBeenCalledWith('Error saving file:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('press', () => {
        it('should handle matching key events', async () => {
            const mockCallback = jest.fn();
            const event = new KeyEvent('test', mockCallback);
            controller.addEvent(event);

            await controller.press({ full: 'test' });
            expect(mockCallback).toHaveBeenCalled();
        });

        it('should forward key press to window when no modal is active', async () => {
            await controller.press({ full: 'test' });
            expect(mockCurrentWindow.press).toHaveBeenCalled();
        });

        it('should not forward key press to window when modal is active', async () => {
            controller.modalActive = true;
            await controller.press({ full: 'test' });
            expect(mockCurrentWindow.press).not.toHaveBeenCalled();
        });

        it('should handle callback errors', async () => {
            const mockCallback = jest.fn().mockRejectedValue(new Error('Callback error'));
            const event = new KeyEvent('test', mockCallback);
            controller.addEvent(event);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            await controller.press({ full: 'test' });
            expect(consoleSpy).toHaveBeenCalledWith('Error in event handler for test:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('utility methods', () => {
        it('getMenuService should return menu service instance', () => {
            expect(controller.getMenuService()).toBe(controller.menuService);
        });

        it('getEvents should return copy of events array', () => {
            const event = new KeyEvent('test', () => {});
            controller.addEvent(event);
            const events = controller.getEvents();
            expect(events).toEqual(controller.events);
            expect(events).not.toBe(controller.events);
        });

        it('clearEvents should empty events array', () => {
            const event = new KeyEvent('test', () => {});
            controller.addEvent(event);
            controller.clearEvents();
            expect(controller.events).toHaveLength(0);
        });
    });
}); 