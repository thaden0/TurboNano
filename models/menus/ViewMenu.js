const Menu = require('../Menu');

class ViewMenu extends Menu {
    /**
     * @param {Object} windowService - The window service instance
     */
    constructor(windowService) {
        super('View', 'C-v');
        this.windowService = windowService;
        
        // Add menu items
        this.addItem('File Explorer', async () => await this._handleFileExplorer());
    }

    /**
     * Handles toggling the file explorer
     * @private
     */
    async _handleFileExplorer() {
        if (this.windowService) {
            this.windowService.createFileExplorer();
        }
    }
}

module.exports = ViewMenu; 