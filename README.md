# Fancify

Fancify is an Obsidian plugin that allows you to create custom formatting tools. You can define tools and create variants with CSS properties, which you can then apply to selected text or blocks using the command palette.

## Features

- Create custom tools for inline and block formatting in the plugin settings
- Add variants for each tool, name and use them as Obsidian commands
- Format selected text or complete block ranges
- Insert horizontal and vertical lines
- Styling visible in Live Preview and Reading View
- Remove existing formatting from a selection either selectively or completely

## Tool types

Fancify supports theese tool types:

### inline
-> for CSS inline styles

- color
- background-color
- font-family
- font-size
- font-weight
- font-style
- vertical-align
- text-decoration
- border-radius
- outline-color
- outline-style
- outline-width
- outline-offset

### block
-> for CSS block styles (automatically selects whole Markdown elements such as paragraphs)

- color
- background-color
- font-family
- font-size
- font-weight
- font-style
- text-align
- text-decoration
- padding (including: -right, -left, -top, -bottom)
- margin (including: -right, -left, -top, -bottom)
- border-color (including: -right, -left, -top, -bottom)
- border-style (including: -right, -left, -top, -bottom)
- border-width (including: -right, -left, -top, -bottom)
- border-radius
- outline-color
- outline-style
- outline-width
- outline-offset

### element
-> for adding custom vertical and horizontal lines

- line color
- line thickness
- line style
- line radius

## Usage

1. Open **Settings -> Community plugins -> Fancify**.
2. Select **Create tool** and choose a tool type.
3. Choose the style properties this tool should adjust.
4. Create one or more variants and assign values to them.
5. Select text or blocks in a note.
6. Run the matching Fancify command from the command palette.

Each variant is registered as its own Obsidian command. Fancify automatically generates the command name from the tool variant name. To change the command name, simply rename it in the "Set custom command name" field in the variant's settings.

Below the tool list on the settings page, you can also export or import your tools and variants.

## Remove formatting

Select formatted text and run one of the following commands:

- **Remove all styles**: Removes all Fancify styles from the current selection (inline styles are split, whereas block styles are removed entirely)
- **Remove selected style...**: Shows all applied variants and removes only the selected style
- **Remove next horizontal line**: Removes the next horizontal Fancify line in the editor (Alternatively, click on the line to remove it)

Remove actions also appear in the editor context menu when styles are detected in the selection.

## Markdown syntax

Fancify stores formatting as short tag pairs directly in Markdown. The plugin detects those tags, hides them in preview, and renders them through CSS classes.

The basic principle looks like this:

```md
{{aaaaaa}}formatted text{{aaaaaa}}
```

The concrete tag values are generated automatically using alphanumeric characters. The first two characters represent the tool, the next two represent the variant, and the final two are the identification key for each tag pair. They should not be edited manually because they encode the tool, variant, and pair assignment.

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

Installation (as usual):

```bash
npm install

npm run dev

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

- Fancify tags are part of the Markdown text. When exporting or opening notes without the plugin installed, those tags become visible.
- Furthermore, tags are counted as a new word, which can lead to additional words.
- Each tag pair uses exactly six alphanumeric characters, leading to a limited amount of tools, variants and usage per document. Currently, the limit for tools, variants per tool and usage per variant per document are each 3,844. The overall variant limit is 14,776,336, which I personally thought of as enough :).
- Code blocks, inline code, table content, math, Mermaid, and similar special areas are intentionally skipped during rendering.
- The plugin can generally be loaded on mobile.

## License

This project is licensed under the `MIT` license.
