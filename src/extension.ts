import * as vscode from 'vscode';

function findEnclosingBlock(document: vscode.TextDocument, position: vscode.Position): { start: number; paramsStr: string; prefixLength: number } | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const blockPattern = /^(\s*block\s+\w+\s*\()([^)]*)(\)\s*:)/gm;

  const blocks: { start: number; end: number; paramsStr: string; prefixLength: number }[] = [];
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    blocks.push({
      start: match.index,
      end: text.length,
      paramsStr: match[2],
      prefixLength: match[1].length
    });
  }

  for (let i = 0; i < blocks.length; i++) {
    if (i + 1 < blocks.length) {
      blocks[i].end = blocks[i + 1].start;
    }
  }

  for (const block of blocks) {
    if (offset >= block.start && offset < block.end) {
      return block;
    }
  }
  return null;
}

function findVarDefinition(document: vscode.TextDocument, name: string, position?: vscode.Position): vscode.Location | null {
  const text = document.getText();

  if (position) {
    const enclosingBlock = findEnclosingBlock(document, position);
    if (enclosingBlock) {
      const paramPattern = new RegExp(`\\b(${name})\\b`);
      const paramMatch = paramPattern.exec(enclosingBlock.paramsStr);
      if (paramMatch) {
        const nameStart = enclosingBlock.start + enclosingBlock.prefixLength + paramMatch.index;
        return new vscode.Location(document.uri, new vscode.Range(
          document.positionAt(nameStart),
          document.positionAt(nameStart + name.length)
        ));
      }
    }
  }

  const patterns = [
    new RegExp(`^(\\s*(?:let|const)\\s+)(${name})(\\s*=)`, 'm'),
    new RegExp(`^(\\s*(?:parallel\\s+)?for\\s+)(${name})(?:\\s*,\\s*\\w+)?\\s+in\\s+`, 'm'),
    new RegExp(`^(\\s*)(${name})(\\s*=\\s*session\\b)`, 'm'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const nameStart = match.index + match[1].length;
      return new vscode.Location(document.uri, new vscode.Range(
        document.positionAt(nameStart),
        document.positionAt(nameStart + name.length)
      ));
    }
  }

  return null;
}

function findAgentDefinition(document: vscode.TextDocument, name: string): vscode.Location | null {
  const match = new RegExp(`^(\\s*agent\\s+)(${name})(\\s*:)`, 'm').exec(document.getText());
  if (!match) return null;
  const nameStart = match.index + match[1].length;
  return new vscode.Location(document.uri, new vscode.Range(
    document.positionAt(nameStart),
    document.positionAt(nameStart + name.length)
  ));
}

function findBlockDefinition(document: vscode.TextDocument, name: string): vscode.Location | null {
  const match = new RegExp(`^(\\s*block\\s+)(${name})((?:\\([^)]*\\))?\\s*:)`, 'm').exec(document.getText());
  if (!match) return null;
  const nameStart = match.index + match[1].length;
  return new vscode.Location(document.uri, new vscode.Range(
    document.positionAt(nameStart),
    document.positionAt(nameStart + name.length)
  ));
}

function findReferences(document: vscode.TextDocument, name: string): vscode.Range[] {
  const text = document.getText();
  const ranges: vscode.Range[] = [];

  const patterns: [RegExp, (m: RegExpExecArray) => number][] = [
    [new RegExp(`\\{(${name})\\}`, 'g'), m => m.index + 1],
    [new RegExp(`^\\s*(?:let|const)\\s+(${name})\\s*=`, 'gm'), m => m.index + m[0].lastIndexOf(name)],
    [new RegExp(`^\\s*(?:parallel\\s+)?for\\s+(${name})(?:\\s*,|\\s+in)`, 'gm'), m => m.index + m[0].indexOf(name)],
    [new RegExp(`\\bin\\s+(${name})\\s*:`, 'g'), m => m.index + m[0].lastIndexOf(name)],
    [new RegExp(`^\\s*(${name})\\s*=\\s*session\\b`, 'gm'), m => m.index + m[0].indexOf(name)],
    [new RegExp(`\\bcontext:\\s*(?:[\\[{]\\s*)?(?:[\\w,\\s]*,\\s*)?(${name})\\b`, 'g'), m => m.index + m[0].lastIndexOf(name)],
    [new RegExp(`^\\s*agent\\s+(${name})\\s*:`, 'gm'), m => m.index + m[0].indexOf(name)],
    [new RegExp(`\\bsession:\\s*(${name})\\b`, 'g'), m => m.index + m[0].lastIndexOf(name)],
    [new RegExp(`^\\s*block\\s+(${name})(?:\\([^)]*\\))?\\s*:`, 'gm'), m => m.index + m[0].indexOf(name)],
    [new RegExp(`\\bdo\\s+(${name})\\b`, 'g'), m => m.index + m[0].lastIndexOf(name)],
  ];

  for (const [pattern, getStart] of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = getStart(match);
      ranges.push(new vscode.Range(document.positionAt(start), document.positionAt(start + name.length)));
    }
  }

  const blockParamPattern = new RegExp(`^(\\s*block\\s+\\w+\\s*\\()([^)]*)(\\)\\s*:)`, 'gm');
  let blockMatch;
  while ((blockMatch = blockParamPattern.exec(text)) !== null) {
    const paramsStr = blockMatch[2];
    const paramPattern = new RegExp(`\\b(${name})\\b`, 'g');
    let paramMatch;
    while ((paramMatch = paramPattern.exec(paramsStr)) !== null) {
      const start = blockMatch.index + blockMatch[1].length + paramMatch.index;
      ranges.push(new vscode.Range(document.positionAt(start), document.positionAt(start + name.length)));
    }
  }

  return ranges;
}

export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = vscode.languages.registerDefinitionProvider('prose', {
    provideDefinition(document, position) {
      const line = document.lineAt(position).text;
      const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_-]*/);
      if (!wordRange) return null;

      const word = document.getText(wordRange);
      const beforeWord = line.slice(0, wordRange.start.character);

      const interpolationRange = document.getWordRangeAtPosition(position, /\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
      if (interpolationRange) {
        return findVarDefinition(document, document.getText(interpolationRange).slice(1, -1), position);
      }
      if (/session:\s*$/.test(beforeWord)) return findAgentDefinition(document, word);
      if (/\bdo\s+$/.test(beforeWord)) return findBlockDefinition(document, word);
      if (/\bin\s+$/.test(beforeWord)) return findVarDefinition(document, word, position);
      if (/\bcontext:\s*(?:[\[{]\s*)?(?:[\w,\s]*,\s*)?$/.test(beforeWord)) return findVarDefinition(document, word, position);

      return null;
    }
  });

  const highlightProvider = vscode.languages.registerDocumentHighlightProvider('prose', {
    provideDocumentHighlights(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_-]*/);
      if (!wordRange) return null;

      const interpolationRange = document.getWordRangeAtPosition(position, /\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
      const word = interpolationRange
        ? document.getText(interpolationRange).slice(1, -1)
        : document.getText(wordRange);

      return findReferences(document, word).map(range =>
        new vscode.DocumentHighlight(range, vscode.DocumentHighlightKind.Read)
      );
    }
  });

  context.subscriptions.push(definitionProvider, highlightProvider);
}

export function deactivate() {}
