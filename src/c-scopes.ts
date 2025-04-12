/**
 * C++ scope parser for identifying function boundaries
 */
export interface FunctionScope {
    name: string;       // Function name
    start: number;      // Start position in document
    end: number;        // End position in document
    length: number;     // Length of function (end - start)
    body: {
        start: number;  // Start position of function body (after opening brace)
        end: number;    // End position of function body (before closing brace)
    };
}

/**
 * Generator function that yields function scopes one by one
 * This allows processing each scope without storing all of them in memory
 * 
 * @param text The full text of the C/C++ file
 * @yields FunctionScope objects one at a time
 */
export function* functionScopeGenerator(text: string): Generator<FunctionScope> {
    // Regex for finding function declarations in C/C++
    const functionRegex = /\b(?:void|int|char|float|double|long|short|unsigned|signed|struct|enum|static|inline|extern|auto|register|const|volatile|__declspec\([^)]*\)|__attribute__\(\([^)]*\)\))\s+(?:\*\s*)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\((?:[^()]*|\([^()]*\))*\)\s*(?:const)?\s*(?=\{)/g;
    
    let match;
    while ((match = functionRegex.exec(text)) !== null) {
        const funcName = match[1];
        const funcDeclStart = match.index;
        const funcBodyStart = text.indexOf('{', match.index + match[0].length);
        if (funcBodyStart === -1) {
            continue;
        }
        
        let braceCount = 1;
        let funcEnd = funcBodyStart + 1;
        
        for (let i = funcEnd; i < text.length; i++) {
            const char = text[i];
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    funcEnd = i + 1;
                    break;
                }
            }
        }
        const scope: FunctionScope = {
            name: funcName,
            start: funcDeclStart,
            end: funcEnd,
            length: funcEnd - funcDeclStart,
            body: {
                start: funcBodyStart + 1,
                end: funcEnd - 1
            }
        };
        yield scope;
    }
}