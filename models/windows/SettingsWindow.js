const EditWindow = require('./EditWindow');
const EditFile = require('../EditFile');
const configService = require('../../services/ConfigService');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../../services/LoggingService');

/**
 * @class
 * @implements {import('../../interfaces/IWindow').IWindow}
 */
class SettingsWindow extends EditWindow {
    /**
     * Creates a new SettingsWindow
     * @param {Object} windowService - The window service instance
     */
    constructor(windowService = null) {
        // Initialize with a temporary placeholder file
        const configFileName = path.basename(configService.getConfigFile());
        const tempFile = new EditFile(configFileName, '{\n  // Loading config...\n}');
        super(tempFile, 0, 0, 0, 0, windowService);
        
        // Override default anchors and width
        this.anchorTop = false;
        this.anchorBottom = false;
        this.anchorLeft = false;
        this.anchorRight = false;
        this.width = null;
        
        // Config file loading flag and status tracking
        this.configLoaded = false;
        this.lastKeyTime = 0;
        this.loadAttempts = 0;
        this.hasInsertEvent = false; // Track if insert event is already added
        
        // Display initial message
        this.redraw().then(() => {
            logger.info('SettingsWindow', 'Initial redraw complete, loading config file');
            // Load config file after initial render
            setTimeout(() => this._loadConfigFile(), 100);
        });
    }

    /**
     * Loads the configuration file
     * @private
     */
    async _loadConfigFile() {
        this.loadAttempts++;
        logger.info('SettingsWindow', `Load attempt #${this.loadAttempts}`);
        
        try {
            const configPath = configService.getConfigFile();
            logger.info('SettingsWindow', `Loading config file from: ${configPath}`);
            
            // Check if file exists
            try {
                await fs.access(configPath);
            } catch (err) {
                logger.warn('SettingsWindow', `Config file does not exist, creating default at: ${configPath}`);
                await configService.saveConfig();
            }
            
            // Read the file
            const configContent = await fs.readFile(configPath, 'utf8');
            
            if (!configContent || configContent.trim() === '') {
                logger.warn('SettingsWindow', 'Config file exists but is empty, creating default content');
                await configService.saveConfig();
                const newContent = await fs.readFile(configPath, 'utf8');
                logger.info('SettingsWindow', `Created default config, length: ${newContent.length}`);
                this.currentFile = new EditFile(configPath, newContent);
            } else {
                logger.info('SettingsWindow', `Config file loaded, content length: ${configContent.length}`);
                
                try {
                    // Check if content is valid JSON before assigning
                    JSON.parse(configContent);
                    this.currentFile = new EditFile(configPath, configContent);
                } catch (jsonErr) {
                    // If JSON is invalid, create a cleaned version
                    logger.warn('SettingsWindow', `Config file contains invalid JSON: ${jsonErr.message}, creating default`);
                    await configService.saveConfig();
                    const validContent = await fs.readFile(configPath, 'utf8');
                    this.currentFile = new EditFile(configPath, validContent);
                }
            }
            
            this.configLoaded = true;
            this.cursorX = 0;
            this.cursorY = 0;
            await this.redraw();
            logger.info('SettingsWindow', 'Config file loaded and window redrawn');
            
            // Notify user of the correct config path in the log
            logger.info('SettingsWindow', `Configuration stored at: ${configPath}`);
        } catch (error) {
            logger.error('SettingsWindow', `Error loading config file: ${error.message}`);
            
            if (this.loadAttempts < 3) {
                logger.info('SettingsWindow', `Retrying load in 500ms (attempt ${this.loadAttempts}/3)`);
                setTimeout(() => this._loadConfigFile(), 500);
                return;
            }
            
            // Create an empty file if loading fails after multiple attempts
            logger.warn('SettingsWindow', 'Creating empty config after failed load attempts');
            const configPath = configService.getConfigFile();
            const defaultConfig = JSON.stringify({
                theme: 'default',
                fontSize: 12,
                tabWidth: 4,
                editor: {
                    tabSize: 4,
                    indentSize: 4,
                    useTabs: false
                },
                aiProvider: 'openai',
                ollama: {
                    baseUrl: 'http://localhost:11434',
                    model: 'mistral'
                }
            }, null, 2);
            this.currentFile = new EditFile(configPath, defaultConfig);
            this.configLoaded = true;
            await this.redraw();
        }
    }
    
    /**
     * Handles a key press event for the window
     * @param {Object} key - The key event object from blessed
     * @override
     */
    async press(key) {
        // If config is not yet loaded, wait for it
        if (!this.configLoaded || !this.currentFile) {
            logger.info('SettingsWindow', 'Config file not loaded yet, ignoring key press');
            return;
        }
        
        // Prevent duplicate key presses by checking timing
        const now = Date.now();
        if (now - this.lastKeyTime < 150) { // Increased debounce to 150ms
            logger.debug('SettingsWindow', `Ignoring duplicate key press: ${key.full || key.sequence}`);
            return;
        }
        this.lastKeyTime = now;
        
        logger.debug('SettingsWindow', `Processing key press: ${key.full || key.sequence}`);
        
        // Add shortcut for saving config - Ctrl+S
        if (key && key.full === 'C-s') {
            await this._saveConfigAndNotify();
            return;
        }
        
        // Pass to parent implementation once config is loaded
        await super.press(key);
    }
    
    /**
     * Saves config and shows a notification
     * @private
     */
    async _saveConfigAndNotify() {
        try {
            // Parse the current content to validate
            const content = this.currentFile.getText();
            const configObj = JSON.parse(content);
            
            // Write to config file
            await fs.writeFile(this.currentFile.fileName, content, 'utf8');
            
            // Update the ConfigService with the new values
            for (const [key, value] of Object.entries(configObj)) {
                configService.config[key] = value;
            }
            
            logger.info('SettingsWindow', 'Configuration saved successfully');
            
            // Show message in the window status line (needs implementation)
            // For now, log the message
            logger.info('SettingsWindow', 'Configuration saved successfully');
            
            return true;
        } catch (error) {
            logger.error('SettingsWindow', `Error saving configuration: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Redraws the window content
     * @override
     */
    async redraw() {
        // If the current file is not loaded yet, display a loading message
        if (!this.configLoaded || !this.currentFile) {
            logger.info('SettingsWindow', 'Showing loading message while config loads');
            const element = this._getElement();
            
            if (this.windowService && element) {
                element.setContent('Loading settings...');
                this.windowService.screen.render();
            }
            return;
        }
        
        logger.debug('SettingsWindow', `Redrawing with loaded config file: ${this.currentFile.fileName}`);
        // Otherwise use the parent implementation
        await super.redraw();
    }

    /**
     * Creates the UI element for this window with a higher z-index
     * @param {Object} blessed - The blessed library object
     * @returns {Object} A blessed UI element for this window
     * @override
     */
    createUIElement(blessed) {
        const style = this.getStyle();
        
        return blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            tags: true,
            zIndex: 10, // Higher z-index for settings window
            ...style
        });
    }
}

module.exports = SettingsWindow; 