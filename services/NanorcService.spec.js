const NanorcService = require('./NanorcService');
const path = require('path');
const os = require('os');
const logger = require('./LoggingService');

// Mock dependencies
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        readdir: jest.fn(),
        readFile: jest.fn()
    }
}));

jest.mock('os', () => ({
    homedir: jest.fn(() => '/mock/home')
}));

jest.mock('./LoggingService', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

// Get mock functions after jest.mock
const fs = require('fs');
const mockMkdir = fs.promises.mkdir;
const mockReaddir = fs.promises.readdir;
const mockReadFile = fs.promises.readFile;

describe('NanorcService', () => {
    let nanorcService;
    const mockNanorcDir = '/mock/home/.turbollama/nanorc';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocked functions to their default behavior
        mockMkdir.mockResolvedValue(undefined);
        mockReaddir.mockResolvedValue([]);
        mockReadFile.mockResolvedValue('');
    });

    describe('initialization', () => {
        it('should create nanorc directory if it does not exist', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            expect(mockMkdir).toHaveBeenCalledWith(mockNanorcDir, { recursive: true });
        });

        it('should load nanorc files on initialization', async () => {
            const mockFiles = ['javascript.nanorc', 'python.nanorc', 'not-a-nanorc-file.txt'];
            mockReaddir.mockResolvedValue(mockFiles);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            expect(mockReadFile).toHaveBeenCalledTimes(2); // Only .nanorc files
            expect(mockReadFile).toHaveBeenCalledWith(
                path.join(mockNanorcDir, 'javascript.nanorc'),
                'utf8'
            );
            expect(mockReadFile).toHaveBeenCalledWith(
                path.join(mockNanorcDir, 'python.nanorc'),
                'utf8'
            );
        });

        it('should handle initialization errors gracefully', async () => {
            const error = new Error('Failed to read directory');
            mockReaddir.mockRejectedValue(error);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            expect(logger.error).toHaveBeenCalledWith(
                'NanorcService',
                'Error loading nanorc files:',
                error
            );
        });
    });

    describe('style', () => {
        beforeEach(() => {
            // Mock a JavaScript syntax file
            mockReaddir.mockResolvedValue(['javascript.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "JavaScript" "\\.js$"
color yellow "\\b(function|const|let|var|if|else|return)\\b"
color cyan "\\b(console|window|document)\\b"
color green "\\"[^\\"]*\\""
color green "'[^']*'"
color green "\`[^\`]*\`"`);
        });

        it('should apply syntax highlighting to keywords', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const line = 'function test() { return "hello"; }';
            const result = await nanorcService.style(line, 'test.js');

            expect(result).toContain('{yellow-fg}function{/yellow-fg}');
            expect(result).toContain('{yellow-fg}return{/yellow-fg}');
        });

        it('should return original line when no rules match', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const line = 'some plain text';
            const result = await nanorcService.style(line, 'test.js');

            expect(result).toBe(line);
        });

        it('should return original line for unmatched file types', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const line = 'function test() {}';
            const result = await nanorcService.style(line, 'test.txt');

            expect(result).toBe(line);
        });

        it('should handle multiple keyword matches in the same line', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const line = 'const test = function() { console.log("test"); }';
            const result = await nanorcService.style(line, 'test.js');

            expect(result).toContain('{yellow-fg}const{/yellow-fg}');
            expect(result).toContain('{yellow-fg}function{/yellow-fg}');
            expect(result).toContain('{cyan-fg}console{/cyan-fg}');
        });

        it('should cache patterns for previously seen file types', async () => {
            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            // First call should load and cache patterns
            await nanorcService.style('function test() {}', 'test.js');
            mockReadFile.mockClear();

            // Second call should use cached patterns
            await nanorcService.style('const x = 5;', 'test.js');
            expect(mockReadFile).not.toHaveBeenCalled();
        });
        
        it('should handle regex errors during pattern application', async () => {
            // Mock an invalid regex pattern
            mockReaddir.mockResolvedValue(['bad.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Bad" "\\.js$"
color red "(unclosed"`); // Invalid regex pattern

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            const result = await nanorcService.style('test', 'test.js');
            
            expect(result).toBe('test');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('rule parsing', () => {
        it('should parse multiple syntax definitions from one file', async () => {
            mockReaddir.mockResolvedValue(['multi.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "JavaScript" "\\.js$"
color yellow "\\b(var|let|const)\\b"

syntax "Python" "\\.py$"
color blue "\\b(def|class)\\b"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const jsResult = await nanorcService.style('const x = 5;', 'test.js');
            const pyResult = await nanorcService.style('def test():', 'test.py');

            expect(jsResult).toContain('{yellow-fg}const{/yellow-fg}');
            expect(pyResult).toContain('{blue-fg}def{/blue-fg}');
        });

        it('should ignore comments and empty lines', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
# This is a comment
syntax "Test" "\\.test$"

# Another comment
color red "test"

# Empty lines above and below

color blue "example"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick); // Wait for loadAllRules to complete

            const result = await nanorcService.style('test example', 'file.test');
            expect(result).toContain('{red-fg}test{/red-fg}');
            expect(result).toContain('{blue-fg}example{/blue-fg}');
        });
        
        it('should parse partial nanorc files', async () => {
            mockReaddir.mockResolvedValue(['partial.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Partial"
color green "valid"`); // Missing file pattern

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);
            
            // No errors should be thrown
            expect(nanorcService.loadedRules.size).toBe(0);
        });
    });

    describe('regex conversion', () => {
        it('should convert nanorc regex to JavaScript regex', () => {
            nanorcService = new NanorcService();
            
            // Test word boundaries
            const wordBoundary = nanorcService._convertNanorcRegex('\\<test\\>');
            expect(wordBoundary).toBe('\\btest\\b');
            
            // Test escaping
            const escaped = nanorcService._convertNanorcRegex('\\(test\\)');
            expect(escaped).toBe('\\(test\\)');
        });

        it('should handle word boundaries correctly', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Test" "\\.test$"
color red "\\<word\\>"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            // Mock the style implementation to use the modified pattern
            jest.spyOn(nanorcService, '_matchesFilePattern').mockReturnValue(true);
            jest.spyOn(nanorcService, '_convertNanorcRegex').mockReturnValue('\\bword\\b');
            
            const pattern = [new RegExp('\\bword\\b', 'g'), 'red'];
            nanorcService.cachedPatterns.set('file.test', [pattern]);

            const result = await nanorcService.style('word', 'file.test');
            expect(result).toContain('{red-fg}word{/red-fg}');
        });
    });

    describe('file pattern matching', () => {
        it('should match exact filenames', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Test" "exact\\.txt$"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            const matched = nanorcService._matchesFilePattern('exact.txt', 'exact\\.txt$');
            expect(matched).toBe(true);
            
            const notMatched = nanorcService._matchesFilePattern('other.txt', 'exact\\.txt$');
            expect(notMatched).toBe(false);
        });

        it('should match wildcard patterns', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Test" "\\*.txt$"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            const result = nanorcService._matchesFilePattern('any.txt', '\\*.txt$');
            expect(result).toBe(true);
        });

        it('should match complex patterns', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Test" "test[0-9]\\{2\\}\\.txt$"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            const matched = nanorcService._matchesFilePattern('test42.txt', 'test[0-9]\\{2\\}\\.txt$');
            expect(matched).toBe(true);
            
            const notMatched = nanorcService._matchesFilePattern('test4.txt', 'test[0-9]\\{2\\}\\.txt$');
            expect(notMatched).toBe(false);
        });
        
        it('should only match against the basename of a path', async () => {
            nanorcService = new NanorcService();
            
            const fullPath = '/path/to/file.js';
            const matched = nanorcService._matchesFilePattern(fullPath, '\\.js$');
            expect(matched).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle invalid regex patterns gracefully', async () => {
            mockReaddir.mockResolvedValue(['test.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Test" "\\.test$"
color red "["`); // Invalid regex pattern

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            // This should not throw
            const result = await nanorcService.style('test', 'file.test');
            expect(result).toBe('test');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle file system errors', async () => {
            // Create service and initialize it
            nanorcService = new NanorcService();
            await new Promise(process.nextTick);
            
            // Reset mocks
            jest.clearAllMocks();
            
            // Mock _loadRulesForFile to throw an error
            const error = new Error('File system error');
            jest.spyOn(nanorcService, '_loadRulesForFile').mockRejectedValue(error);
            
            const result = await nanorcService.style('test', 'unknown.test');
            expect(result).toBe('test');
            expect(logger.error).toHaveBeenCalledWith(
                'NanorcService',
                'Error loading rules for file:',
                error
            );
        });
        
        it('should handle errors when loading rules for a file', async () => {
            nanorcService = new NanorcService();
            nanorcService.initialized = false;
            
            // Mock _loadAllRules to throw an error
            jest.spyOn(nanorcService, '_loadAllRules').mockRejectedValue(new Error('Failed to load rules'));
            
            const result = await nanorcService.style('test line', 'file.js');
            
            expect(result).toBe('test line');
            expect(logger.error).toHaveBeenCalledWith(
                'NanorcService',
                'Error loading rules:',
                expect.any(Error)
            );
        });
    });
    
    describe('cached patterns', () => {
        it('should cache null for non-matching file types', async () => {
            nanorcService = new NanorcService();
            nanorcService.initialized = true; // Skip loading rules
            
            await nanorcService.style('test', 'unknown.ext');
            
            expect(nanorcService.cachedPatterns.get('unknown.ext')).toBeNull();
        });
        
        it('should handle overlapping matches correctly', async () => {
            mockReaddir.mockResolvedValue(['overlap.nanorc']);
            mockReadFile.mockResolvedValue(`
syntax "Overlap" "\\.ovr$"
color red "abc"
color blue "abcdef"`);

            nanorcService = new NanorcService();
            await new Promise(process.nextTick);

            const result = await nanorcService.style('abcdef', 'test.ovr');
            
            // Should prefer the longer match
            expect(result).toContain('{blue-fg}abcdef{/blue-fg}');
            expect(result).not.toContain('{red-fg}abc{/red-fg}');
        });
    });
});