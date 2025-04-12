import * as vscode from 'vscode';
import { functionScopeGenerator, type FunctionScope } from './c-scopes';
import { 
    findHostVariablesInFunction,
    hostVarSectionBeginRegex,
    hostVarSectionEndRegex,
    sqlStatementRegex,
    hostVarReferenceRegex,
    varDeclRegex,
} from './hostvars';

export function activate(context: vscode.ExtensionContext) {
    const hostVariableDecorationType = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor('editorBracketHighlight.foreground1'),
        fontWeight: 'bold'
    });

    context.subscriptions.push(hostVariableDecorationType);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, hostVariableDecorationType);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            updateDecorations(editor, hostVariableDecorationType);
        }
    }, null, context.subscriptions);

    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor, hostVariableDecorationType);
    }
}

function updateDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType) {
    const document = editor.document;
    if (document.languageId !== 'c' && document.languageId !== 'cpp') {
        return;
    }

    const text = document.getText();
    const hostVariables: vscode.DecorationOptions[] = [];
    for (const funcScope of functionScopeGenerator(text)) {
        processFunctionScope(text, document, funcScope, hostVariables);
    }
    editor.setDecorations(decorationType, hostVariables);
}

/**
 * Find excluded regions (comments, strings) within a specific text range
 */
function findExcludedRegions(text: string, startOffset: number): [number, number][] {
    const excludeRegions: [number, number][] = []; // Array of [start, end] indices
    
    // 1. Find all string literals
    const stringLiteralRegex = /"(?:[^"\\]|\\.)*"/g;
    let stringMatch;
    while ((stringMatch = stringLiteralRegex.exec(text)) !== null) {
        excludeRegions.push([
            startOffset + stringMatch.index, 
            startOffset + stringMatch.index + stringMatch[0].length
        ]);
    }
    
    // 2. Find all single-line comments
    const singleLineCommentRegex = /\/\/.*?(?:\r?\n|$)/g;
    let singleCommentMatch;
    while ((singleCommentMatch = singleLineCommentRegex.exec(text)) !== null) {
        excludeRegions.push([
            startOffset + singleCommentMatch.index, 
            startOffset + singleCommentMatch.index + singleCommentMatch[0].length
        ]);
    }
    
    // 3. Find all multi-line comments
    const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;
    let multiCommentMatch;
    while ((multiCommentMatch = multiLineCommentRegex.exec(text)) !== null) {
        excludeRegions.push([
            startOffset + multiCommentMatch.index, 
            startOffset + multiCommentMatch.index + multiCommentMatch[0].length
        ]);
    }
    
    // Sort regions by start index
    excludeRegions.sort((a, b) => a[0] - b[0]);
    
    // Merge overlapping regions
    for (let i = 0; i < excludeRegions.length - 1; i++) {
        if (excludeRegions[i][1] >= excludeRegions[i+1][0]) {
            excludeRegions[i][1] = Math.max(excludeRegions[i][1], excludeRegions[i+1][1]);
            excludeRegions.splice(i+1, 1);
            i--; // Check this position again
        }
    }
    return excludeRegions;
}

/**
 * Process a single function scope - find and decorate all host variables within it
 */
function processFunctionScope(
    text: string, 
    document: vscode.TextDocument, 
    funcScope: FunctionScope, 
    hostVariables: vscode.DecorationOptions[]
) {
    // Extract function text
    const funcText = text.substring(funcScope.start, funcScope.end);
    
    // Find host variables declared in this function
    const hostVars = findHostVariablesInFunction(text, funcScope);
    
    if (hostVars.length === 0) {
        return;
    }
    
    // Create a map of variable names for quick lookup
    const hostVarNames = new Set(hostVars.map(v => v.name));
    
    // Find excluded regions specific to this function scope
    const excludedRegions = findExcludedRegions(funcText, funcScope.start);
    
    // Find SQL sections and statements to exclude from regular variable references
    const sqlExcludeRegions: [number, number][] = [];
    
    // 1. Find SQL DECLARE SECTIONs
    hostVarSectionBeginRegex.lastIndex = 0;
    hostVarSectionEndRegex.lastIndex = 0;
    
    // We need to search for DECLARE SECTIONs relative to function start
    let beginMatch;
    while ((beginMatch = hostVarSectionBeginRegex.exec(funcText)) !== null) {
        // Find matching end
        hostVarSectionEndRegex.lastIndex = beginMatch.index + beginMatch[0].length;
        const endMatch = hostVarSectionEndRegex.exec(funcText);
        
        if (endMatch) {
            // Map to absolute positions
            const sectionStart = funcScope.start + beginMatch.index;
            const sectionEnd = funcScope.start + endMatch.index + endMatch[0].length;
            
            sqlExcludeRegions.push([sectionStart, sectionEnd]);
            
            // While processing the DECLARE SECTION, decorate the variables
            decorateHostVariablesInDeclarationSection(
                text.substring(sectionStart, sectionEnd),
                document,
                hostVariables,
                sectionStart
            );
        }
    }
    
    // 2. Find SQL statements
    sqlStatementRegex.lastIndex = 0;
    let stmtMatch;
    while ((stmtMatch = sqlStatementRegex.exec(funcText)) !== null) {
        // Map to absolute position
        const stmtStart = funcScope.start + stmtMatch.index;
        const stmtEnd = stmtStart + stmtMatch[0].length;
        
        // Check if this statement is already inside a known excluded region
        let alreadyExcluded = false;
        for (const [start, end] of sqlExcludeRegions) {
            if (stmtStart >= start && stmtStart < end) {
                alreadyExcluded = true;
                break;
            }
        }
        
        if (!alreadyExcluded) {
            sqlExcludeRegions.push([stmtStart, stmtEnd]);
            
            // While processing the SQL statement, decorate host variables
            decorateHostVariablesInSqlStatement(
                stmtMatch[0],
                document,
                hostVariables,
                stmtStart
            );
        }
    }
    
    // Combine SQL exclude regions with other excluded regions
    const allExcludedRegions = [...sqlExcludeRegions, ...excludedRegions];
    
    // Sort and merge overlapping regions
    allExcludedRegions.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < allExcludedRegions.length - 1; i++) {
        if (allExcludedRegions[i][1] >= allExcludedRegions[i+1][0]) {
            allExcludedRegions[i][1] = Math.max(allExcludedRegions[i][1], allExcludedRegions[i+1][1]);
            allExcludedRegions.splice(i+1, 1);
            i--; // Check this position again
        }
    }
    
    // Decorate host variable references in regular code
    decorateHostVariablesReferences(
        funcText, 
        document, 
        hostVariables, 
        funcScope, 
        hostVarNames,
        allExcludedRegions
    );
}

