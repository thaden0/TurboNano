const path = require('path');
const os = require('os');

// Need to mock dependencies before requiring the module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        appendFile: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('os', () => ({
    homedir: jest.fn().mockReturnValue('/mock/home')
}));

// Get fs mocks after jest.mock
const fs = require('fs').promises;
const mockMkdir = fs.mkdir;
const mockWriteFile = fs.writeFile;
const mockAppendFile = fs.appendFile;

// Mock clearInterval
global.clearInterval = jest.fn();

// Save original setInterval to restore it later
const originalSetInterval = global.setInterval;

// Now we can require the service
// Note: This is a singleton, so it's already constructed when required
const loggingService = require('./LoggingService');

describe('LoggingService', () => {
    const mockLogDir = '/mock/home/.turbollama/logs';
    const mockLogFile = path.join(mockLogDir, 'editor.log');
    
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear the buffer manually
        loggingService.buffer = [];
    });
    
    // Clean up after all tests
    afterAll(async () => {
        // Make sure we clean up the service
        await loggingService.cleanup();
        
        // Restore the original setInterval
        global.setInterval = originalSetInterval;
    });

    describe('initialization', () => {
        it('should initialize with correct log directory and file paths', () => {
            expect(loggingService.logDir).toBe(mockLogDir);
            expect(loggingService.logFile).toBe(mockLogFile);
        });
    });

    describe('logging methods', () => {
        it('should format log messages correctly', () => {
            // Use private _formatLog method directly
            const formattedLog = loggingService._formatLog('info', 'TestService', 'Test message');
            
            // Check format with regex to handle timestamp
            expect(formattedLog).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestService\] Test message$/);
        });

        it('should add debug messages to buffer', () => {
            loggingService.debug('TestService', 'Test debug message');
            
            expect(loggingService.buffer.length).toBe(1);
            expect(loggingService.buffer[0]).toMatch(/\[DEBUG\] \[TestService\] Test debug message$/);
        });

        it('should add info messages to buffer', () => {
            loggingService.info('TestService', 'Test info message');
            
            expect(loggingService.buffer.length).toBe(1);
            expect(loggingService.buffer[0]).toMatch(/\[INFO\] \[TestService\] Test info message$/);
        });

        it('should add warning messages to buffer', () => {
            loggingService.warn('TestService', 'Test warning message');
            
            expect(loggingService.buffer.length).toBe(1);
            expect(loggingService.buffer[0]).toMatch(/\[WARN\] \[TestService\] Test warning message$/);
        });

        it('should add error messages to buffer', () => {
            loggingService.error('TestService', 'Test error message');
            
            expect(loggingService.buffer.length).toBe(1);
            expect(loggingService.buffer[0]).toMatch(/\[ERROR\] \[TestService\] Test error message$/);
        });

        it('should include error stack in buffer when error object is provided', () => {
            const testError = new Error('Test error');
            loggingService.error('TestService', 'Test error message', testError);
            
            expect(loggingService.buffer.length).toBe(2);
            expect(loggingService.buffer[0]).toMatch(/\[ERROR\] \[TestService\] Test error message$/);
            expect(loggingService.buffer[1]).toMatch(/\[ERROR\] \[TestService\] Stack: Error: Test error/);
        });
    });

    describe('log flushing', () => {
        it('should not flush empty buffer', async () => {
            await loggingService._flush();
            
            expect(mockAppendFile).not.toHaveBeenCalled();
        });

        it('should flush buffer to file', async () => {
            loggingService.info('TestService', 'Message 1');
            loggingService.info('TestService', 'Message 2');
            
            await loggingService._flush();
            
            expect(mockAppendFile).toHaveBeenCalledWith(
                mockLogFile,
                expect.stringMatching(/Message 1\n.*Message 2\n/),
                'utf8'
            );
            expect(loggingService.buffer.length).toBe(0);
        });
    });

    describe('cleanup', () => {
        it('should clear interval and flush logs during cleanup', async () => {
            // Add some logs
            loggingService.info('TestService', 'Cleanup test message');
            
            await loggingService.cleanup();
            
            expect(mockAppendFile).toHaveBeenCalled();
            expect(global.clearInterval).toHaveBeenCalled();
        });
    });
}); 