const Event = require('./Event');

describe('Event', () => {
    describe('constructor', () => {
        it('should initialize with binding and callback', () => {
            const binding = 'test-binding';
            const callback = jest.fn();
            
            const event = new Event(binding, callback);
            
            expect(event.binding).toBe(binding);
            expect(event.callback).toBe(callback);
        });
        
        it('should throw error if binding is not a string', () => {
            const callback = jest.fn();
            
            expect(() => {
                new Event(123, callback);
            }).toThrow('binding must be a string');
        });
        
        it('should throw error if callback is not a function', () => {
            const binding = 'test-binding';
            
            expect(() => {
                new Event(binding, 'not-a-function');
            }).toThrow('callback must be a function');
        });
    });
}); 