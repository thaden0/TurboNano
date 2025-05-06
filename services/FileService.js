const fs = require('fs').promises;
const path = require('path');
const EditFile = require('../models/EditFile');
const IndentationService = require('./IndentationService');

class FileService {
    constructor() {
        this.indentationService = new IndentationService();
    }

    /**
     * Reads a text file and returns its content
     * @param {string} fileName - Path to the file
     * @returns {Promise<EditFile>} - The file data wrapped in EditFile DTO
     */
    async getTextFile(fileName) {
        try {
            const filePath = path.resolve(process.cwd(), fileName);
            const content = await fs.readFile(filePath, 'utf8');
            // Split content into lines and expand tabs
            const lines = content.split('\n').map(line => {
                return this.indentationService.expandTabs(line);
            });
            return new EditFile(fileName, lines);
        } catch (error) {
            console.error('Error reading file:', error);
            return new EditFile(fileName, ['']);
        }
    }

    /**
     * Saves a text file
     * @param {EditFile} editFile - The file to save
     * @returns {Promise<void>}
     */
    async saveTextFile(editFile) {
        const filePath = path.resolve(process.cwd(), editFile.fileName);
        await fs.writeFile(filePath, editFile.fileData, 'utf8');
    }
}

module.exports = FileService;
