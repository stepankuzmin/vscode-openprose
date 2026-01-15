# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VS Code extension providing syntax highlighting and language features for OpenProse (.prose) files. OpenProse is a language for orchestrating AI agents.

## Commands

```bash
npm install          # Install dependencies
npm run compile      # Build TypeScript
npm run watch        # Build with watch mode
npm test             # Run tests (requires VS Code instance)
npm run package      # Build and package .vsix for distribution
```

## Architecture

**Extension Entry Point:** `src/extension.ts`
- Registers two language providers on activation:
  - `DefinitionProvider` - Go-to-definition for variables, agents, blocks
  - `DocumentHighlightProvider` - Highlight all references to a symbol

**Syntax Highlighting:** `syntaxes/prose.tmLanguage.json`
- TextMate grammar defining token patterns for strings, discretion blocks, comments, constants, agent/block definitions

**Language Configuration:** `language-configuration.json`
- Bracket matching, auto-closing pairs, indentation rules, folding

## Key Patterns

The extension uses regex-based navigation. Key patterns to understand:

- **Variable definitions:** `let/const x =`, `x = session`, `for x in`
- **Block parameters:** `block name(param1, param2):` creates lexically-scoped params
- **References:** `{var}` interpolation, `session: agent`, `do block`, `context: [vars]`

`findEnclosingBlock()` determines scope for block parameters - essential for correct go-to-definition when the same parameter name exists in multiple blocks.

## Testing

Tests run in a real VS Code instance via `@vscode/test-electron`. The test file (`src/test/extension.test.ts`) creates temporary documents and verifies the definition/highlight providers work correctly.
