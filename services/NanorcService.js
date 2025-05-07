const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./LoggingService');

class NanorcService {
    constructor() {
        /** @private */
        this.nanorcDir = path.join(os.homedir(), '.turbollama', 'nanorc');
        /** @private */
        this.loadedRules = new Map(); // filename pattern -> rules
        /** @private */
        this.cachedPatterns = new Map(); // filename -> compiled rules
        /** @private */
        this.ruleSourceFiles = new Map(); // pattern -> source .nanorc file
        /** @private */
        this.initialized = false;

        logger.info('NanorcService', `Initialized with nanorc directory: ${this.nanorcDir}`);
        // Start loading rules immediately
        this._loadAllRules().catch(error => {
            logger.error('NanorcService', 'Error loading initial rules:', error);
        });
    }

    /**
     * Applies syntax highlighting to a line of text based on nanorc rules
     * @param {string} line - The line to style
     * @param {string} filename - The filename to match against nanorc patterns
     * @returns {string} The line with blessed color markup applied
     */
    async style(line, filename) {
        try {
            logger.debug('NanorcService', `Styling line for ${filename}: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
            
            // Ensure rules are loaded
            if (!this.initialized) {
                logger.debug('NanorcService', 'Rules not initialized, loading all rules...');
                try {
                    await this._loadAllRules();
                } catch (error) {
                    logger.error('NanorcService', 'Error loading rules:', error);
                    return line;
                }
            }

            // If we haven't loaded rules for this file type yet, try to load them
            if (!this.cachedPatterns.has(filename)) {
                logger.debug('NanorcService', `No cached patterns for ${filename}, loading rules...`);
                try {
                    await this._loadRulesForFile(filename);
                } catch (error) {
                    logger.error('NanorcService', 'Error loading rules for file:', error);
                    return line;
                }
            }

            // If no rules match this file, return the line as-is
            const patterns = this.cachedPatterns.get(filename);
            if (!patterns) {
                logger.debug('NanorcService', `No patterns found for ${filename}, returning original line`);
                return line;
            }

            // Log which nanorc file is being used
            for (const [pattern, _] of this.loadedRules.entries()) {
                if (this._matchesFilePattern(filename, pattern)) {
                    const sourceFile = this.ruleSourceFiles.get(pattern);
                    logger.debug('NanorcService', `Using rules from ${sourceFile} for ${filename}`);
                    logger.debug('NanorcService', `Number of patterns to apply: ${patterns.length}`);
                    
                    // Log each pattern for debugging
                    patterns.forEach(([regex, color], index) => {
                        logger.debug('NanorcService', `Pattern ${index + 1}: color=${color}, regex=${regex}`);
                    });
                    
                    break;
                }
            }

            // Apply each pattern to the line
            let styledLine = line;
            let matches = [];

            // First, find all matches for all patterns
            for (const [regex, originalColor] of patterns) {
                try {
                    // Map problematic bright colors to compatible alternatives
                    const color = this._mapColorToCompatible(originalColor);
                    
                    let match;
                    const safeRegex = typeof regex === 'string' ? new RegExp(regex, 'g') : regex;
                    logger.debug('NanorcService', `Testing pattern: ${safeRegex} with color ${color}`);
                    
                    while ((match = safeRegex.exec(line)) !== null) {
                        // Don't add zero-length matches
                        if (match[0].length === 0) {
                            logger.debug('NanorcService', `Skipping zero-length match at position ${match.index}`);
                            continue;
                        }
                        
                        logger.debug('NanorcService', `Found match: "${match[0]}" at position ${match.index}-${match.index + match[0].length}`);
                        
                        matches.push({
                            start: match.index,
                            end: match.index + match[0].length,
                            text: match[0],
                            color: color
                        });
                        
                        // Prevent infinite loops for zero-length matches (like /^/ or /$/)
                        if (safeRegex.lastIndex === match.index) {
                            safeRegex.lastIndex++;
                        }
                    }
                    
                    // Reset regex lastIndex
                    safeRegex.lastIndex = 0;
                } catch (error) {
                    logger.error('NanorcService', `Error applying pattern: ${regex}`, error);
                    continue;
                }
            }

            // Handle the case when we have no matches
            if (matches.length === 0) {
                logger.debug('NanorcService', `No matches found for line: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
                return line;
            }

            logger.debug('NanorcService', `Total matches found: ${matches.length}`);

            // Sort matches by start position, then by length (longer matches first)
            matches.sort((a, b) => {
                if (a.start !== b.start) return a.start - b.start;
                return (b.end - b.start) - (a.end - a.start);
            });

            // Detect and resolve overlapping matches
            const nonOverlappingMatches = [];
            const usedRanges = [];

            for (const match of matches) {
                let overlaps = false;
                
                // Check if this match overlaps with any existing non-overlapping match
                for (const range of usedRanges) {
                    if (match.start < range.end && match.end > range.start) {
                        overlaps = true;
                        logger.debug('NanorcService', `Skipping overlapping match: "${match.text}" (${match.color}) with existing match at ${range.start}-${range.end}`);
                        break;
                    }
                }
                
                if (!overlaps) {
                    nonOverlappingMatches.push(match);
                    usedRanges.push({
                        start: match.start,
                        end: match.end
                    });
                }
            }
            
            logger.debug('NanorcService', `Found ${matches.length} total matches, using ${nonOverlappingMatches.length} non-overlapping matches`);

            // Apply matches from end to start to avoid position shifting
            nonOverlappingMatches.sort((a, b) => b.start - a.start);
            
            nonOverlappingMatches.forEach(match => {
                const before = styledLine.substring(0, match.start);
                const after = styledLine.substring(match.end);
                const colored = `{${match.color}-fg}${match.text}{/${match.color}-fg}`;
                styledLine = before + colored + after;
                logger.debug('NanorcService', `Applied color ${match.color} to "${match.text}"`);
            });

            logger.debug('NanorcService', `Final styled line: "${styledLine.substring(0, 50)}${styledLine.length > 50 ? '...' : ''}"`);
            return styledLine;
        } catch (error) {
            logger.error('NanorcService', 'Error applying syntax highlighting:', error);
            return line;
        }
    }

