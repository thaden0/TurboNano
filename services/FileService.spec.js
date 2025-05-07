const FileService = require('./FileService');
const EditFile = require('../models/EditFile');
const IndentationService = require('./IndentationService');

// Mock dependencies
jest.mock('fs', () => {
    const mockReadFile = jest.fn();
    const mockWriteFile = jest.fn();
    return {
        promises: {
            readFile: mockReadFile,
            writeFile: mockWriteFile
        }
    };
});

const fs = require('fs');

jest.mock('./IndentationService');
jest.mock('path', () => ({
    resolve: jest.fn((cwd, fileName) => `/resolved/${fileName}`),
}));

describe('FileService', () => {
    let fileService;
    let mockIndentationService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock IndentationService
        mockIndentationService = {
            expandTabs: jest.fn(line => line) // Default implementation just returns the line
        };
        IndentationService.mockImplementation(() => mockIndentationService);
        
        fileService = new FileService();
    });

    describe('getTextFile', () => {
        it('should read and parse file content correctly', async () => {
            const mockContent = 'line1\nline2\nline3';
            fs.promises.readFile.mockResolvedValue(mockContent);
            mockIndentationService.expandTabs
                .mockImplementation(line => `expanded_${line}`);

            const result = await fileService.getTextFile('test.txt');

            expect(fs.promises.readFile).toHaveBeenCalledWith(
                '/resolved/test.txt',
                'utf8'
            );
            expect(result).toBeInstanceOf(EditFile);
            expect(result.fileName).toBe('test.txt');
            expect(result.fileData).toEqual([
                'expanded_line1',
                'expanded_line2',
                'expanded_line3'
            ]);
        });

        it('should handle empty files', async () => {
            fs.promises.readFile.mockResolvedValue('');

            const result = await fileService.getTextFile('empty.txt');

            expect(result).toBeInstanceOf(EditFile);
            expect(result.fileName).toBe('empty.txt');
            expect(result.fileData).toEqual(['']);
        });

        it('should handle file read errors', async () => {
            const error = new Error('File not found');
            fs.promises.readFile.mockRejectedValue(error);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await fileService.getTextFile('nonexistent.txt');

            expect(consoleSpy).toHaveBeenCalledWith('Error reading file:', error);
            expect(result).toBeInstanceOf(EditFile);
            expect(result.fileName).toBe('nonexistent.txt');
            expect(result.fileData).toEqual(['']);

            consoleSpy.mockRestore();
        });

        it('should expand tabs in each line', async () => {
            const mockContent = 'line\twith\ttabs';
            fs.promises.readFile.mockResolvedValue(mockContent);
            mockIndentationService.expandTabs
                .mockImplementation(line => line.replace(/\t/g, '    '));

            const result = await fileService.getTextFile('tabs.txt');

            expect(mockIndentationService.expandTabs).toHaveBeenCalledWith('line\twith\ttabs');
            expect(result.fileData).toEqual(['line    with    tabs']);
        });
    });

    describe('saveTextFile', () => {
        it('should save file content correctly', async () => {
            const editFile = new EditFile('test.txt', ['line1', 'line2', 'line3']);
            await fileService.saveTextFile(editFile);

            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                '/resolved/test.txt',
                ['line1', 'line2', 'line3'],
                'utf8'
            );
        });

        it('should handle save errors', async () => {
            const error = new Error('Permission denied');
            fs.promises.writeFile.mockRejectedValue(error);
            const editFile = new EditFile('test.txt', ['content']);

            await expect(fileService.saveTextFile(editFile))
                .rejects.toThrow('Permission denied');
        });
    });
}); 