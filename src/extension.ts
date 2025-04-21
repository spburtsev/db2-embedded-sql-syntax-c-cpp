import * as vscode from 'vscode';

const processedFiles = new Set<string>();

export function activate(context: vscode.ExtensionContext) {
    registerFileAssociations();
    
    vscode.workspace.findFiles('**/*.sq{c,C,x}')
        .then(files => files.forEach(setInitialLanguageMode));
    
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => 
            setInitialLanguageMode(doc.uri).catch(err => 
                console.error('Error setting language mode:', err)
            )
        )
    );
}

export function deactivate() {
    processedFiles.clear();
}

async function setInitialLanguageMode(uri: vscode.Uri) {
    const filePath = uri.fsPath;
    if (processedFiles.has(filePath)) {
        return;
    }
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        if (document.languageId !== 'plaintext') {
            processedFiles.add(filePath);
            return;
        }

        if (filePath.endsWith('.sqc')) {
            await vscode.languages.setTextDocumentLanguage(document, 'c');
        } else if (filePath.endsWith('.sqC') || filePath.endsWith('.sqx')) {
            await vscode.languages.setTextDocumentLanguage(document, 'cpp');
        }
        processedFiles.add(filePath);
    } catch (error) {
        console.error('Error setting initial language mode:', error);
    }
}

const fileAssociations = [
    { pattern: '*.sqc', language: 'c' },
    { pattern: '*.sqC', language: 'cpp' },
    { pattern: '*.sqx', language: 'cpp' }
];

function registerFileAssociations() {
    const config = vscode.workspace.getConfiguration();
    const currentAssociations: Record<string, string> = config.get('files.associations') || {};

    let changed = false;
    for (const {pattern, language} of fileAssociations) {
        if (!currentAssociations[pattern]) {
            currentAssociations[pattern] = language;
            changed = true;
        }
    }
    if (changed) {
        config.update('files.associations', currentAssociations, vscode.ConfigurationTarget.Global);
    }
}