    /**
     * @private
     * Loads and caches syntax rules for a given filename
     * @param {string} filename - The filename to load rules for
     */
    async _loadRulesForFile(filename) {
        try {
            // If we haven't loaded any rules yet, load them all
            if (!this.initialized) {
                logger.info('NanorcService', 'Loading all nanorc files...');
                await this._loadAllRules();
                logger.info('NanorcService', `Loaded ${this.loadedRules.size} syntax definitions`);
            }

            // Find the first matching ruleset for this filename
            let matched = false;
            
            for (const [pattern, rules] of this.loadedRules.entries()) {
                if (this._matchesFilePattern(filename, pattern)) {
                    logger.debug('NanorcService', `Found matching pattern "${pattern}" for ${filename}`);
                    matched = true;
                    
                    // Convert the rules into regex patterns with their colors
                    const patterns = [];
                    
                    for (const [regex, color] of rules) {
                        try {
                            patterns.push([new RegExp(regex, 'g'), color]);
                            logger.debug('NanorcService', `Added pattern: ${color} - ${regex}`);
                        } catch (error) {
                            logger.error('NanorcService', `Invalid regex pattern: ${regex}`, error);
                        }
                    }

                    if (patterns.length > 0) {
                        this.cachedPatterns.set(filename, patterns);
                        logger.debug('NanorcService', `Cached ${patterns.length} patterns for ${filename}`);
                        return;
                    }
                }
            }

            // If no explicit match found, try fallback techniques
            if (!matched) {
                // Check filename extension for common types
                const ext = path.extname(filename).toLowerCase();
                if (ext === '.js' || ext === '.jsx') {
                    logger.debug('NanorcService', `No direct match found but detected JavaScript file by extension: ${filename}`);
                    
                    // If we have JavaScript rules under any pattern, use them
                    for (const [pattern, rules] of this.loadedRules.entries()) {
                        if (pattern.includes('.js') || pattern.includes('JavaScript')) {
                            logger.debug('NanorcService', `Using JavaScript rules from pattern "${pattern}"`);
                            
                            // Convert the rules into regex patterns with their colors
                            const patterns = [];
                            for (const [regex, color] of rules) {
                                try {
                                    patterns.push([new RegExp(regex, 'g'), color]);
                                } catch (error) {
                                    logger.error('NanorcService', `Invalid regex pattern: ${regex}`, error);
                                }
                            }
                            
                            if (patterns.length > 0) {
                                this.cachedPatterns.set(filename, patterns);
                                logger.debug('NanorcService', `Cached ${patterns.length} patterns for ${filename} via extension match`);
                                return;
                            }
                        }
                    }
                    
                    // If we still don't have patterns, use default rules
                    logger.debug('NanorcService', `Using default JavaScript rules for ${filename}`);
                    this._addDefaultJavaScriptRules();
                    
                    // Try matching again with newly added default rules
                    await this._loadRulesForFile(filename);
                    return;
                }
            }

            logger.warn('NanorcService', `No matching syntax found for ${filename}`);
            // If no rules match, cache that fact so we don't try again
            this.cachedPatterns.set(filename, null);
        } catch (error) {
            logger.error('NanorcService', 'Error loading nanorc rules:', error);
            this.cachedPatterns.set(filename, null);
            throw error; // Propagate error to caller
        }
    }

