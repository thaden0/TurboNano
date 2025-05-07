const configService = require('./ConfigService');

class IndentationService {
    constructor() {
        // Use the singleton configService directly
        this.configService = configService;
    }

    /**
     * Given the current cursor column (0-based), return
     * either a string of '\t' or the exact number of spaces
     * needed to reach the next indent stop.
     * @param {number} column - Current cursor column (0-based)
     * @returns {string} The indentation string
     */
    getIndentation(column) {
        const useTabs = this.configService.get('editor.useTabs', false);
        
        if (useTabs) {
            return '\t';
        } else {
            const indentSize = this.configService.get('editor.indentSize', 4);
            // Calculate next indent stop
            const nextStop = Math.ceil((column + 1) / indentSize) * indentSize;
            const spacesNeeded = nextStop - column;
            return ' '.repeat(spacesNeeded);
        }
    }

    /**
     * Convert tab characters to the appropriate number of spaces
     * @param {string} text - Text containing tabs
     * @param {number} startColumn - Starting column for the first tab
     * @returns {string} Text with tabs converted to spaces
     */
    expandTabs(text, startColumn = 0) {
        const tabSize = this.configService.get('editor.tabSize', 4);
        let result = '';
        let currentColumn = startColumn;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\t') {
                const spacesNeeded = tabSize - (currentColumn % tabSize);
                result += ' '.repeat(spacesNeeded);
                currentColumn += spacesNeeded;
            } else {
                result += text[i];
                currentColumn++;
            }
        }

        return result;
    }
}

module.exports = IndentationService; 