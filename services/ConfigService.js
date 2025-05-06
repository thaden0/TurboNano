const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ConfigService {
    constructor() {
        this.configPath = path.join(os.homedir(), '.turbollama', 'config.json');
        this.config = null;
        this.defaultConfig = {
            editor: {
                tabSize: 4,
                indentSize: 4,
                useTabs: false
            }
        };
        this.loadConfig();
    }

    /**
     * Load the config file once during initialization
     * @private
     */
    async loadConfig() {
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            
            try {
                const data = await fs.readFile(this.configPath, 'utf8');
                this.config = JSON.parse(data);
            } catch (error) {
                // If file doesn't exist or is invalid, use default config
                this.config = this.defaultConfig;
                // Save default config
                await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = this.defaultConfig;
        }
    }

    /**
     * Get a value from the config using a path string
     * @param {string} path - Path to the config value (e.g., 'editor.tabSize' or 'users[1].name')
     * @returns {any} The value at the specified path
     */
    getConfig(path) {
        return this._resolvePath(this.config, path);
    }

    /**
     * Set a value in the config using a path string
     * @param {string} path - Path to the config value
     * @param {any} value - Value to set
     */
    async setConfig(path, value) {
        this._setValueAtPath(this.config, path, value);
        try {
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    /**
     * Resolve a path string to a value in an object
     * @private
     * @param {Object} obj - Object to search in
     * @param {string} path - Path to resolve
     * @returns {any} Value at the path
     */
    _resolvePath(obj, path) {
        return path.split(/[\.\[\]]/).filter(Boolean).reduce((current, part) => {
            if (current === undefined) return undefined;
            // Handle array indices
            if (/^\d+$/.test(part)) {
                return current[parseInt(part)];
            }
            return current[part];
        }, obj);
    }

    /**
     * Set a value at a path in an object
     * @private
     * @param {Object} obj - Object to modify
     * @param {string} path - Path to set
     * @param {any} value - Value to set
     */
    _setValueAtPath(obj, path, value) {
        const parts = path.split(/[\.\[\]]/).filter(Boolean);
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];
            const isNextArray = /^\d+$/.test(nextPart);
            
            if (!(part in current)) {
                current[part] = isNextArray ? [] : {};
            }
            current = current[part];
        }
        
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }
}

module.exports = ConfigService; 