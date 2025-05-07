const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class LoggingService {
    constructor() {
        /** @private */
        this.logDir = path.join(os.homedir(), '.turbollama', 'logs');
        /** @private */
        this.logFile = path.join(this.logDir, 'editor.log');
        /** @private */
        this.buffer = [];
        /** @private */
        this.flushInterval = null;
        /** @private */
        this.logLevel = 'debug'; // Force debug level

        // Create log directory immediately
        fs.mkdir(this.logDir, { recursive: true })
            .then(() => {
                // Create an empty log file if it doesn't exist
                return fs.writeFile(this.logFile, '', { flag: 'a' });
            })
            .then(() => {
                // Start the flush interval
                this.flushInterval = setInterval(() => this._flush(), 1000);
                // Log service start
                this.info('LoggingService', 'Logging service initialized');
                this.debug('LoggingService', 'Debug logging is enabled');
            })
            .catch(error => {
                console.error('Failed to initialize logging service:', error);
            });
    }

    /**
     * @private
     * Flushes the log buffer to file
     */
    async _flush() {
        if (this.buffer.length === 0) return;

        try {
            const logs = this.buffer.join('\n') + '\n';
            await fs.appendFile(this.logFile, logs, 'utf8');
            this.buffer = [];
        } catch (error) {
            // Keep minimal console.error for critical file system failures
            console.error('Failed to flush logs:', error);
        }
    }

    /**
     * @private
     * Formats a log message
     * @param {string} level - Log level
     * @param {string} service - Service name
     * @param {string} message - Log message
     * @returns {string} Formatted log message
     */
    _formatLog(level, service, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}`;
    }

    /**
     * Logs a debug message
     * @param {string} service - Service name
     * @param {string} message - Log message
     */
    debug(service, message) {
        // Always log debug messages
        const log = this._formatLog('debug', service, message);
        this.buffer.push(log);
    }

    /**
     * Logs an info message
     * @param {string} service - Service name
     * @param {string} message - Log message
     */
    info(service, message) {
        if (['debug', 'info'].includes(this.logLevel)) {
            const log = this._formatLog('info', service, message);
            this.buffer.push(log);
        }
    }

    /**
     * Logs a warning message
     * @param {string} service - Service name
     * @param {string} message - Log message
     */
    warn(service, message) {
        if (['debug', 'info', 'warn'].includes(this.logLevel)) {
            const log = this._formatLog('warn', service, message);
            this.buffer.push(log);
        }
    }

    /**
     * Logs an error message
     * @param {string} service - Service name
     * @param {string} message - Log message
     * @param {Error} [error] - Optional error object
     */
    error(service, message, error = null) {
        const log = this._formatLog('error', service, message);
        this.buffer.push(log);
        if (error) {
            this.buffer.push(this._formatLog('error', service, `Stack: ${error.stack}`));
        }
    }

    /**
     * Cleans up the logging service
     */
    async cleanup() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        await this._flush();
    }
}

// Create a singleton instance
const loggingService = new LoggingService();

module.exports = loggingService; 