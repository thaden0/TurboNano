const Menu = require('../Menu');

class AIMenu extends Menu {
    /**
     * @param {Object} windowService - The window service instance
     */
    constructor(windowService) {
        super('AI', 'C-a');
        this.windowService = windowService;
        
        // Add menu items
        this.addItem('AI Prompt', async () => await this._handleAIPrompt());
    }

    /**
     * Handles activating the AI Prompt
     * @private
     */
    async _handleAIPrompt() {
        if (this.windowService) {
            this.windowService.createAIPrompt();
        }
    }
}

module.exports = AIMenu; 