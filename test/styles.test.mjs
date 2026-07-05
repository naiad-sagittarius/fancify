import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const projectRoot = new URL("../", import.meta.url);
const css = readProjectFile("styles.css");
const sourceText = readProjectFiles("src/")
	.map((filePath) => readProjectFile(filePath))
	.join("\n");
const cssAndSourceText = `${css}\n${sourceText}`;

function readProjectFile(filePath) {
	return readFileSync(new URL(filePath, projectRoot), "utf8");
}

function readProjectFiles(dirPath) {
	return readdirSync(new URL(dirPath, projectRoot), { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = `${dirPath}${entry.name}`;

			if (entry.isDirectory()) {
				return readProjectFiles(`${entryPath}/`);
			}

			return /\.(ts|tsx|js|mjs|css)$/.test(entry.name) ? [entryPath] : [];
		});
}

function getCssBlock(selector) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

	assert.ok(match, `Missing CSS block for ${selector}`);

	return match[1];
}

function getCssVariablesDefinedInStyles() {
	return [...css.matchAll(/(--fancify-[a-z0-9-]+)\s*:/g)].map(
		(match) => match[1],
	);
}

function getFancifyClassesDefinedInStyles() {
	const classes = new Set();
	const classNamePattern = /\.([a-zA-Z_][\w-]*)/g;
	let match;

	while ((match = classNamePattern.exec(css))) {
		if (match[1].startsWith("fancify-")) {
			classes.add(match[1]);
		}
	}

	return [...classes].sort();
}

const tests = [
	{
		name: "styles.css parses as CSS",
		run() {
			transformSync(css, { loader: "css" });
		},
	},
	{
		name: "Fancify CSS variables defined in styles.css are used",
		run() {
			const definedVariables = getCssVariablesDefinedInStyles();
			const unusedVariables = [...new Set(definedVariables)]
				.filter((variableName) => {
					const referenceCount = cssAndSourceText.split(variableName).length - 1;
					const definitionCount = definedVariables
						.filter((definedName) => definedName === variableName).length;

					return referenceCount === definitionCount;
				});

			assert.deepEqual(unusedVariables, []);
		},
	},
	{
		name: "Fancify CSS classes defined in styles.css are used by source",
		run() {
			const unusedClasses = getFancifyClassesDefinedInStyles()
				.filter((className) => !sourceText.includes(className));

			assert.deepEqual(unusedClasses, []);
		},
	},
	{
		name: "removed legacy and dead style hooks stay absent",
		run() {
			const removedStyleHooks = [
				"--fancify-line-height",
				"--fancify-line-continuation-gap",
				"lineHeightProperty",
				"lineContinuationGapProperty",
				"isDeprecated",
				"fancify-block-table-cell",
				"fancify-add-button",
				"fancify-page-title",
				"fancify-panel",
			];

			for (const styleHook of removedStyleHooks) {
				assert.equal(cssAndSourceText.includes(styleHook), false, styleHook);
			}
		},
	},
	{
		name: "number slider buttons keep icon glyphs centered",
		run() {
			const buttonBlock = getCssBlock(".fancify-number-slider-button");

			assert.match(buttonBlock, /display:\s*inline-flex;/);
			assert.match(buttonBlock, /align-items:\s*center;/);
			assert.match(buttonBlock, /justify-content:\s*center;/);
			assert.match(buttonBlock, /width:\s*28px;/);
			assert.match(buttonBlock, /height:\s*28px;/);
			assert.match(
				css,
				/\.fancify-number-slider-button-icon,\s*\.fancify-number-slider-button-icon svg\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/,
			);
		},
	},
	{
		name: "shared hover groups keep expected selector coverage",
		run() {
			assert.match(
				css,
				/\.fancify-row-actions:hover,[\s\S]*?\.fancify-color-picker-trigger:focus-visible\s*\{\s*background:\s*var\(--fancify-hover-bg\);/,
			);
			assert.match(
				css,
				/\.fancify-section-list-add:hover,[\s\S]*?\.fancify-custom-color-format-button:active\s*\{\s*background:\s*var\(--fancify-hover-bg\) !important;/,
			);
		},
	},
	{
		name: "shared muted text group keeps expected selector coverage",
		run() {
			assert.match(
				css,
				/\.fancify-home-header-version,[\s\S]*?\.fancify-suggest-meta\s*\{\s*color:\s*var\(--text-muted\);/,
			);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} style checks.`);
