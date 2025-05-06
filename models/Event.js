/**
 * Represents an event with a binding and callback function
 */
class Event {
    /**
     * @param {string} binding - The key or action that triggers the event (e.g., 'C-c', 'enter')
     * @param {Function} callback - The function to call when the event is triggered
     */
    constructor(binding, callback) {
        if (typeof binding !== 'string') throw new Error('binding must be a string');
        if (typeof callback !== 'function') throw new Error('callback must be a function');
        
        this.binding = binding;
        this.callback = callback;
    }
}

module.exports = Event;
