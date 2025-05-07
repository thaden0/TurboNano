const AIPrompt = require('./AIPrompt');
const KeyEvent = require('../KeyEvent');
const AIService = require('../../services/AIService');

// Mock dependent services
jest.mock('../../services/AIService');
jest.mock('../../services/LoggingService', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
}));

describe('AIPrompt', () => {
    let aiPrompt;
    let mockWindowService;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock WindowService
        mockWindowService = {
            screen: {
                render: jest.fn()
            },
            updateCursor: jest.fn(),
            windows: [
                {
                    window: {} // Will be set later
                }
            ],
            next: jest.fn()
        };

        // Create AIPrompt instance
        aiPrompt = new AIPrompt(mockWindowService);
        
        // Set window reference
        mockWindowService.windows[0].window = aiPrompt;
        mockWindowService.windows[0].element = {
            setContent: jest.fn()
        };
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(aiPrompt.windowService).toBe(mockWindowService);
            expect(aiPrompt.promptText).toBe('');
            expect(aiPrompt.cursorX).toBe(0);
            expect(aiPrompt.cursorY).toBe(0);
            expect(aiPrompt.scrollOffsetX).toBe(0);
            expect(aiPrompt.scrollOffsetY).toBe(0);
            expect(aiPrompt.currentFile).toBeNull();
            expect(aiPrompt.aiService).toBeInstanceOf(AIService);
            
            // Check anchor and dimension properties
            expect(aiPrompt.anchorTop).toBe(false);
            expect(aiPrompt.anchorBottom).toBe(true);
            expect(aiPrompt.anchorLeft).toBe(true);
            expect(aiPrompt.anchorRight).toBe(true);
            expect(aiPrompt.width).toBeNull();
            expect(aiPrompt.height).toBe(3);
        });

        it('should register required key events', () => {
            const eventBindings = aiPrompt.events.map(e => e.binding);
            
            // Check if basic events are registered
            expect(eventBindings).toContain('return');
            expect(eventBindings).toContain('enter');
            expect(eventBindings).toContain('C-m');
            expect(eventBindings).toContain('\r');
            expect(eventBindings).toContain('backspace');
            expect(eventBindings).toContain('up');
            expect(eventBindings).toContain('down');
            expect(eventBindings).toContain('left');
            expect(eventBindings).toContain('right');
            expect(eventBindings).toContain('escape');
            expect(eventBindings).toContain('C-[');
            // Tab is now handled directly in press method, not as an event
            expect(eventBindings).not.toContain('tab');
        });
    });

    describe('tab key event', () => {
        it('should call windowService.next when tab key is pressed', async () => {
            // Press the tab key
            await aiPrompt.press({ name: 'tab', full: 'tab', sequence: '\t' });
            
            // Check that windowService.next was called
            expect(mockWindowService.next).toHaveBeenCalled();
        });

        it('should prioritize tab key handling even if full property is different', async () => {
            // Reset mock to ensure we're counting new calls
            mockWindowService.next.mockReset();
            
            // Press tab key with non-matching full property
            await aiPrompt.press({ 
                name: 'tab',
                full: 'something-else', 
                sequence: '\t' 
            });
            
            // Check that windowService.next was called
            expect(mockWindowService.next).toHaveBeenCalled();
        });
        
        it('should not process other events or insert text when tab is pressed', async () => {
            const redrawSpy = jest.spyOn(aiPrompt, 'redraw').mockImplementation();
            const callbackSpy = jest.fn();
            
            // Add a test event with tab binding that should be bypassed
            aiPrompt.addEvent(new KeyEvent('tab', callbackSpy));
            
            // Press tab key
            await aiPrompt.press({ name: 'tab', full: 'tab', sequence: '\t' });
            
            // Verify no text was inserted and event callback wasn't called
            expect(aiPrompt.promptText).toBe('');
            expect(redrawSpy).not.toHaveBeenCalled();
            expect(callbackSpy).not.toHaveBeenCalled();
        });
    });

    describe('press', () => {
        it('should execute matching event callback', async () => {
            // Create a test event
            const callback = jest.fn();
            const testEvent = new KeyEvent('test-key', callback);
            aiPrompt.addEvent(testEvent);
            
            // Press the key
            await aiPrompt.press({ full: 'test-key' });
            
            expect(callback).toHaveBeenCalled();
        });

        it('should handle character input when no event matches', async () => {
            const redrawSpy = jest.spyOn(aiPrompt, 'redraw').mockImplementation();
            
            // Press a key that doesn't match any event
            await aiPrompt.press({ full: 'a', sequence: 'a' });
            
            expect(aiPrompt.promptText).toBe('a');
            expect(aiPrompt.cursorX).toBe(1); // Cursor should move right
            expect(redrawSpy).toHaveBeenCalled();
        });
    });
}); 