const TYPES = {
    // Core Services
    WindowService: Symbol.for('WindowService'),
    MenuService: Symbol.for('MenuService'),
    FileService: Symbol.for('FileService'),
    LoggingService: Symbol.for('LoggingService'),
    ConfigService: Symbol.for('ConfigService'),
    NanorcService: Symbol.for('NanorcService'),
    IndentationService: Symbol.for('IndentationService'),
    AIService: Symbol.for('AIService'),

    // Controllers
    EventController: Symbol.for('EventController'),

    // Factories
    WindowFactory: Symbol.for('WindowFactory'),

    // Models
    EditWindow: Symbol.for('EditWindow'),
    EditFile: Symbol.for('EditFile'),
    Menu: Symbol.for('Menu'),
    FileMenu: Symbol.for('FileMenu'),
    ViewMenu: Symbol.for('ViewMenu'),
    AIMenu: Symbol.for('AIMenu'),

    // UI Components
    Screen: Symbol.for('Screen'),
    Background: Symbol.for('Background'),

    // Modals
    FileSelectModal: Symbol.for('FileSelectModal')
};

module.exports = TYPES; 