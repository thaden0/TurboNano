const FileMenu = require('./FileMenu');
const Menu = require('./Menu');
const KeyEvent = require('./KeyEvent');

describe('FileMenu', () => {
    let fileMenu;
    let mockMenuService;
    
    beforeEach(() => {
        mockMenuService = {
            showMenu: jest.fn()
        };
        fileMenu = new FileMenu(mockMenuService);
    });
    
    describe('constructor', () => {
        it('should initialize with name and menuService', () => {
            expect(fileMenu.name).toBe('File Menu');
            expect(fileMenu.menuService).toBe(mockMenuService);
        });
        
        it('should inherit from Menu', () => {
            expect(fileMenu instanceof Menu).toBe(true);
        });
    });
    
    describe('show', () => {
        it('should call menuService.showMenu with correct parameters', () => {
            fileMenu.show();
            
            expect(mockMenuService.showMenu).toHaveBeenCalledWith(fileMenu, 2, 2);
        });
    });
    
    describe('addItem', () => {
        it('should add a menu item with first character as binding', () => {
            const callback = jest.fn();
            
            fileMenu.addItem('Open', callback);
            
            const items = fileMenu.getItems();
            expect(items.size).toBe(1);
            
            // Get the first (and only) entry
            const entry = Array.from(items.entries())[0];
            const [event, label] = entry;
            
            expect(label).toBe('Open');
            expect(event.binding).toBe('o');
            expect(event.callback).toBe(callback);
        });
        
        it('should work with multiple items', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            fileMenu.addItem('Open', callback1);
            fileMenu.addItem('Save', callback2);
            
            const items = fileMenu.getItems();
            expect(items.size).toBe(2);
            
            // Convert map to array for easier testing
            const entries = Array.from(items.entries());
            
            // Find entries by label
            const openEntry = entries.find(([_, label]) => label === 'Open');
            const saveEntry = entries.find(([_, label]) => label === 'Save');
            
            expect(openEntry[0].binding).toBe('o');
            expect(openEntry[0].callback).toBe(callback1);
            
            expect(saveEntry[0].binding).toBe('s');
            expect(saveEntry[0].callback).toBe(callback2);
        });
        
        it('should handle items with same first character', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            fileMenu.addItem('Open', callback1);
            fileMenu.addItem('Options', callback2);
            
            const items = fileMenu.getItems();
            expect(items.size).toBe(2);
            
            // Both should have 'o' binding but different callbacks
            const entries = Array.from(items.entries());
            const openEntry = entries.find(([_, label]) => label === 'Open');
            const optionsEntry = entries.find(([_, label]) => label === 'Options');
            
            expect(openEntry[0].binding).toBe('o');
            expect(optionsEntry[0].binding).toBe('o');
            
            expect(openEntry[0].callback).toBe(callback1);
            expect(optionsEntry[0].callback).toBe(callback2);
        });
    });
}); 