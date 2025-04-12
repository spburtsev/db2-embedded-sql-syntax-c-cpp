/**
 * Host variable utilities for embedded SQL in C/C++
 */
import { FunctionScope } from './c-scopes';

// Regular expressions for SQL sections
export const hostVarSectionBeginRegex = /EXEC\s+SQL\s+BEGIN\s+DECLARE\s+SECTION\s*;/g;
export const hostVarSectionEndRegex = /EXEC\s+SQL\s+END\s+DECLARE\s+SECTION\s*;/g;
export const sqlStatementRegex = /EXEC\s+SQL\b.*?;/gs;

// Regular expression for host variable references in SQL statements
export const hostVarReferenceRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

// Regular expression for C/C++ variable declarations
export const varDeclRegex = /\b(int|char|float|double|long|short|unsigned|signed|void|struct|enum)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\[\s*\d+\s*\])?(?:\s*=\s*[^;]+)?\s*;/g;

// Interface to track host variable information
export interface HostVariable {
    name: string;           // Variable name
    type: string;           // Variable type (int, char, etc.)
    declarationPos: number; // Position where the variable is declared
    functionScope: string;  // Name of function where the variable is declared
}

// Interface to track host variable scope
export interface HostVariableScope {
    functionScope: FunctionScope; // Function scope containing the host variables
    variables: HostVariable[];    // Host variables declared in this function
}

/**
 * Find all host variables in a given function scope
 * 
 * @param text Full text of the document
 * @param functionScope The function scope to search in
 * @returns Array of host variables found in the function
 */
export function findHostVariablesInFunction(text: string, functionScope: FunctionScope): HostVariable[] {
    const hostVars: HostVariable[] = [];
    const functionText = text.substring(functionScope.start, functionScope.end);
    
    // Find all DECLARE SECTION blocks in this function
    let declSectionStart = -1;
    let declSectionEnd = -1;
    
    hostVarSectionBeginRegex.lastIndex = 0;
    hostVarSectionEndRegex.lastIndex = 0;
    
    let beginMatch;
    while ((beginMatch = hostVarSectionBeginRegex.exec(functionText)) !== null) {
        declSectionStart = beginMatch.index + beginMatch[0].length;
        
        // Find the matching END DECLARE SECTION
        hostVarSectionEndRegex.lastIndex = declSectionStart;
        const endMatch = hostVarSectionEndRegex.exec(functionText);
        
        if (endMatch) {
            declSectionEnd = endMatch.index;
            
            // Extract section content
            const sectionText = functionText.substring(declSectionStart, declSectionEnd);
            
            // Find all variable declarations in the section
            varDeclRegex.lastIndex = 0;
            let varMatch;
            while ((varMatch = varDeclRegex.exec(sectionText)) !== null) {
                const varType = varMatch[1];
                const varName = varMatch[2];
                
                // Calculate absolute position of the variable declaration
                const varDeclPos = functionScope.start + declSectionStart + varMatch.index;
                
                hostVars.push({
                    name: varName,
                    type: varType,
                    declarationPos: varDeclPos,
                    functionScope: functionScope.name
                });
            }
        }
    }
    
    return hostVars;
}

/**
 * Find all host variables and their scopes in the entire document
 * 
 * @param text Full text of the document
 * @param functionScopes Array of function scopes in the document
 * @returns Array of host variable scopes
 */
export function findHostVariableScopes(text: string, functionScopes: FunctionScope[]): HostVariableScope[] {
    const scopes: HostVariableScope[] = [];
    
    for (const funcScope of functionScopes) {
        const hostVars = findHostVariablesInFunction(text, funcScope);
        
        if (hostVars.length > 0) {
            scopes.push({
                functionScope: funcScope,
                variables: hostVars
            });
        }
    }
    
    return scopes;
}
    
