const IndentationService = require('./IndentationService');
const ConfigService = require('./ConfigService');

// Mock ConfigService
jest.mock('./ConfigService');

describe('IndentationService', () => {
    let indentationService;
    let mockConfigService;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock ConfigService
        mockConfigService = {
            getConfig: jest.fn()
        };
        ConfigService.mockImplementation(() => mockConfigService);

        // Create service instance
        indentationService = new IndentationService();
    });

    describe('getIndentation', () => {
        it('should return tab character when useTabs is true', () => {
            mockConfigService.getConfig
                .mockImplementation(key => {
                    if (key === 'editor.useTabs') return true;
                    if (key === 'editor.indentSize') return 4;
                });

            const result = indentationService.getIndentation(0);
            expect(result).toBe('\t');
            expect(mockConfigService.getConfig).toHaveBeenCalledWith('editor.useTabs');
        });

        it('should return correct number of spaces when useTabs is false', () => {
            mockConfigService.getConfig
                .mockImplementation(key => {
                    if (key === 'editor.useTabs') return false;
                    if (key === 'editor.indentSize') return 4;
                });

            // Test various column positions
            expect(indentationService.getIndentation(0)).toBe('    '); // 0 -> 4
            expect(indentationService.getIndentation(2)).toBe('  ');   // 2 -> 4
            expect(indentationService.getIndentation(4)).toBe('    '); // 4 -> 8
            expect(indentationService.getIndentation(6)).toBe('  ');   // 6 -> 8
        });

        it('should handle custom indent sizes', () => {
            mockConfigService.getConfig
                .mockImplementation(key => {
                    if (key === 'editor.useTabs') return false;
                    if (key === 'editor.indentSize') return 2;
                });

            expect(indentationService.getIndentation(0)).toBe('  '); // 0 -> 2
            expect(indentationService.getIndentation(1)).toBe(' '); // 1 -> 2
            expect(indentationService.getIndentation(2)).toBe('  '); // 2 -> 4
        });
    });

    describe('expandTabs', () => {
        beforeEach(() => {
            mockConfigService.getConfig
                .mockImplementation(key => {
                    if (key === 'editor.tabSize') return 4;
                });
        });

        it('should convert tabs to spaces at the start of line', () => {
            const result = indentationService.expandTabs('\t\tcode');
            expect(result).toBe('        code');
        });

        it('should handle tabs in the middle of text', () => {
            const result = indentationService.expandTabs('some\ttext\there');
            expect(result).toBe('some    text    here');
        });

        it('should respect start column for alignment', () => {
            const result = indentationService.expandTabs('\ttext', 2);
            // Starting at column 2, need 2 spaces to reach next tab stop at 4
            expect(result).toBe('  text');
        });

        it('should handle custom tab sizes', () => {
            mockConfigService.getConfig
                .mockReturnValue(2); // tab size of 2

            const result = indentationService.expandTabs('\t\tcode');
            expect(result).toBe('    code');
        });

        it('should handle text without tabs', () => {
            const text = 'no tabs here';
            const result = indentationService.expandTabs(text);
            expect(result).toBe(text);
        });

        it('should handle empty string', () => {
            const result = indentationService.expandTabs('');
            expect(result).toBe('');
        });
    });
}); 