const fs = require('fs').promises;
const path = require('path');
const EditFile = require('../models/EditFile');

class FileService {
    /**
     * Reads a text file and returns its content
     * @param {string} fileName - Path to the file
     * @returns {Promise<EditFile>} - The file data wrapped in EditFile DTO
     */
    async getTextFile(fileName) {
        try {
            const filePath = path.resolve(process.cwd(), fileName);
            const fileData = await fs.readFile(filePath, 'utf8');
            return new EditFile(fileName, fileData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Return new empty file if it doesn't exist
                return new EditFile(fileName, '');
            }
            throw error;
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
