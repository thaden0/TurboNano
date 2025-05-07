const EditFile = require('./EditFile');

describe('EditFile', () => {
    describe('constructor', () => {
        it('should initialize with filename and empty array when no data provided', () => {
            const editFile = new EditFile('test.txt');
            
            expect(editFile.fileName).toBe('test.txt');
            expect(editFile.fileData).toEqual(['']);
        });
        
        it('should initialize with filename and array data', () => {
            const data = ['line1', 'line2', 'line3'];
            const editFile = new EditFile('test.txt', data);
            
            expect(editFile.fileName).toBe('test.txt');
            expect(editFile.fileData).toEqual(data);
        });
        
        it('should initialize with filename and convert string data to lines', () => {
            const strData = 'line1\nline2\nline3';
            const editFile = new EditFile('test.txt', strData);
            
            expect(editFile.fileName).toBe('test.txt');
            expect(editFile.fileData).toEqual(['line1', 'line2', 'line3']);
        });
    });
    
    describe('_ensureLineExists', () => {
        it('should add empty lines until the specified line exists', () => {
            const editFile = new EditFile('test.txt', ['line1']);
            
            // Call private method
            editFile._ensureLineExists(3);
            
            expect(editFile.fileData.length).toBe(4); // 0-indexed, so 4 lines total
            expect(editFile.fileData).toEqual(['line1', '', '', '']);
        });
        
        it('should not add lines if the specified line already exists', () => {
            const editFile = new EditFile('test.txt', ['line1', 'line2', 'line3']);
            
            editFile._ensureLineExists(2);
            
            expect(editFile.fileData.length).toBe(3);
            expect(editFile.fileData).toEqual(['line1', 'line2', 'line3']);
        });
    });
    
    describe('_ensureCharacterExists', () => {
        it('should add spaces until the specified character position exists', () => {
            const editFile = new EditFile('test.txt', ['abc']);
            
            editFile._ensureCharacterExists(5, 0);
            
            expect(editFile.fileData[0]).toBe('abc  ');
        });
        
        it('should create lines and add spaces when needed', () => {
            const editFile = new EditFile('test.txt', ['abc']);
            
            editFile._ensureCharacterExists(3, 2);
            
            expect(editFile.fileData).toEqual(['abc', '', '   ']);
        });
        
        it('should not add spaces if the character position already exists', () => {
            const editFile = new EditFile('test.txt', ['abcdef']);
            
            editFile._ensureCharacterExists(3, 0);
            
            expect(editFile.fileData[0]).toBe('abcdef');
        });
    });
    
    describe('writeText', () => {
        it('should insert text at specified position', () => {
            const editFile = new EditFile('test.txt', ['abcdef']);
            
            editFile.writeText('XYZ', 3, 0, true);
            
            expect(editFile.fileData[0]).toBe('abcXYZdef');
        });
        
        it('should overwrite text at specified position', () => {
            const editFile = new EditFile('test.txt', ['abcdef']);
            
            editFile.writeText('XYZ', 1, 0, false);
            
            expect(editFile.fileData[0]).toBe('aXYZef');
        });
        
        it('should create lines and spaces when inserting at non-existent positions', () => {
            const editFile = new EditFile('test.txt', ['abc']);
            
            editFile.writeText('XYZ', 2, 2, true);
            
            expect(editFile.fileData).toEqual(['abc', '', '  XYZ']);
        });
        
        it('should append text when inserting at the end of a line', () => {
            const editFile = new EditFile('test.txt', ['abc']);
            
            editFile.writeText('XYZ', 3, 0, true);
            
            expect(editFile.fileData[0]).toBe('abcXYZ');
        });
        
        it('should handle insertion at the beginning of a line', () => {
            const editFile = new EditFile('test.txt', ['abc']);
            
            editFile.writeText('XYZ', 0, 0, true);
            
            expect(editFile.fileData[0]).toBe('XYZabc');
        });
        
        it('should handle multiline text when overwriting', () => {
            const editFile = new EditFile('test.txt', ['abcdef', 'ghijkl']);
            
            editFile.writeText('XYZ', 2, 0, false);
            
            expect(editFile.fileData[0]).toBe('abXYZf');
            expect(editFile.fileData[1]).toBe('ghijkl');
        });
    });
}); 