/**
 * Decorate host variables in a DECLARE SECTION
 */
function decorateHostVariablesInDeclarationSection(
    sectionText: string,
    document: vscode.TextDocument,
    hostVariables: vscode.DecorationOptions[],
    sectionStart: number
) {
    // Find variables declared in the section
    varDeclRegex.lastIndex = 0;
    let varMatch;
    
    // Skip the EXEC SQL BEGIN DECLARE SECTION; part
    const declareIndex = sectionText.indexOf(';');
    if (declareIndex === -1) return;
    
    const contentStart = declareIndex + 1;
    const contentText = sectionText.substring(contentStart);
    
    while ((varMatch = varDeclRegex.exec(contentText)) !== null) {
        const varName = varMatch[2]; // Group 2 is the variable name
        
        // Find the exact position of the variable name
        const declaration = varMatch[0];
        const typeNamePart = varMatch[1] + " " + varName;
        const varNameIndex = declaration.indexOf(typeNamePart) + varMatch[1].length + 1; // +1 for the space
        
        const varStartIdx = sectionStart + contentStart + varMatch.index + varNameIndex;
        const varEndIdx = varStartIdx + varName.length;
        
        const startPos = document.positionAt(varStartIdx);
        const endPos = document.positionAt(varEndIdx);
        
        const decoration = { 
            range: new vscode.Range(startPos, endPos),
            hoverMessage: 'Host variable declared in SQL section'
        };
        
        hostVariables.push(decoration);
    }
}

/**
 * Decorate host variables in an SQL statement
 */
function decorateHostVariablesInSqlStatement(
    sqlText: string,
    document: vscode.TextDocument,
    hostVariables: vscode.DecorationOptions[],
    sqlStart: number
) {
    hostVarReferenceRegex.lastIndex = 0;
    let hostVarMatch;
    
    while ((hostVarMatch = hostVarReferenceRegex.exec(sqlText)) !== null) {
        const startPos = document.positionAt(sqlStart + hostVarMatch.index);
        const endPos = document.positionAt(sqlStart + hostVarMatch.index + hostVarMatch[0].length);
        
        const decoration = { 
            range: new vscode.Range(startPos, endPos),
            hoverMessage: 'Host variable: ' + hostVarMatch[1]
        };
        
        hostVariables.push(decoration);
    }
}

/**
 * Decorate host variable references in regular code
 */
function decorateHostVariablesReferences(
    funcText: string,
    document: vscode.TextDocument,
    hostVariables: vscode.DecorationOptions[],
    funcScope: FunctionScope,
    hostVarNames: Set<string>,
    excludedRegions: [number, number][]
) {
    if (hostVarNames.size === 0) return;
    
    // Create a regex that matches any of the host variables for this function
    const hostVarRegex = new RegExp(`\\b(${Array.from(hostVarNames).join('|')})\\b`, 'g');
    
    let match;
    while ((match = hostVarRegex.exec(funcText)) !== null) {
        const localVarStart = match.index;
        const localVarEnd = localVarStart + match[0].length;
        
        // Convert to absolute position in the document
        const varStart = funcScope.start + localVarStart;
        const varEnd = funcScope.start + localVarEnd;
        
        // Check if this match is inside an excluded region
        let insideExcludedRegion = false;
        for (const [start, end] of excludedRegions) {
            if (varStart >= start && varStart < end) {
                insideExcludedRegion = true;
                break;
            }
        }
        
        // Only decorate if not inside an excluded region
        if (!insideExcludedRegion) {
            const startPos = document.positionAt(varStart);
            const endPos = document.positionAt(varEnd);
            
            const decoration = { 
                range: new vscode.Range(startPos, endPos),
                hoverMessage: 'Host variable reference'
            };
            
            hostVariables.push(decoration);
        }
    }
}

export function deactivate() {}
