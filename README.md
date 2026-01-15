<p align="center">
  <img src="readme-header.png" alt="OpenProse" width="100%">
</p>

# OpenProse for VS Code

Syntax highlighting for [OpenProse](https://github.com/openprose/prose) files.

## What Gets Highlighted

- **Strings** - `"text"` and `"""multiline"""`
- **Discretion blocks** - `**text**` and `***multiline***`
- **Comments** - `# comment`
- **Constants** - model names (`sonnet`, `opus`, `haiku`), permissions (`allow`, `deny`), backoff strategies (`none`, `linear`, `exponential`), numbers
- **Definitions** - agent and block names

## Installation

1. Clone this repo
2. Open in VS Code
3. Press F5 to launch Extension Development Host
4. Open any `.prose` file

## Packaging

```bash
npm install
npm run package
```
