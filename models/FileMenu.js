const Menu = require('./Menu');
const KeyEvent = require('./KeyEvent');

class FileMenu extends Menu {
    /**
     * @param {EventController} eventController - The event controller instance
     */
    constructor(eventController) {
        super();
        this.name = 'File Menu';

        // Add standard file menu items
        this.addEvent(
            new KeyEvent('n', () => {
                // TODO: Implement new file functionality
                eventController.windowService.getCurrentWindow().currentFile.fileData = [''];
                eventController.windowService.getCurrentWindow().redraw();
            }),
            'New File'
        );
        
        this.addEvent(
            new KeyEvent('o', () => eventController._handleOpen()),
            'Open File'
        );
        
        this.addEvent(
            new KeyEvent('s', () => eventController._handleSave()),
            'Save File'
        );
        
        this.addEvent(
            new KeyEvent('q', () => process.exit(0)),
            'Exit'
        );
    }
}

module.exports = FileMenu; 