    /**
     * @private
     * Loads all nanorc files from the config directory
     */
    async _loadAllRules() {
        if (this.initialized) return;

        try {
            // Create the nanorc directory if it doesn't exist
            await fs.mkdir(this.nanorcDir, { recursive: true });

            // Read all .nanorc files
            const files = await fs.readdir(this.nanorcDir);
            logger.debug('NanorcService', `Found ${files.filter(f => f.endsWith('.nanorc')).length} .nanorc files in ${this.nanorcDir}`);
            
            for (const file of files) {
                if (file.endsWith('.nanorc')) {
                    logger.debug('NanorcService', `Loading ${file}...`);
                    const content = await fs.readFile(path.join(this.nanorcDir, file), 'utf8');
                    this._parseNanorc(content, file);
                }
            }

            // Log all loaded patterns
            logger.debug('NanorcService', 'All loaded patterns:');
            for (const [pattern, rules] of this.loadedRules.entries()) {
                logger.debug('NanorcService', `  Pattern: "${pattern}" from ${this.ruleSourceFiles.get(pattern)} with ${rules.length} rules`);
            }

            this.initialized = true;
        } catch (error) {
            logger.error('NanorcService', 'Error loading nanorc files:', error);
            throw error;
        }
    }

    /**
     * @private
     * Parses a nanorc file content and adds its rules to loadedRules
     * @param {string} content - The content of the nanorc file
     * @param {string} sourceFile - The source .nanorc file name
     */
    _parseNanorc(content, sourceFile) {
        const lines = content.split('\n');
        let currentFilePattern = null;
        let currentRules = [];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('syntax')) {
                // If we were processing a previous syntax, save it
                if (currentFilePattern) {
                    logger.debug('NanorcService', `Saving rules for pattern "${currentFilePattern}" from ${sourceFile}`);
                    this.loadedRules.set(currentFilePattern, currentRules);
                    this.ruleSourceFiles.set(currentFilePattern, sourceFile);
                }

                // Start new syntax section
                const match = line.match(/syntax\s+"([^"]+)"\s+"([^"]+)"/);
                if (match) {
                    currentFilePattern = match[2];
                    logger.debug('NanorcService', `Found syntax in ${sourceFile}: name="${match[1]}" pattern="${currentFilePattern}"`);
                    currentRules = [];
                }
            } else if (line.startsWith('color')) {
                // Parse color rule
                const match = line.match(/color\s+(\w+)\s+"([^"]+)"/);
                if (match && currentFilePattern) {
                    const [_, color, regex] = match;
                    // Convert the nanorc regex to JavaScript regex
                    const jsRegex = this._convertNanorcRegex(regex);
                    
                    // Only add rules that were successfully converted
                    if (jsRegex) {
                    currentRules.push([jsRegex, color]);
                        logger.debug('NanorcService', `Added rule ${color}: "${jsRegex}" from original "${regex}"`);
                    }
                }
            }
        }

        // Save the last syntax if there was one
        if (currentFilePattern) {
            logger.debug('NanorcService', `Saving final rules for pattern "${currentFilePattern}" from ${sourceFile}`);
            this.loadedRules.set(currentFilePattern, currentRules);
            this.ruleSourceFiles.set(currentFilePattern, sourceFile);
        }
        
        // Ensure we have rules for common file types if none were found
        if (!this.loadedRules.has('\\.js$') && !this.loadedRules.has('\\.(js|jsx)$')) {
            logger.debug('NanorcService', 'No JavaScript rules found, adding defaults');
            this._addDefaultJavaScriptRules();
        }
    }

    /**
     * @private
     * Adds default JavaScript syntax highlighting rules if none were loaded from nanorc files
     */
    _addDefaultJavaScriptRules() {
        const defaultRules = [
            // Keywords
            ['\\b(const|let|var|function|class|extends|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|delete|typeof|instanceof|void|this|super)\\b', 'yellow'],
            
            // Built-in objects and functions
            ['\\b(Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|RegExp|String|Promise|Map|Set|Symbol|console|window|document|null|undefined|NaN|Infinity)\\b', 'cyan'],
            
            // Booleans
            ['\\b(true|false)\\b', 'brightcyan'],
            
            // Strings
            ['"[^"]*"', 'green'],
            ["'[^']*'", 'green'],
            ['`[^`]*`', 'green'],
            
            // Numbers
            ['\\b[0-9]+\\b', 'magenta'],
            ['\\b[0-9]+\\.[0-9]+\\b', 'magenta'],
            ['\\b0x[0-9a-fA-F]+\\b', 'magenta'],
            
            // Comments
            ['//.*$', 'blue'],
            ['/\\*[\\s\\S]*?\\*/', 'blue'],
            
            // Punctuation
            ['[;:,.<>/\\(\\)\\[\\]\\{\\}=\\+\\-\\*/%&\\|\\^!~?]', 'red'],
            
            // Properties
            ['\\.[A-Za-z][A-Za-z0-9_]*', 'brightwhite'],
            
            // Variables and identifiers (lower priority than keywords)
            ['\\b[A-Za-z_][A-Za-z0-9_]*\\b', 'white']
        ];
        
        this.loadedRules.set('\\.(js|jsx)$', defaultRules);
        this.ruleSourceFiles.set('\\.(js|jsx)$', 'default-rules');
        logger.info('NanorcService', 'Added default JavaScript syntax rules');
    }

    /**
     * @private
     * Converts a nanorc regex to a JavaScript regex
     * @param {string} pattern - The nanorc regex pattern
     * @returns {string} The JavaScript regex pattern
     */
    _convertNanorcRegex(pattern) {
        try {
            logger.debug('NanorcService', `Converting nanorc regex pattern: "${pattern}"`);
            
            // Special handling for strings - these are common patterns in syntax files
            if (pattern.includes('"[^"]*"')) {
                logger.debug('NanorcService', `Using predefined pattern for double-quoted strings`);
                return '"[^"]*"';
            }
            if (pattern.includes("'[^']*'")) {
                logger.debug('NanorcService', `Using predefined pattern for single-quoted strings`);
                return "'[^']*'";
            }
            if (pattern.includes('`[^`]*`')) {
                logger.debug('NanorcService', `Using predefined pattern for backtick strings`);
                return '`[^`]*`';
            }
            
            // Handle string pattern with escapes
            if (pattern.includes('\\"[^\\"]*\\"')) {
                logger.debug('NanorcService', `Using predefined pattern for escaped double-quoted strings`);
                return '"[^"]*"';
            }
            if (pattern.includes("\\'[^\\']*\\'")) {
                logger.debug('NanorcService', `Using predefined pattern for escaped single-quoted strings`);
                return "'[^']*'";
            }
            
            // Handle nanorc-specific character classes
            let jsPattern = pattern
                .replace(/\[\[:space:\]\]/g, '\\s')    // Replace [:space:] with \s
                .replace(/\[\[:alpha:\]\]/g, '[A-Za-z]') // Replace [:alpha:] with [A-Za-z]
                .replace(/\[\[:alnum:\]\]/g, '[A-Za-z0-9]') // Replace [:alnum:] with [A-Za-z0-9]
                .replace(/\[\[:digit:\]\]/g, '\\d');  // Replace [:digit:] with \d
            
            // First, handle special regex syntax
            jsPattern = jsPattern
                .replace(/\\</g, '\\b')    // Start of word
                .replace(/\\>/g, '\\b')    // End of word
                .replace(/\\b/g, '\\b')    // Word boundary
                .replace(/\\s/g, '\\s')    // Whitespace
                .replace(/\\w/g, '\\w')    // Word character
                .replace(/\\d/g, '\\d');   // Digit

            // Fix problematic nanorc patterns
            jsPattern = jsPattern
                .replace(/\.\*\+/g, '.*')  // Fix .*+ (which is invalid in JS regex) with .*
                .replace(/\\\s*$/g, '')    // Remove trailing backslash (common error in nanorc files)
                .replace(/\|(\s*\))/g, '$1'); // Fix patterns ending with |)
                
            // Add special handling for regular symbol coloring that might be missing
            if (/^\[.*\]$/.test(pattern)) {
                logger.debug('NanorcService', `Adding special handling for character class pattern: ${pattern}`);
            }
            
            // Add special handling for operators and symbols
            if (/^[;\{\}\[\]\(\)=:,.<>+\-*\/%&|^!~?]+$/.test(pattern)) {
                logger.debug('NanorcService', `Adding special handling for symbols pattern: ${pattern}`);
                return pattern.replace(/([(){}\[\].+*?^$\\])/g, '\\$1');
            }

            // Then handle escaped characters that should remain escaped
            jsPattern = jsPattern
                .replace(/\\\\/g, '\\\\')  // Literal backslash (must come first)
                .replace(/\\"/g, '\\"')    // Literal quote
                .replace(/\\'/g, "\\'")    // Literal single quote
                .replace(/\\\{/g, '\\{')   // Literal {
                .replace(/\\\}/g, '\\}')   // Literal }
                .replace(/\\\[/g, '\\[')   // Literal [
                .replace(/\\\]/g, '\\]')   // Literal ]
                .replace(/\\\(/g, '\\(')   // Literal (
                .replace(/\\\)/g, '\\)')   // Literal )
                .replace(/\\\+/g, '\\+')   // Literal +
                .replace(/\\\*/g, '\\*')   // Literal *
                .replace(/\\\?/g, '\\?')   // Literal ?
                .replace(/\\\./g, '\\.')   // Literal .
                .replace(/\\\^/g, '\\^')   // Literal ^
                .replace(/\\\$/g, '\\$')   // Literal $
                .replace(/\\\|/g, '\\|');  // Literal |

            // Final clean-up to handle any remaining issues
            if (jsPattern.endsWith('\\')) {
                jsPattern = jsPattern.substring(0, jsPattern.length - 1);
            }
            
            // Verify the pattern is valid
            try {
            new RegExp(jsPattern);
                logger.debug('NanorcService', `Successfully converted to JS regex: "${jsPattern}"`);
            return jsPattern;
            } catch (error) {
                // If still invalid, try a simpler cleanup approach
                logger.debug('NanorcService', `Regex validation failed for "${jsPattern}", trying simpler approach`);
                
                // Simplify the pattern by removing complex constructs
                const simplifiedPattern = pattern
                    .replace(/\[\[:(\w+):\]\]/g, '')  // Remove POSIX character classes
                    .replace(/\\\W/g, '')            // Remove escaped non-word chars
                    .replace(/\|.*$/g, '');          // Remove anything after a pipe
                
                // If the pattern is now empty, use a simple word boundary pattern
                if (!simplifiedPattern.trim()) {
                    logger.debug('NanorcService', `Simplified pattern is empty, using default word pattern`);
                    return '\\b\\w+\\b';
                }
                
                try {
                    new RegExp(simplifiedPattern);
                    logger.debug('NanorcService', `Using simplified pattern: "${simplifiedPattern}"`);
                    return simplifiedPattern;
                } catch (innerError) {
                    // If still invalid, return a safe default pattern
                    logger.warn('NanorcService', `Fallback regex also invalid for "${pattern}", using default word pattern`);
                    return '\\b\\w+\\b';
                }
            }
        } catch (error) {
            logger.error('NanorcService', `Invalid regex pattern: ${pattern}`, error);
            return '\\b\\w+\\b'; // Return a safe default pattern
        }
    }

    /**
     * @private
     * Checks if a filename matches a nanorc file pattern
     * @param {string} filename - The filename to check
     * @param {string} pattern - The nanorc pattern to match against
     * @returns {boolean} Whether the filename matches the pattern
     */
    _matchesFilePattern(filename, pattern) {
        try {
        // Only match against the basename of the file, not the full path
        const basename = path.basename(filename);
        
            logger.debug('NanorcService', `Checking if file ${basename} matches pattern ${pattern}`);
            
            // Special case handling for common patterns
            if (pattern === '\\.(js|jsx)$' && (basename.endsWith('.js') || basename.endsWith('.jsx'))) {
                logger.debug('NanorcService', `Direct match for JavaScript pattern: ${basename}`);
                return true;
            }
            
            if (pattern === '\\.(ts)$' && basename.endsWith('.ts')) {
                logger.debug('NanorcService', `Direct match for TypeScript pattern: ${basename}`);
                return true;
            }
            
            // Try to convert nanorc pattern to JavaScript regex pattern
            try {
                let regexPattern = pattern
                    // Escape regex special characters in the pattern text itself
                    .replace(/[\[\]{}()*+?.,\\^$|#]/g, '\\$&')
                    // Then handle specific nanorc escapes
                    .replace(/\\\\\./g, '\\.') // Escape dots
                    .replace(/\\\\\*/g, '.*')  // Convert * to .*
                    .replace(/\\\\\?/g, '.')   // Convert ? to .
                    .replace(/\\\\\[/g, '[')   // Convert \[ to [
                    .replace(/\\\\\]/g, ']')   // Convert \] to ]
                    .replace(/\\\\\(/g, '(')   // Convert \( to (
                    .replace(/\\\\\)/g, ')')   // Convert \) to )
                    .replace(/\\\\\{/g, '{')   // Convert \{ to {
                    .replace(/\\\\\}/g, '}')   // Convert \} to }
                    .replace(/\\\\\+/g, '+')   // Convert \+ to +
                    .replace(/\\\\\|/g, '|')   // Convert \| to |
                    .replace(/\\\\\^/g, '^')   // Convert \^ to ^
                    .replace(/\\\\\$/g, '$');  // Convert \$ to $
            
                // Special case for .js|.jsx pattern
                if (regexPattern.includes('\\.js') && basename.endsWith('.js')) {
                    logger.debug('NanorcService', `Special case match for .js extension: ${basename}`);
                    return true;
                }
                
                // Try to create and test the regex
                try {
        const regex = new RegExp(regexPattern);
        const matches = regex.test(basename);
        
        logger.debug('NanorcService', `Pattern matching:
            File: ${basename}
            Pattern: ${pattern}
            Regex: ${regexPattern}
            Matches: ${matches}`);
        
        return matches;
                } catch (regexError) {
                    logger.error('NanorcService', `Invalid regex pattern: ${regexPattern}`, regexError);
                    
                    // Fallback to string-based matching for common cases
                    if (pattern.includes('.js') && basename.endsWith('.js')) {
                        logger.debug('NanorcService', `Fallback match for .js extension: ${basename}`);
                        return true;
                    }
                    
                    return false;
                }
            } catch (conversionError) {
                logger.error('NanorcService', `Error converting pattern: ${pattern}`, conversionError);
                return false;
            }
        } catch (error) {
            logger.error('NanorcService', `Error in _matchesFilePattern: ${error.message}`, error);
            return false;
        }
    }

    /**
     * @private
     * Maps colors to compatible alternatives for terminals that don't support certain colors
     * @param {string} color - The original color name
     * @returns {string} A compatible color name
     */
    _mapColorToCompatible(color) {
        const colorMap = {
            // Map problematic "bright" colors to standard alternatives
            'brightwhite': 'white',
            'brightcyan': 'cyan',
            'brightblue': 'blue',
            'brightred': 'red',
            'brightgreen': 'green',
            'brightyellow': 'yellow',
            'brightmagenta': 'magenta',
            'brightblack': 'black',
        };
        
        return colorMap[color] || color;
    }
}

module.exports = NanorcService; 