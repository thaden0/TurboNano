const Menu = require('./Menu');
const KeyEvent = require('./KeyEvent');

describe('Menu', () => {
    let menu;
    
    beforeEach(() => {
        menu = new Menu();
    });
    
    describe('constructor', () => {
        it('should initialize with empty items map', () => {
            expect(menu.items.size).toBe(0);
        });
    });
    
    describe('addEvent', () => {
        it('should add a menu item with event and label', () => {
            const keyEvent = new KeyEvent('C-c', jest.fn());
            const label = 'Copy';
            
            menu.addEvent(keyEvent, label);
            
            expect(menu.items.size).toBe(1);
            expect(menu.items.get(keyEvent)).toBe(label);
        });
        
        it('should throw error if event is not a KeyEvent', () => {
            expect(() => {
                menu.addEvent({binding: 'C-c', callback: jest.fn()}, 'Copy');
            }).toThrow('Event must be an instance of KeyEvent');
        });
        
        it('should allow multiple events to be added', () => {
            const keyEvent1 = new KeyEvent('C-c', jest.fn());
            const keyEvent2 = new KeyEvent('C-v', jest.fn());
            
            menu.addEvent(keyEvent1, 'Copy');
            menu.addEvent(keyEvent2, 'Paste');
            
            expect(menu.items.size).toBe(2);
            expect(menu.items.get(keyEvent1)).toBe('Copy');
            expect(menu.items.get(keyEvent2)).toBe('Paste');
        });
    });
    
    describe('getItems', () => {
        it('should return a copy of the items map', () => {
            const keyEvent = new KeyEvent('C-c', jest.fn());
            
            menu.addEvent(keyEvent, 'Copy');
            
            const items = menu.getItems();
            
            expect(items).toBeInstanceOf(Map);
            expect(items.size).toBe(1);
            expect(items.get(keyEvent)).toBe('Copy');
            
            // Verify it's a copy by modifying the returned map
            items.clear();
            expect(items.size).toBe(0);
            expect(menu.items.size).toBe(1); // Original unchanged
        });
        
        it('should return empty map when no items added', () => {
            const items = menu.getItems();
            
            expect(items).toBeInstanceOf(Map);
            expect(items.size).toBe(0);
        });
    });
}); 