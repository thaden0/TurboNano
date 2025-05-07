const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./LoggingService');

/**
 * Service for managing application configuration
 */
class ConfigService {
    /**
     * Creates a new instance of the ConfigService
     */
    constructor() {
        // Default configuration
        this.config = {
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            theme: 'default',
            fontSize: 12,
            tabWidth: 4,
            defaultModel: 'gpt-3.5-turbo',
            aiProvider: 'openai', // Can be 'openai' or 'ollama'
            ollama: {
                baseUrl: 'http://localhost:11434',
                model: 'llama3'
            },
            editor: {
                tabSize: 4, 
                indentSize: 4,
                useTabs: false
            }
        };
        
        // Create the ~/.turbollama directory if it doesn't exist
        this.configDir = path.join(os.homedir(), '.turbollama');
        this.ensureConfigDirExists();
        
        // Path to configuration file
        this.configPath = path.join(this.configDir, 'config.json');
        
        // Load configuration
        this.loadConfig();
    }
    
    /**
     * Ensures the configuration directory exists
     * @private
     */
    async ensureConfigDirExists() {
        try {
            await fs.mkdir(this.configDir, { recursive: true });
            logger.info('ConfigService', `Ensured config directory exists: ${this.configDir}`);
        } catch (error) {
            logger.error('ConfigService', `Error creating config directory: ${error.message}`);
        }
    }
    
    /**
     * Loads configuration from file
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const loadedConfig = JSON.parse(configData);
            
            // Merge with defaults
            this.config = {
                ...this.config,
                ...loadedConfig
            };
            
            // Ensure editor settings are preserved
            if (loadedConfig.editor) {
                this.config.editor = {
                    ...this.config.editor,
                    ...loadedConfig.editor
                };
            }
            
            logger.info('ConfigService', 'Configuration loaded successfully');
        } catch (error) {
            // If file doesn't exist or has errors, create default config
            if (error.code === 'ENOENT') {
                logger.info('ConfigService', 'Configuration file not found, using defaults');
                await this.saveConfig();
            } else {
                logger.error('ConfigService', `Error loading configuration: ${error.message}`);
            }
        }
    }
    
    /**
     * Saves configuration to file
     */
    async saveConfig() {
        try {
            // Ensure the directory exists
            await this.ensureConfigDirExists();
            
            await fs.writeFile(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
            logger.info('ConfigService', 'Configuration saved successfully');
            return true;
        } catch (error) {
            logger.error('ConfigService', `Error saving configuration: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Gets a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key is not found
     * @returns {*} Configuration value
     */
    get(key, defaultValue = null) {
        return key in this.config ? this.config[key] : defaultValue;
    }
    
    /**
     * Sets a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     * @returns {boolean} True if successful
     */
    async set(key, value) {
        this.config[key] = value;
        return await this.saveConfig();
    }
    
    /**
     * Gets the OpenAI API key
     * @returns {string} API key
     */
    getApiKey() {
        return this.config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    }
    
    /**
     * Sets the OpenAI API key
     * @param {string} apiKey - The API key
     * @returns {boolean} True if successful
     */
    async setApiKey(apiKey) {
        return await this.set('openaiApiKey', apiKey);
    }
    
    /**
     * Gets the configuration file path
     * @returns {string} Path to the configuration file
     */
    getConfigFile() {
        return this.configPath;
    }
}

// Create a singleton instance
const configService = new ConfigService();

module.exports = configService; 