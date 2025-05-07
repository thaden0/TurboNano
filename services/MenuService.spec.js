const MenuService = require('./MenuService');
const KeyEvent = require('../models/KeyEvent');
const Menu = require('../models/Menu');

// Mock blessed
jest.mock('blessed', () => {
    const mockListBar = {
        destroy: jest.fn(),
        on: jest.fn()
    };

    const mockBox = {
        destroy: jest.fn(),
        key: jest.fn(),
        setContent: jest.fn(),
        focus: jest.fn()
    };

    return {
        listbar: jest.fn(() => mockListBar),
        box: jest.fn(() => mockBox)
    };
});

// Get blessed mock
const blessed = require('blessed');

describe('MenuService', () => {
    let menuService;
    let mockScreen;
    let mockListBar;
    let mockBox;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup screen mock
        mockScreen = {
            render: jest.fn(),
            on: jest.fn()
        };

        // Get mockListBar/mockBox references
        mockListBar = blessed.listbar();
        mockBox = blessed.box();

        // Create service
        menuService = new MenuService(mockScreen);
    });

    describe('constructor', () => {
        it('should initialize with screen and empty menu items', () => {
            expect(menuService.screen).toBe(mockScreen);
            expect(menuService.menuItems.size).toBe(0);
        });

        it('should register resize handler on screen', () => {
            expect(mockScreen.on).toHaveBeenCalledWith('resize', expect.any(Function));
        });

        it('should initialize listbar', () => {
            expect(blessed.listbar).toHaveBeenCalledWith(expect.objectContaining({
                parent: mockScreen,
                top: 0,
                left: 0,
                width: '100%',
                height: 1
            }));
        });
    });

    describe('addEvent', () => {
        it('should add a menu item to the menuItems map', () => {
            const keyEvent = new KeyEvent('C-o', jest.fn());
            const label = 'Open';

            menuService.addEvent(keyEvent, label);

            expect(menuService.menuItems.size).toBe(1);
            expect(menuService.menuItems.get(keyEvent)).toBe(label);
        });

        it('should throw error if event is not a KeyEvent instance', () => {
            expect(() => {
                menuService.addEvent({}, 'Open');
            }).toThrow('Event must be an instance of KeyEvent');
        });

        it('should rebuild listbar when adding an event', () => {
            const keyEvent = new KeyEvent('C-o', jest.fn());
            
            // Clear mocks before test
            blessed.listbar.mockClear();
            
            menuService.addEvent(keyEvent, 'Open');
            
            // Should have destroyed old listbar
            expect(mockListBar.destroy).toHaveBeenCalled();
            
            // Should have created a new listbar
            expect(blessed.listbar).toHaveBeenCalledTimes(1);
            
            // Should have rendered the screen
            expect(mockScreen.render).toHaveBeenCalled();
        });
    });

    describe('getMenuItems', () => {
        it('should return a copy of the menu items map', () => {
            const keyEvent = new KeyEvent('C-o', jest.fn());
            menuService.addEvent(keyEvent, 'Open');

            const items = menuService.getMenuItems();
            
            // Should be a map
            expect(items instanceof Map).toBe(true);
            
            // Should contain the item
            expect(items.get(keyEvent)).toBe('Open');
            
            // Should be a copy
            items.clear();
            expect(items.size).toBe(0);
            expect(menuService.menuItems.size).toBe(1);
        });
    });

    describe('showMenu', () => {
        it('should create a box with the menu items', () => {
            // Create a menu
            const menu = new Menu();
            const keyEvent = new KeyEvent('o', jest.fn());
            menu.addEvent(keyEvent, 'Open');

            // Show the menu
            menuService.showMenu(menu, 10, 5);

            // Should create a box
            expect(blessed.box).toHaveBeenCalledWith(expect.objectContaining({
                parent: mockScreen,
                top: 5,
                left: 10,
                width: expect.any(Number),
                height: expect.any(Number)
            }));

            // Should set up key handlers
            expect(mockBox.key).toHaveBeenCalledWith(['up'], expect.any(Function));
            expect(mockBox.key).toHaveBeenCalledWith(['down'], expect.any(Function));
            expect(mockBox.key).toHaveBeenCalledWith(['enter'], expect.any(Function));
            expect(mockBox.key).toHaveBeenCalledWith(['escape'], expect.any(Function));

            // Should render menu items
            expect(mockBox.setContent).toHaveBeenCalled();

            // Should focus the box
            expect(mockBox.focus).toHaveBeenCalled();

            // Should render the screen
            expect(mockScreen.render).toHaveBeenCalled();
        });

        it('should destroy existing menu if one is showing', () => {
            // Create a menu
            const menu = new Menu();
            menu.addEvent(new KeyEvent('o', jest.fn()), 'Open');

            // Show the menu
            menuService.showMenu(menu, 10, 5);
            
            // Clear mocks
            mockBox.destroy.mockClear();
            
            // Show another menu
            menuService.showMenu(menu, 20, 10);
            
            // Should destroy the existing box
            expect(mockBox.destroy).toHaveBeenCalled();
        });
    });

    describe('hideMenu', () => {
        it('should destroy the menu box and render screen', () => {
            // Create a menu
            const menu = new Menu();
            menu.addEvent(new KeyEvent('o', jest.fn()), 'Open');

            // Show the menu
            menuService.showMenu(menu, 10, 5);
            
            // Clear mocks
            mockBox.destroy.mockClear();
            mockScreen.render.mockClear();
            
            // Hide the menu
            menuService.hideMenu();
            
            // Should destroy the box
            expect(mockBox.destroy).toHaveBeenCalled();
            
            // Should render the screen
            expect(mockScreen.render).toHaveBeenCalled();
            
            // Current box should be null
            expect(menuService.currentBox).toBeNull();
            
            // Current menu should be null
            expect(menuService.currentMenu).toBeNull();
        });

        it('should do nothing if no menu is showing', () => {
            // Hide menu when none is showing
            menuService.hideMenu();
            
            // Box destroy should not be called
            expect(mockBox.destroy).not.toHaveBeenCalled();
        });
    });
}); 