const ConfigService = require('./ConfigService');
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

jest.mock('os', () => ({
    homedir: jest.fn(() => '/mock/home')
}));

// Get mock functions after jest.mock
const fs = require('fs');
const mockMkdir = fs.promises.mkdir;
const mockReadFile = fs.promises.readFile;
const mockWriteFile = fs.promises.writeFile;

describe('ConfigService', () => {
    let configService;
    const mockConfigPath = '/mock/home/.turbollama/config.json';
    const defaultConfig = {
        editor: {
            tabSize: 4,
            indentSize: 4,
            useTabs: false
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocked functions to their default behavior
        mockMkdir.mockResolvedValue(undefined);
        mockReadFile.mockRejectedValue(new Error('File not found'));
        mockWriteFile.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('should create config directory if it does not exist', async () => {
            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete

            expect(mockMkdir).toHaveBeenCalledWith(
                path.dirname(mockConfigPath),
                { recursive: true }
            );
        });

        it('should load existing config file', async () => {
            const mockConfig = {
                editor: {
                    tabSize: 2,
                    indentSize: 2,
                    useTabs: true
                }
            };
            mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));

            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete

            expect(configService.getConfig('editor.tabSize')).toBe(2);
            expect(configService.getConfig('editor.indentSize')).toBe(2);
            expect(configService.getConfig('editor.useTabs')).toBe(true);
        });

        it('should create default config if file does not exist', async () => {
            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete

            expect(mockWriteFile).toHaveBeenCalledWith(
                mockConfigPath,
                JSON.stringify(defaultConfig, null, 2)
            );
            expect(configService.getConfig('editor.tabSize')).toBe(4);
        });

        it('should handle invalid JSON in config file', async () => {
            mockReadFile.mockResolvedValue('invalid json');

            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete

            expect(mockWriteFile).toHaveBeenCalledWith(
                mockConfigPath,
                JSON.stringify(defaultConfig, null, 2)
            );
            expect(configService.getConfig('editor.tabSize')).toBe(4);
        });
    });

    describe('getConfig', () => {
        beforeEach(async () => {
            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete
        });

        it('should get simple path values', () => {
            expect(configService.getConfig('editor.tabSize')).toBe(4);
            expect(configService.getConfig('editor.useTabs')).toBe(false);
        });

        it('should handle undefined paths', () => {
            expect(configService.getConfig('nonexistent.path')).toBeUndefined();
        });

        it('should handle array indices in path', async () => {
            await configService.setConfig('testArray[0]', 'value');
            expect(configService.getConfig('testArray[0]')).toBe('value');
        });
    });

    describe('setConfig', () => {
        beforeEach(async () => {
            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete
        });

        it('should set and save simple values', async () => {
            await configService.setConfig('editor.tabSize', 2);

            expect(configService.getConfig('editor.tabSize')).toBe(2);
            expect(mockWriteFile).toHaveBeenCalledWith(
                mockConfigPath,
                expect.any(String)
            );
        });

        it('should create nested objects when needed', async () => {
            await configService.setConfig('newSection.newKey', 'value');

            expect(configService.getConfig('newSection.newKey')).toBe('value');
        });

        it('should handle array paths', async () => {
            await configService.setConfig('users[0].name', 'John');
            await configService.setConfig('users[1].name', 'Jane');

            expect(configService.getConfig('users[0].name')).toBe('John');
            expect(configService.getConfig('users[1].name')).toBe('Jane');
        });

        it('should handle write errors', async () => {
            const error = new Error('Write error');
            mockWriteFile.mockRejectedValue(error);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await configService.setConfig('test', 'value');

            expect(consoleSpy).toHaveBeenCalledWith('Error saving config:', error);
            consoleSpy.mockRestore();
        });
    });

    describe('path resolution', () => {
        beforeEach(async () => {
            configService = new ConfigService();
            await new Promise(process.nextTick); // Wait for loadConfig to complete
        });

        it('should handle complex nested paths', async () => {
            await configService.setConfig('a.b[0].c.d[1]', 'value');
            expect(configService.getConfig('a.b[0].c.d[1]')).toBe('value');
        });

        it('should handle missing intermediate values', () => {
            expect(configService.getConfig('a.b[0].c')).toBeUndefined();
        });
    });
}); 