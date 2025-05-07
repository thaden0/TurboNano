const KeyEvent = require('./KeyEvent');

describe('KeyEvent', () => {
    describe('constructor', () => {
        it('should initialize with binding and callback', () => {
            const binding = 'C-c';
            const callback = jest.fn();
            
            const keyEvent = new KeyEvent(binding, callback);
            
            expect(keyEvent.binding).toBe(binding);
            expect(keyEvent.callback).toBe(callback);
        });
        
        it('should throw error if binding is not a string', () => {
            const callback = jest.fn();
            
            expect(() => {
                new KeyEvent(123, callback);
            }).toThrow('binding must be a string');
        });
        
        it('should throw error if callback is not a function', () => {
            const binding = 'enter';
            
            expect(() => {
                new KeyEvent(binding, 'not-a-function');
            }).toThrow('callback must be a function');
        });
    });
}); 