const blessed = require('blessed');
const fs = require('fs');
const path = require('path');

class FileSelectModal {
    /**
     * Creates a new file selection modal
     * @param {blessed.screen} screen - The blessed screen instance
     * @param {Object} options - Modal options
     * @param {string} [options.startDir=process.cwd()] - Starting directory
     * @param {Function} options.onSelect - Callback when file is selected
     * @param {Function} options.onCancel - Callback when selection is cancelled
     */
    constructor(screen, options) {
        this.screen = screen;
        this.currentDir = options.startDir || process.cwd();
        this.onSelect = options.onSelect;
        this.onCancel = options.onCancel;

        // Create the modal box
        this.modal = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: '80%',
            height: '80%',
            border: 'line',
            shadow: true,
            style: {
                border: {
                    fg: 'yellow'
                }
            }
        });

        // Create the file list
        this.list = blessed.list({
            parent: this.modal,
            label: ` {bold}${this.currentDir}{/bold} `,
            tags: true,
            top: 0,
            left: 0,
            width: '100%',
            height: '100%-4', // Leave space for textbox and buttons
            keys: true,
            mouse: true,
            border: 'line',
            style: {
                selected: { bg: 'blue' },
                item: { fg: 'white' },
                border: { fg: 'yellow' }
            },
            scrollbar: {
                ch: ' ',
                inverse: true
            }
        });

        // Create file path textbox
        this.pathBox = blessed.textbox({
            parent: this.modal,
            bottom: 2,
            left: 0,
            width: '100%',
            height: 1,
            inputOnFocus: true,
            keys: true,
            mouse: true,
            style: {
                fg: 'white',
                bg: 'blue',
                focus: {
                    bg: 'dark-blue'
                }
            }
        });

        // Create buttons
        this.okButton = blessed.button({
            parent: this.modal,
            bottom: 0,
            left: '30%',
            width: '20%',
            height: 1,
            content: 'OK',
            mouse: true,
            style: {
                bg: 'green',
                focus: {
                    bg: 'dark-green'
                },
                hover: {
                    bg: 'dark-green'
                }
            }
        });

        this.cancelButton = blessed.button({
            parent: this.modal,
            bottom: 0,
            left: '55%',
            width: '20%',
            height: 1,
            content: 'Cancel',
            mouse: true,
            style: {
                bg: 'red',
                focus: {
                    bg: 'dark-red'
                },
                hover: {
                    bg: 'dark-red'
                }
            }
        });

        // Set up event handlers
        this.list.on('select', (item) => this._handleSelect(item));
        
        // Add multiple event types for button interaction
        this.okButton.on('press', () => this._handleButtonSelect());
        this.okButton.on('click', () => this._handleButtonSelect());

        this.cancelButton.on('press', () => this._handleCancel());
        this.cancelButton.on('click', () => this._handleCancel());

        // Handle keyboard shortcuts
        this.modal.key(['escape'], () => this._handleCancel());
        this.modal.key(['enter'], () => {
            if (this.pathBox.focused) {
                this._handlePathSubmit();
            } else {
                this._handleButtonSelect();
            }
        });

        // Update path box when list selection changes
        this.list.on('select', () => this._updatePathFromSelection());

        // Initial update
        this._updateList(this.currentDir);
        this.list.focus();
    }

    /**
     * Updates the file list with contents of the specified directory
     * @param {string} dir - Directory to list
     * @private
     */
    _updateList(dir) {
        try {
            this.currentDir = dir;
            const entries = fs.readdirSync(dir).map(f => {
                const full = path.join(dir, f);
                const isDir = fs.statSync(full).isDirectory();
                return isDir ? f + '/' : f;
            });
            this.list.setItems(['../', ...entries]);
            this.list.setLabel(` {bold}${this.currentDir}{/bold} `);
            this.list.select(0);
            this._updatePathFromSelection();
            this.screen.render();
        } catch (error) {
            console.error('Error reading directory:', error);
        }
    }

    /**
     * Updates the path textbox based on current selection
     * @private
     */
    _updatePathFromSelection() {
        const selected = this.list.getItem(this.list.selected);
        if (!selected) return;

        const name = selected.getText().trim();
        const fullPath = path.resolve(this.currentDir, name);
        this.pathBox.setValue(fullPath);
        this.screen.render();
    }

    /**
     * Handles selection of an item in the list
     * @param {Object} item - The selected item
     * @private
     */
    _handleSelect(item) {
        const name = item.getText().trim();
        const next = path.resolve(this.currentDir, name);
        if (name.endsWith('/')) {
            this._updateList(next);
        }
    }

    /**
     * Handles path textbox submission
     * @private
     */
    _handlePathSubmit() {
        const inputPath = this.pathBox.getValue().trim();
        try {
            const stats = fs.statSync(inputPath);
            if (stats.isDirectory()) {
                this._updateList(inputPath);
            } else {
                this._completeSelection(inputPath);
            }
        } catch (error) {
            // If parent directory exists, treat as new file path
            const parentDir = path.dirname(inputPath);
            try {
                if (fs.statSync(parentDir).isDirectory()) {
                    this._completeSelection(inputPath);
                }
            } catch (error) {
                console.error('Invalid path:', error);
            }
        }
    }

    /**
     * Handles pressing of the OK button
     * @private
     */
    _handleButtonSelect() {
        const selected = this.list.getItem(this.list.selected);
        if (!selected) return;

        const name = selected.getText().trim();
        const fullPath = path.resolve(this.currentDir, name);

        if (name === '../') {
            this._updateList(fullPath);
        } else {
            try {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    this._updateList(fullPath);
                } else {
                    this._completeSelection(fullPath);
                }
            } catch (error) {
                // If path doesn't exist, treat it as a new file
                this._completeSelection(fullPath);
            }
        }
    }

    /**
     * Completes the selection process
     * @param {string} fullPath - The selected file path
     * @private
     */
    _completeSelection(fullPath) {
        this.modal.destroy();
        if (this.onSelect) {
            this.onSelect(fullPath);
        }
    }

    /**
     * Handles cancellation of the modal
     * @private
     */
    _handleCancel() {
        this.modal.destroy();
        if (this.onCancel) {
            this.onCancel();
        }
    }

    /**
     * Shows the modal
     */
    show() {
        this.modal.show();
        this.list.focus();
        this.screen.render();
    }
}

module.exports = FileSelectModal; 