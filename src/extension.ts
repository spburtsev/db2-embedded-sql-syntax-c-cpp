import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Embedded SQL Syntax Highlighter extension is now active');

    // Create a decorator type for host variables
    const hostVariableDecorationType = vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor('editorBracketHighlight.foreground1'),
        fontWeight: 'bold'
    });

    // Register the decorator
    context.subscriptions.push(hostVariableDecorationType);

    // Update decorations when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, hostVariableDecorationType);
        }
    }, null, context.subscriptions);

    // Update decorations when document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            updateDecorations(editor, hostVariableDecorationType);
        }
    }, null, context.subscriptions);

    // Initial decoration for the current editor
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor, hostVariableDecorationType);
    }
}

function updateDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType) {
    const document = editor.document;
    
    // Only apply to C/C++ files
    if (document.languageId !== 'c' && document.languageId !== 'cpp') {
        return;
    }

    const text = document.getText();
    const hostVariables: vscode.DecorationOptions[] = [];
    
    // Part 1: Decorate host variables used in SQL statements (with colon prefix)
    decorateHostVariablesInStatements(text, document, hostVariables);
    
    // Part 2: Decorate variables declared in SQL DECLARE SECTION
    decorateHostVariablesInDeclarationSections(text, document, hostVariables);
    
    editor.setDecorations(decorationType, hostVariables);
}

function decorateHostVariablesInStatements(text: string, document: vscode.TextDocument, hostVariables: vscode.DecorationOptions[]) {
    // Regular expression for EXEC SQL and host variables
    const execSqlRegex = /\bEXEC\s+SQL\b(.*?);/gs;
    const hostVarRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    
    let execSqlMatch;
    while ((execSqlMatch = execSqlRegex.exec(text)) !== null) {
        const sqlText = execSqlMatch[1];
        
        // Find host variables within SQL statement
        let hostVarMatch;
        const hostVarOffset = execSqlMatch.index + "EXEC SQL".length;
        while ((hostVarMatch = hostVarRegex.exec(sqlText)) !== null) {
            const startPos = document.positionAt(hostVarOffset + hostVarMatch.index);
            const endPos = document.positionAt(hostVarOffset + hostVarMatch.index + hostVarMatch[0].length);
            
            const decoration = { 
                range: new vscode.Range(startPos, endPos),
                hoverMessage: 'Host variable: ' + hostVarMatch[1]
            };
            
            hostVariables.push(decoration);
        }
    }
}

function decorateHostVariablesInDeclarationSections(text: string, document: vscode.TextDocument, hostVariables: vscode.DecorationOptions[]) {
    // Find all DECLARE SECTION blocks
    const beginRegex = /EXEC\s+SQL\s+BEGIN\s+DECLARE\s+SECTION\s*;/g;
    const endRegex = /EXEC\s+SQL\s+END\s+DECLARE\s+SECTION\s*;/g;
    
    let beginMatches: { index: number, length: number }[] = [];
    let endMatches: { index: number, length: number }[] = [];
    
    // Find all BEGIN markers
    let beginMatch;
    while ((beginMatch = beginRegex.exec(text)) !== null) {
        beginMatches.push({ 
            index: beginMatch.index + beginMatch[0].length, 
            length: beginMatch[0].length 
        });
    }
    
    // Find all END markers
    let endMatch;
    while ((endMatch = endRegex.exec(text)) !== null) {
        endMatches.push({ 
            index: endMatch.index, 
            length: endMatch[0].length 
        });
    }
    
    // Match BEGIN with END markers to form sections
    for (let i = 0; i < beginMatches.length; i++) {
        if (i < endMatches.length) {
            const sectionStart = beginMatches[i].index;
            const sectionEnd = endMatches[i].index;
            
            if (sectionStart < sectionEnd) {
                // Extract the section content
                const sectionText = text.substring(sectionStart, sectionEnd);
                
                // Find variable declarations in the section
                // This regex matches typical C/C++ variable declarations with optional initialization
                const varDeclRegex = /\b(int|char|float|double|long|short|unsigned|signed|void|struct|enum)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\[\s*\d+\s*\])?(?:\s*=\s*[^;]+)?\s*;/g;
                
                let varMatch;
                while ((varMatch = varDeclRegex.exec(sectionText)) !== null) {
                    const varName = varMatch[2]; // Group 2 is the variable name
                    
                    // Find the exact position of the variable name
                    // This is important for initialized variables where there's more text after the name
                    const declaration = varMatch[0];
                    const typeNamePart = varMatch[1] + " " + varName;
                    const varNameIndex = declaration.indexOf(typeNamePart) + varMatch[1].length + 1; // +1 for the space
                    
                    const varStartIdx = sectionStart + varMatch.index + varNameIndex;
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
        }
    }
}

export function deactivate() {}
