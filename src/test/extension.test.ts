import * as assert from 'assert';
import * as vscode from 'vscode';

suite('OpenProse Extension Test Suite', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('StepanKuzmin.openprose');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('StepanKuzmin.openprose'));
  });

  test('Definition provider: variable interpolation', async function() {
    this.timeout(10000);

    const content = `let topic = "AI"
session "Research {topic}"`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    const editor = await vscode.window.showTextDocument(doc);

    // Position on {topic} - line 1, character 19 (inside the braces)
    const position = new vscode.Position(1, 19);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      position
    );

    assert.ok(locations && locations.length > 0, 'Should find definition');
    assert.strictEqual(locations[0].range.start.line, 0, 'Should jump to line 0');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Definition provider: agent reference', async function() {
    this.timeout(10000);

    const content = `agent researcher:
  model: opus

session: researcher`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    await vscode.window.showTextDocument(doc);

    // Position on "researcher" after "session: " - line 3, character 10
    const position = new vscode.Position(3, 10);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      position
    );

    assert.ok(locations && locations.length > 0, 'Should find agent definition');
    assert.strictEqual(locations[0].range.start.line, 0, 'Should jump to agent definition line');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Definition provider: block reference', async function() {
    this.timeout(10000);

    const content = `block setup:
  session "Initialize"

do setup`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    await vscode.window.showTextDocument(doc);

    // Position on "setup" after "do " - line 3, character 4
    const position = new vscode.Position(3, 4);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      position
    );

    assert.ok(locations && locations.length > 0, 'Should find block definition');
    assert.strictEqual(locations[0].range.start.line, 0, 'Should jump to block definition line');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Definition provider: context with braces', async function() {
    this.timeout(10000);

    const content = `a = session "First"
b = session "Second"

session "Combine"
  context: { a, b }`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    await vscode.window.showTextDocument(doc);

    // Position on "a" in context: { a, b } - line 4, character 13
    const position = new vscode.Position(4, 13);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      position
    );

    assert.ok(locations && locations.length > 0, 'Should find variable definition');
    assert.strictEqual(locations[0].range.start.line, 0, 'Should jump to a = session line');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Definition provider: block parameter lexical scope', async function() {
    this.timeout(10000);

    const content = `block first(name):
  session "Hello {name}"

block second(name):
  session "Goodbye {name}"`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    await vscode.window.showTextDocument(doc);

    // Position on {name} in second block - line 4, character 20
    const position = new vscode.Position(4, 20);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      position
    );

    assert.ok(locations && locations.length > 0, 'Should find parameter definition');
    assert.strictEqual(locations[0].range.start.line, 3, 'Should jump to second block parameter, not first');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Document highlight provider', async function() {
    this.timeout(10000);

    const content = `let topic = "AI"
session "Research {topic}"
session "More about {topic}"`;

    const doc = await vscode.workspace.openTextDocument({ language: 'prose', content });
    await vscode.window.showTextDocument(doc);

    // Position on "topic" in let statement
    const position = new vscode.Position(0, 5);
    const highlights = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
      'vscode.executeDocumentHighlights',
      doc.uri,
      position
    );

    assert.ok(highlights && highlights.length >= 3, 'Should highlight definition and both references');

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
