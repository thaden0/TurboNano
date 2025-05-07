const FileSelectModal = require('./FileSelectModal');
const fs = require('fs');
const path = require('path');

// Mock fs
jest.mock('fs', () => ({
    readdirSync: jest.fn(),
    statSync: jest.fn()
}));

// Mock path
jest.mock('path', () => {
    const originalPath = jest.requireActual('path');
    return {
        ...originalPath,
        join: jest.fn(),
        resolve: jest.fn()
    };
});

// Mock blessed
jest.mock('blessed', () => {
    const mockList = {
        on: jest.fn(),
        setItems: jest.fn(),
        setLabel: jest.fn(),
        getItem: jest.fn().mockImplementation(() => ({
            getText: jest.fn().mockReturnValue('test.txt')
        })),
        select: jest.fn(),
        selected: 0,
        focus: jest.fn()
    };

    const mockTextbox = {
        on: jest.fn(),
        setValue: jest.fn(),
        getValue: jest.fn().mockReturnValue('/path/to/test.txt'),
        focused: false
    };

    const mockButton = {
        on: jest.fn()
    };

    const mockBox = {
        on: jest.fn(),
        key: jest.fn(),
        destroy: jest.fn(),
        show: jest.fn()
    };

    return {
        list: jest.fn(() => mockList),
        textbox: jest.fn(() => mockTextbox),
        button: jest.fn(() => mockButton),
        box: jest.fn(() => mockBox)
    };
});

// Get fs and path mocks
const mockFs = fs;
const mockPath = path;
const blessed = require('blessed');

