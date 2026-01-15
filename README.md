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

**VS Code Marketplace:**
Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=StepanKuzmin.openprose)

**Manual Install:**
Download `.vsix` from [GitHub Releases](https://github.com/stepankuzmin/vscode-openprose/releases) and install via `Extensions: Install from VSIX...` command.

## Development

```bash
npm install
npm run package
```
