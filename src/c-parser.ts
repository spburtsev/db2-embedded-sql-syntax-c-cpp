/**
 * C parser for identifying function boundaries without heavy regex use
 */
import { FunctionScope } from './c-scopes';

// Parser states
enum ParserState {
    DEFAULT,
    IN_COMMENT_SINGLE,
    IN_COMMENT_MULTI,
    IN_STRING,
    IN_CHAR,
    IN_PREPROCESSOR,
    IN_FUNCTION_DECL
}

// C function types that can appear at the beginning of a function declaration
const C_FUNCTION_TYPES = [
    'void', 'int', 'char', 'float', 'double', 'long', 'short',
    'unsigned', 'signed', 'struct', 'enum', 'static', 'inline', 
    'extern', 'auto', 'register', 'const', 'volatile'
];

/**
 * Generator function that performs a single-pass parse to yield function scopes
 * without using complex regexes
 * 
 * @param text The full text of the C file
 * @yields FunctionScope objects one at a time
 */
export function* cFunctionScopeGenerator(text: string): Generator<FunctionScope> {
    const len = text.length;
    let pos = 0;
    let state = ParserState.DEFAULT;
    let braceDepth = 0;
    let lastIdentifier = '';
    let lastTypeMatch = '';
    let potentialFuncStart = -1;
    let potentialFuncName = '';
    let functionBodyStart = -1;
    let inParentheses = 0;
    let lastToken = '';
    let tokenStart = 0;
    let isInFunction = false;
    let skipWhitespace = false;
    
    function isAlpha(ch: string): boolean {
        return /[a-zA-Z_]/.test(ch);
    }
    
    function isAlphaNumeric(ch: string): boolean {
        return /[a-zA-Z0-9_]/.test(ch);
    }
    
    function isWhitespace(ch: string): boolean {
        return /\s/.test(ch);
    }
    
    function isTypeIdentifier(token: string): boolean {
        return C_FUNCTION_TYPES.includes(token);
    }
    
    // Helper to collect a complete identifier
    function collectIdentifier(): string {
        const start = pos;
        while (pos < len && isAlphaNumeric(text[pos])) {
            pos++;
        }
        return text.substring(start, pos);
    }
    
    // Helper to skip to the matching closing parenthesis
    function skipToClosingParenthesis(): boolean {
        let parenDepth = 1;
        while (pos < len) {
            const ch = text[pos];
            if (ch === '(') {
                parenDepth++;
            } else if (ch === ')') {
                parenDepth--;
                if (parenDepth === 0) {
                    pos++; // Move past the closing parenthesis
                    return true;
                }
            } else if (ch === '"') {
                pos++; // Skip the opening quote
                while (pos < len && text[pos] !== '"') {
                    if (text[pos] === '\\' && pos + 1 < len) {
                        pos += 2; // Skip escape sequence
                    } else {
                        pos++;
                    }
                }
                if (pos < len) pos++; // Skip the closing quote
            } else if (ch === '\'') {
                pos++; // Skip the opening quote
                while (pos < len && text[pos] !== '\'') {
                    if (text[pos] === '\\' && pos + 1 < len) {
                        pos += 2; // Skip escape sequence
                    } else {
                        pos++;
                    }
                }
                if (pos < len) pos++; // Skip the closing quote
            } else if (ch === '/' && pos + 1 < len) {
                if (text[pos + 1] === '/') {
                    // Skip single-line comment
                    pos += 2;
                    while (pos < len && text[pos] !== '\n') {
                        pos++;
                    }
                } else if (text[pos + 1] === '*') {
                    // Skip multi-line comment
                    pos += 2;
                    while (pos + 1 < len && !(text[pos] === '*' && text[pos + 1] === '/')) {
                        pos++;
                    }
                    if (pos + 1 < len) pos += 2; // Skip the closing */
                } else {
                    pos++;
                }
            } else {
                pos++;
            }
        }
        return false; // Failed to find closing parenthesis
    }
    
    // Main parsing loop
    while (pos < len) {
        const ch = text[pos];
        
        // Handle different states
        switch (state) {
            case ParserState.DEFAULT:
                // Handle single-line comments
                if (ch === '/' && pos + 1 < len && text[pos + 1] === '/') {
                    state = ParserState.IN_COMMENT_SINGLE;
                    pos += 2;
                    continue;
                }
                // Handle multi-line comments
                else if (ch === '/' && pos + 1 < len && text[pos + 1] === '*') {
                    state = ParserState.IN_COMMENT_MULTI;
                    pos += 2;
                    continue;
                }
                // Handle string literals
                else if (ch === '"') {
                    state = ParserState.IN_STRING;
                    pos++;
                    continue;
                }
                // Handle character literals
                else if (ch === '\'') {
                    state = ParserState.IN_CHAR;
                    pos++;
                    continue;
                }
                // Handle preprocessor directives
                else if (ch === '#' && (pos === 0 || text[pos - 1] === '\n' || text[pos - 1] === '\r')) {
                    state = ParserState.IN_PREPROCESSOR;
                    pos++;
                    continue;
                }
                // Handle braces
                else if (ch === '{') {
                    braceDepth++;
                    
                    // Check if we're starting a function body
                    if (inParentheses === 0 && potentialFuncStart !== -1 && potentialFuncName !== '') {
                        isInFunction = true;
                        functionBodyStart = pos;
                    }
                    
                    pos++;
                    continue;
                }
                else if (ch === '}') {
                    braceDepth--;
                    
                    // Check if we're ending a function body
                    if (isInFunction && braceDepth === 0) {
                        // We found a complete function
                        yield {
                            name: potentialFuncName,
                            start: potentialFuncStart,
                            end: pos + 1,
                            length: (pos + 1) - potentialFuncStart,
                            body: {
                                start: functionBodyStart + 1,
                                end: pos
                            }
                        };
                        
                        // Reset function tracking
                        isInFunction = false;
                        potentialFuncStart = -1;
                        potentialFuncName = '';
                        functionBodyStart = -1;
                    }
                    
                    pos++;
                    continue;
                }
                // Handle parentheses
                else if (ch === '(') {
                    inParentheses++;
                    
                    // If we just saw an identifier followed by an opening parenthesis,
                    // this could be a function declaration
                    if (isAlphaNumeric(lastToken[lastToken.length - 1]) && 
                        (isTypeIdentifier(lastTypeMatch) || lastTypeMatch === '*')) {
                        state = ParserState.IN_FUNCTION_DECL;
                        potentialFuncName = lastToken;
                        potentialFuncStart = tokenStart;
                    }
                    
                    pos++;
                    continue;
                }
                else if (ch === ')') {
                    inParentheses--;
                    
                    // If we're at a closing parenthesis and we have a potential function,
                    // check what follows (should be { for a function definition)
                    if (inParentheses === 0 && state === ParserState.IN_FUNCTION_DECL) {
                        // Skip any whitespace
                        let lookAheadPos = pos + 1;
                        while (lookAheadPos < len && isWhitespace(text[lookAheadPos])) {
                            lookAheadPos++;
                        }
                        
                        // If next non-whitespace char is not {, this is not a function definition
                        if (lookAheadPos < len && text[lookAheadPos] !== '{') {
                            state = ParserState.DEFAULT;
                            potentialFuncStart = -1;
                            potentialFuncName = '';
                        }
                    }
                    
                    pos++;
                    continue;
                }
                // Handle identifiers and track type identifiers
                else if (isAlpha(ch)) {
                    tokenStart = pos;
                    const identifier = collectIdentifier();
                    lastToken = identifier;
                    
                    // Check if this is a type identifier
                    if (isTypeIdentifier(identifier)) {
                        lastTypeMatch = identifier;
                    }
                    
                    // Don't increment pos as collectIdentifier has already done so
                    continue;
                }
                // Handle pointers in declarations
                else if (ch === '*') {
                    lastTypeMatch = '*';
                    pos++;
                    continue;
                }
                // Handle semicolons which can reset function declaration state
                else if (ch === ';') {
                    // If we were in a potential function declaration, this semicolon indicates it's not a function
                    if (state === ParserState.IN_FUNCTION_DECL) {
                        state = ParserState.DEFAULT;
                        potentialFuncStart = -1;
                        potentialFuncName = '';
                    }
                    
                    pos++;
                    continue;
                }
                else {
                    // Skip any other character
                    pos++;
                    continue;
                }
                break;
                
            case ParserState.IN_COMMENT_SINGLE:
                // Stay in this state until we hit a newline
                if (ch === '\n') {
                    state = ParserState.DEFAULT;
                }
                pos++;
                break;
                
            case ParserState.IN_COMMENT_MULTI:
                // Stay in this state until we see a */
                if (ch === '*' && pos + 1 < len && text[pos + 1] === '/') {
                    state = ParserState.DEFAULT;
                    pos += 2;
                } else {
                    pos++;
                }
                break;
                
            case ParserState.IN_STRING:
                // Handle escaped characters
                if (ch === '\\' && pos + 1 < len) {
                    pos += 2; // Skip the escape sequence
                } 
                // End string if we see an unescaped quote
                else if (ch === '"') {
                    state = ParserState.DEFAULT;
                    pos++;
                } else {
                    pos++;
                }
                break;
                
            case ParserState.IN_CHAR:
                // Handle escaped characters
                if (ch === '\\' && pos + 1 < len) {
                    pos += 2; // Skip the escape sequence
                } 
                // End char if we see an unescaped quote
                else if (ch === '\'') {
                    state = ParserState.DEFAULT;
                    pos++;
                } else {
                    pos++;
                }
                break;
                
            case ParserState.IN_PREPROCESSOR:
                // Stay in this state until end of line (unless line ends with \)
                if (ch === '\n') {
                    // Check if the preprocessor directive is continued on the next line
                    let i = pos - 1;
                    while (i >= 0 && isWhitespace(text[i])) {
                        i--;
                    }
                    
                    if (i >= 0 && text[i] === '\\') {
                        // The directive continues on the next line
                        pos++;
                    } else {
                        // The directive ends here
                        state = ParserState.DEFAULT;
                        pos++;
                    }
                } else {
                    pos++;
                }
                break;
                
            case ParserState.IN_FUNCTION_DECL:
                // Function declaration state is handled along with the default state
                // since it's used to track potential function declarations
                if (ch === '{') {
                    // We found a function definition
                    braceDepth++;
                    isInFunction = true;
                    functionBodyStart = pos;
                    state = ParserState.DEFAULT;
                    pos++;
                } else if (ch === ';') {
                    // This was a function declaration, not a definition
                    state = ParserState.DEFAULT;
                    potentialFuncStart = -1;
                    potentialFuncName = '';
                    pos++;
                } else {
                    pos++;
                }
                break;
        }
    }
}

/**
 * Find all C function scopes in the given text
 * 
 * @param text The full text of the C file
 * @returns Array of function scopes
 */
export function findCFunctionScopes(text: string): FunctionScope[] {
    const scopes: FunctionScope[] = [];
    for (const scope of cFunctionScopeGenerator(text)) {
        scopes.push(scope);
    }
    return scopes;
} 