import * as vscode from 'vscode';

function findEnclosingBlock(document: vscode.TextDocument, position: vscode.Position): { start: number; paramsStr: string; prefixLength: number } | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const blockPattern = /^(\s*block\s+\w+\s*\()([^)]*)(\)\s*:)/gm;

  // Blocks are sequential in document order. The enclosing block is the last one
  // whose header appears before the cursor position.
  let result: { start: number; paramsStr: string; prefixLength: number } | null = null;
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    if (match.index > offset) break;
    result = {
      start: match.index,
      paramsStr: match[2],
      prefixLength: match[1].length
    };
  }
  return result;
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
    new RegExp(`^(\\s*)(${name})(\\s*=\\s*(?:session|resume)\\b)`, 'm'),
    new RegExp(`^(\\s*input\\s+)(${name})(\\s*:)`, 'm'),
    new RegExp(`^(\\s*output\\s+)(${name})(\\s*=)`, 'm'),
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

  // Each pattern finds references in a different syntactic context.
  // nameOffset calculates where the name starts within the match, since JS regex
  // doesn't provide capture group positions directly.
  const patterns: { regex: RegExp; nameOffset: (m: RegExpExecArray) => number }[] = [
    // {varname} interpolation - skip opening brace
    { regex: new RegExp(`\\{(${name})\\}`, 'g'),
      nameOffset: () => 1 },
    // let x = or const x = (lastIndexOf avoids matching 'let' if name is 'let')
    { regex: new RegExp(`^\\s*(?:let|const)\\s+(${name})\\s*=`, 'gm'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // for x in or parallel for x, i in
    { regex: new RegExp(`^\\s*(?:parallel\\s+)?for\\s+(${name})(?:\\s*,|\\s+in)`, 'gm'),
      nameOffset: m => m[0].indexOf(name) },
    // in sessionname: (parallel for target)
    { regex: new RegExp(`\\bin\\s+(${name})\\s*:`, 'g'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // x = session or x = resume (session/resume assignment)
    { regex: new RegExp(`^\\s*(${name})\\s*=\\s*(?:session|resume)\\b`, 'gm'),
      nameOffset: m => m[0].indexOf(name) },
    // context: x or context: [a, x] or context: {a, x}
    { regex: new RegExp(`\\bcontext:\\s*(?:[\\[{]\\s*)?(?:[\\w,\\s]*,\\s*)?(${name})\\b`, 'g'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // agent agentname:
    { regex: new RegExp(`^\\s*agent\\s+(${name})\\s*:`, 'gm'),
      nameOffset: m => m[0].indexOf(name) },
    // session: agentname or resume: agentname
    { regex: new RegExp(`\\b(?:session|resume):\\s*(${name})\\b`, 'g'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // block blockname: or block blockname(params):
    { regex: new RegExp(`^\\s*block\\s+(${name})(?:\\([^)]*\\))?\\s*:`, 'gm'),
      nameOffset: m => m[0].indexOf(name) },
    // do blockname
    { regex: new RegExp(`\\bdo\\s+(${name})\\b`, 'g'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // input varname:
    { regex: new RegExp(`^\\s*input\\s+(${name})\\s*:`, 'gm'),
      nameOffset: m => m[0].lastIndexOf(name) },
    // output varname =
    { regex: new RegExp(`^\\s*output\\s+(${name})\\s*=`, 'gm'),
      nameOffset: m => m[0].lastIndexOf(name) },
  ];

  for (const { regex, nameOffset } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index + nameOffset(match);
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

      const interpolationRange = document.getWordRangeAtPosition(position, /\{[a-zA-Z_][a-zA-Z0-9_-]*\}/);
      if (interpolationRange) {
        return findVarDefinition(document, document.getText(interpolationRange).slice(1, -1), position);
      }
      if (/(?:session|resume):\s*$/.test(beforeWord)) return findAgentDefinition(document, word);
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

      const interpolationRange = document.getWordRangeAtPosition(position, /\{[a-zA-Z_][a-zA-Z0-9_-]*\}/);
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
