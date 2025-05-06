class EditFile {
    /**
     * @param {string} fileName - The name of the file
     * @param {string|string[]} fileData - The content of the file, either as a string or array of lines
     */
    constructor(fileName, fileData) {
        this.fileName = fileName;
        // Convert string input to array of lines, or use empty array as default
        this.fileData = Array.isArray(fileData) ? fileData : 
                       (typeof fileData === 'string' ? fileData.split('\n') : ['']);
    }

    /**
     * Ensures the file has enough lines to write at the given y position
     * @param {number} y - The line number to ensure exists
     * @private
     */
    _ensureLineExists(y) {
        while (this.fileData.length <= y) {
            this.fileData.push('');
        }
    }

    /**
     * Ensures the line has enough characters to write at the given x position
     * @param {number} x - The character position to ensure exists
     * @param {number} y - The line number
     * @private
     */
    _ensureCharacterExists(x, y) {
        this._ensureLineExists(y);
        while (this.fileData[y].length < x) {
            this.fileData[y] += ' ';
        }
    }

    /**
     * Inserts or overwrites text at the specified position
     * @param {string} text - The text to insert
     * @param {number} x - The character position
     * @param {number} y - The line number
     * @param {boolean} insert - Whether to insert (true) or overwrite (false)
     */
    writeText(text, x, y, insert) {
        this._ensureCharacterExists(x, y);
        const line = this.fileData[y];
        if (insert) {
            this.fileData[y] = line.slice(0, x) + text + line.slice(x);
        } else {
            this.fileData[y] = line.slice(0, x) + text + line.slice(x + text.length);
        }
    }
}

module.exports = EditFile;
