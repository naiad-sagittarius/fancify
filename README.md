# Fancify

Fancify is an Obsidian plugin for creating custom formatting tools. You define tools, create variants with CSS properties, and apply those variants to selected text or blocks from the command palette.

The plugin works locally in your vault. It does not use external services or send content from your notes.

## Features

- Create custom tools for inline formatting, block formatting, and line elements
- Add variants for each tool, name them, and use them as Obsidian commands
- Tag selected text or complete block ranges and render them in Live Preview and Reading View
- Insert horizontal lines from a command
- Remove existing Fancify formatting from a selection, either selectively or completely
- Manage tools and variants from the plugin settings

## Tool types

Fancify currently supports these tool types:

- `inline`: formats selected text inside a line, for example text color, background color, font size, or font style.
- `block`: formats whole Markdown blocks, for example paragraphs, lists, headings, callouts, or table cells.
- `element`: creates line elements. New element tools are currently created as vertical lines; horizontal lines are supported as their own style type.

Available properties depend on the tool type. Supported properties include color, background color, font family, font size, font weight, text alignment, borders, outlines, spacing, and line properties.

## Usage

1. Open **Settings -> Community plugins -> Fancify**.
2. Select **Create tool** and choose a tool type.
3. Choose the style properties this tool should control.
4. Create one or more variants and assign values to them.
5. Select text or blocks in a note.
6. Run the matching Fancify command from the command palette.

Each variant is registered as its own Obsidian command. The command name either comes from the variant's `commandName` field or is built from the tool name and variant name.

## Removing formatting

Fancify registers fixed commands for removing existing formatting:

- **Remove all styles** removes all Fancify tag pairs in the current selection.
- **Remove selected style...** asks for a specific formatting style and removes only that style.
- **Remove next horizontal line** removes the next horizontal Fancify line in the editor.

Matching remove actions also appear in the editor context menu when removable Fancify styles are detected in the selection.

## Markdown syntax

Fancify stores formatting as short tag pairs directly in Markdown. The plugin detects those tags, hides them in preview, and renders them through CSS classes.

The basic principle looks like this:

```md
{{...}}formatted text{{...}}
```

The concrete tag values are generated automatically. They should not be edited manually because they encode the tool, variant, and pair assignment.

## Installation

For manual installation, copy these files into your vault's plugin folder:

```text
<Vault>/.obsidian/plugins/fancify-plugin/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

Then enable the plugin in **Settings -> Community plugins**.

## Development

Requirements:

- Node.js 18 or newer
- npm

Install dependencies:

```bash
npm install
```

Start development mode with watch builds:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

The build creates `main.js` in the plugin root. Releases must provide `manifest.json`, `main.js`, and `styles.css`.

## Privacy

Fancify works offline and processes note content locally in Obsidian. The plugin contains no telemetry, no hidden network calls, and no cloud integration.

## Notes and limitations

- Fancify tags are part of the Markdown text. When sharing notes without the plugin installed, those tags remain visible.
- Code blocks, inline code, table content in ignored areas, math, Mermaid, and similar special areas are intentionally skipped or handled conservatively during rendering.
- A large number of nested or overlapping styles can make the Markdown source harder to read.
- The plugin is not marked as desktop-only in the manifest and can generally be loaded on mobile. Mobile workflows should be checked carefully for selection behavior and performance.

## License

This project is licensed under the `0-BSD` license.