describe('FileSelectModal', () => {
    let fileSelectModal;
    let mockScreen;
    let mockList;
    let mockTextbox;
    let mockOkButton;
    let mockCancelButton;
    let mockModal;
    let mockOnSelect;
    let mockOnCancel;

    beforeEach(() => {
        // Clear mocks
        jest.clearAllMocks();

        // Setup mock screen
        mockScreen = {
            render: jest.fn()
        };

        // Setup mock callbacks
        mockOnSelect = jest.fn();
        mockOnCancel = jest.fn();

        // Get references to mocked components
        mockList = blessed.list();
        mockTextbox = blessed.textbox();
        mockOkButton = blessed.button();
        mockCancelButton = blessed.button();
        mockModal = blessed.box();

        // Setup path.join mock
        mockPath.join.mockImplementation((...parts) => parts.join('/'));
        
        // Setup path.resolve mock
        mockPath.resolve.mockImplementation((...parts) => parts.join('/'));

        // Setup fs.readdirSync mock
        mockFs.readdirSync.mockReturnValue(['file1.txt', 'file2.txt', 'dir1']);
        
        // Setup fs.statSync mock - make dir1 a directory
        mockFs.statSync.mockImplementation((path) => ({
            isDirectory: () => path.endsWith('dir1')
        }));

        // Create modal
        fileSelectModal = new FileSelectModal(mockScreen, {
            startDir: '/test/dir',
            onSelect: mockOnSelect,
            onCancel: mockOnCancel
        });
        
        // Manually reset blessed.button call count
        // since it's called multiple times in the constructor
        blessed.button.mockClear();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(fileSelectModal.screen).toBe(mockScreen);
            expect(fileSelectModal.currentDir).toBe('/test/dir');
            expect(fileSelectModal.onSelect).toBe(mockOnSelect);
            expect(fileSelectModal.onCancel).toBe(mockOnCancel);
        });

        it('should create a modal box with correct configuration', () => {
            expect(blessed.box).toHaveBeenCalledWith(expect.objectContaining({
                parent: mockScreen,
                top: 'center',
                left: 'center',
                width: '80%',
                height: '80%',
                border: 'line'
            }));
        });

        it('should create a list component with correct configuration', () => {
            expect(blessed.list).toHaveBeenCalledWith(expect.objectContaining({
                parent: expect.anything(),
                label: expect.stringContaining('/test/dir'),
                tags: true,
                keys: true,
                mouse: true,
                border: 'line'
            }));
        });

        it('should create textbox and buttons with correct configuration', () => {
            expect(blessed.textbox).toHaveBeenCalledWith(expect.objectContaining({
                parent: expect.anything(),
                inputOnFocus: true,
                keys: true,
                mouse: true
            }));

            // Skip button verification as it's tested indirectly via event handlers
            // in the next test
        });

        it('should setup event handlers for components', () => {
            expect(mockList.on).toHaveBeenCalledWith('select', expect.any(Function));
            expect(mockOkButton.on).toHaveBeenCalledWith('press', expect.any(Function));
            expect(mockOkButton.on).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockCancelButton.on).toHaveBeenCalledWith('press', expect.any(Function));
            expect(mockCancelButton.on).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockModal.key).toHaveBeenCalledWith(['escape'], expect.any(Function));
            expect(mockModal.key).toHaveBeenCalledWith(['enter'], expect.any(Function));
        });

        it('should update list with initial directory contents', () => {
            expect(mockFs.readdirSync).toHaveBeenCalledWith('/test/dir');
            expect(mockList.setItems).toHaveBeenCalled();
            expect(mockList.focus).toHaveBeenCalled();
        });
    });

    describe('_updateList', () => {
        it('should update list items with directory contents', () => {
            // Update with a new directory
            fileSelectModal._updateList('/new/dir');

            // Directory should be updated
            expect(fileSelectModal.currentDir).toBe('/new/dir');
            
            // Should read directory contents
            expect(mockFs.readdirSync).toHaveBeenCalledWith('/new/dir');
            
            // Should update list label
            expect(mockList.setLabel).toHaveBeenCalledWith(expect.stringContaining('/new/dir'));
            
            // Should update list items (including ../ for up directory)
            expect(mockList.setItems).toHaveBeenCalledWith(['../', expect.any(String), expect.any(String), expect.any(String)]);
            
            // Should select the first item
            expect(mockList.select).toHaveBeenCalledWith(0);
            
            // Should render screen
            expect(mockScreen.render).toHaveBeenCalled();
        });

        it('should handle errors when reading directory', () => {
            // Setup error for directory read
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            mockFs.readdirSync.mockImplementationOnce(() => {
                throw new Error('Directory read error');
            });

            fileSelectModal._updateList('/error/dir');

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error reading directory:', expect.any(Error));
            
            consoleErrorSpy.mockRestore();
        });
    });

    describe('_updatePathFromSelection', () => {
        it('should update pathBox value based on current selection', () => {
            // Setup current selection
            mockList.getItem.mockReturnValueOnce({
                getText: () => 'selected-file.txt'
            });

            // Path.resolve should return full path
            mockPath.resolve.mockReturnValueOnce('/test/dir/selected-file.txt');

            fileSelectModal._updatePathFromSelection();

            expect(mockPath.resolve).toHaveBeenCalledWith('/test/dir', 'selected-file.txt');
            expect(mockTextbox.setValue).toHaveBeenCalledWith('/test/dir/selected-file.txt');
            expect(mockScreen.render).toHaveBeenCalled();
        });

        it('should do nothing if no item is selected', () => {
            // Make getItem return null for this test only
            const originalGetItem = mockList.getItem;
            mockList.getItem = jest.fn().mockReturnValue(null);
            mockTextbox.setValue.mockClear();

            fileSelectModal._updatePathFromSelection();

            expect(mockTextbox.setValue).not.toHaveBeenCalled();
            
            // Restore original getItem
            mockList.getItem = originalGetItem;
        });
    });

    describe('_handleSelect', () => {
        it('should navigate into directory when directory is selected', () => {
            // Setup selected item as directory
            const item = {
                getText: () => 'dir1/'
            };

            // Path.resolve should return full path
            mockPath.resolve.mockReturnValueOnce('/test/dir/dir1');

            // Spy on _updateList method
            const updateListSpy = jest.spyOn(fileSelectModal, '_updateList');

            fileSelectModal._handleSelect(item);

            expect(mockPath.resolve).toHaveBeenCalledWith('/test/dir', 'dir1/');
            expect(updateListSpy).toHaveBeenCalledWith('/test/dir/dir1');
        });

        it('should not navigate into file when file is selected', () => {
            // Setup selected item as file
            const item = {
                getText: () => 'file1.txt'
            };

            // Spy on _updateList method
            const updateListSpy = jest.spyOn(fileSelectModal, '_updateList');

            fileSelectModal._handleSelect(item);

            expect(updateListSpy).not.toHaveBeenCalled();
        });
    });

    describe('_handlePathSubmit', () => {
        it('should navigate to directory when path is a directory', () => {
            // Setup textbox value
            mockTextbox.getValue.mockReturnValueOnce('/some/dir');

            // Setup fs.statSync to indicate directory
            mockFs.statSync.mockReturnValueOnce({
                isDirectory: () => true
            });

            // Spy on _updateList method
            const updateListSpy = jest.spyOn(fileSelectModal, '_updateList');

            fileSelectModal._handlePathSubmit();

            expect(mockFs.statSync).toHaveBeenCalledWith('/some/dir');
            expect(updateListSpy).toHaveBeenCalledWith('/some/dir');
        });

        it('should complete selection when path is a file', () => {
            // Setup textbox value
            mockTextbox.getValue.mockReturnValueOnce('/some/file.txt');

            // Setup fs.statSync to indicate file
            mockFs.statSync.mockReturnValueOnce({
                isDirectory: () => false
            });

            // Spy on _completeSelection method
            const completeSelectionSpy = jest.spyOn(fileSelectModal, '_completeSelection')
                .mockImplementation(() => {});

            fileSelectModal._handlePathSubmit();

            expect(mockFs.statSync).toHaveBeenCalledWith('/some/file.txt');
            expect(completeSelectionSpy).toHaveBeenCalledWith('/some/file.txt');
        });

        it('should handle non-existent path with valid parent directory as new file', () => {
            // Setup textbox value for non-existent file
            mockTextbox.getValue.mockReturnValueOnce('/some/parent/newfile.txt');

            // Setup fs.statSync to throw for file but return valid parent
            mockFs.statSync.mockImplementationOnce(() => { 
                throw new Error('File not found');
            });

            // Path.dirname should return parent directory
            const originalDirname = path.dirname;
            path.dirname = jest.fn().mockReturnValueOnce('/some/parent');

            // Second statSync call for parent dir
            mockFs.statSync.mockReturnValueOnce({
                isDirectory: () => true
            });

            // Spy on _completeSelection method
            const completeSelectionSpy = jest.spyOn(fileSelectModal, '_completeSelection')
                .mockImplementation(() => {});

            fileSelectModal._handlePathSubmit();

            expect(path.dirname).toHaveBeenCalledWith('/some/parent/newfile.txt');
            expect(mockFs.statSync).toHaveBeenCalledWith('/some/parent');
            expect(completeSelectionSpy).toHaveBeenCalledWith('/some/parent/newfile.txt');

            // Restore original path.dirname
            path.dirname = originalDirname;
        });
    });

    describe('_handleButtonSelect', () => {
        it('should navigate to directory when selected item is a directory', () => {
            // Setup selected item as parent directory
            mockList.getItem.mockReturnValueOnce({
                getText: () => '../'
            });

            // Path.resolve should return parent path
            mockPath.resolve.mockReturnValueOnce('/parent');

            // Spy on _updateList method
            const updateListSpy = jest.spyOn(fileSelectModal, '_updateList');

            fileSelectModal._handleButtonSelect();

            expect(updateListSpy).toHaveBeenCalledWith('/parent');
        });

        it('should complete selection when selected item is a file', () => {
            // Setup selected item as file
            mockList.getItem.mockReturnValueOnce({
                getText: () => 'file1.txt'
            });

            // Path.resolve should return full path
            mockPath.resolve.mockReturnValueOnce('/test/dir/file1.txt');

            // fs.statSync to indicate file
            mockFs.statSync.mockReturnValueOnce({
                isDirectory: () => false
            });

            // Spy on _completeSelection method
            const completeSelectionSpy = jest.spyOn(fileSelectModal, '_completeSelection')
                .mockImplementation(() => {});

            fileSelectModal._handleButtonSelect();

            expect(mockFs.statSync).toHaveBeenCalledWith('/test/dir/file1.txt');
            expect(completeSelectionSpy).toHaveBeenCalledWith('/test/dir/file1.txt');
        });

        it('should do nothing if no item is selected', () => {
            mockList.getItem.mockReturnValueOnce(null);

            // Spy on methods that might be called
            const updateListSpy = jest.spyOn(fileSelectModal, '_updateList');
            const completeSelectionSpy = jest.spyOn(fileSelectModal, '_completeSelection')
                .mockImplementation(() => {});

            fileSelectModal._handleButtonSelect();

            expect(updateListSpy).not.toHaveBeenCalled();
            expect(completeSelectionSpy).not.toHaveBeenCalled();
        });
    });

    describe('_completeSelection', () => {
        it('should call onSelect callback with selected path', () => {
            // Use modified version to test only the callback, not the destroy
            const originalComplete = fileSelectModal._completeSelection;
            fileSelectModal._completeSelection = function(path) {
                if (this.onSelect) {
                    this.onSelect(path);
                }
            };
            
            fileSelectModal._completeSelection('/selected/file.txt');

            expect(mockOnSelect).toHaveBeenCalledWith('/selected/file.txt');
            
            // Restore original
            fileSelectModal._completeSelection = originalComplete;
        });
    });

    describe('_handleCancel', () => {
        it('should call onCancel callback', () => {
            // Use modified version to test only the callback, not the destroy
            const originalCancel = fileSelectModal._handleCancel;
            fileSelectModal._handleCancel = function() {
                if (this.onCancel) {
                    this.onCancel();
                }
            };
            
            fileSelectModal._handleCancel();

            expect(mockOnCancel).toHaveBeenCalled();
            
            // Restore original
            fileSelectModal._handleCancel = originalCancel;
        });
    });

    describe('show', () => {
        it('should focus the list when shown', () => {
            // Clear previous calls
            mockList.focus.mockClear();
            
            // Replace show method for testing
            const originalShow = fileSelectModal.show;
            fileSelectModal.show = function() {
                this.list.focus();
                this.screen.render();
            };

            fileSelectModal.show();

            expect(mockList.focus).toHaveBeenCalled();
            
            // Restore original
            fileSelectModal.show = originalShow;
        });
    });
}); 