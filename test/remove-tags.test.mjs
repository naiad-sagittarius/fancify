import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const {
	getRemovableVariantsForSelection,
	removeSelectedTagPairs,
	removeVariantStylesFromSelection,
} = load("../src/commands/remove-tags.ts");
const { rebuildTagPrefixLookup } = load("../src/editor/decorations/tag-scanner.ts");

const blockTagPrefix = "{{acaa";
const inlineTagPrefix = "{{aaaa";
const otherInlineTagPrefix = "{{abaa";
const blockTag0 = "{{acaaaa}}";
const blockTag1 = "{{acaaab}}";
const inlineTag0 = "{{aaaaaa}}";
const inlineTag1 = "{{aaaaab}}";
const otherInlineTag0 = "{{abaaaa}}";

class MockEditor {
	constructor(value) {
		this.value = value;
		this.selectionFrom = 0;
		this.selectionTo = 0;
		this.refreshLines();
	}

	getValue() {
		return this.value;
	}

	getLine(lineNumber) {
		return this.lines[lineNumber] ?? "";
	}

	lastLine() {
		return this.lines.length - 1;
	}

	listSelections() {
		return [
			{
				anchor: this.offsetToPos(this.selectionFrom),
				head: this.offsetToPos(this.selectionTo),
			},
		];
	}

	offsetToPos(offset) {
		const safeOffset = Math.max(0, Math.min(offset, this.value.length));
		let currentOffset = 0;

		for (let lineNumber = 0; lineNumber < this.lines.length; lineNumber += 1) {
			const line = this.lines[lineNumber] ?? "";
			const lineEnd = currentOffset + line.length;

			if (safeOffset <= lineEnd || lineNumber === this.lines.length - 1) {
				return {
					line: lineNumber,
					ch: safeOffset - currentOffset,
				};
			}

			currentOffset = lineEnd + 1;
		}

		return { line: 0, ch: 0 };
	}

	posToOffset(position) {
		let offset = 0;
		const line = Math.max(0, Math.min(position.line, this.lines.length - 1));

		for (let lineNumber = 0; lineNumber < line; lineNumber += 1) {
			offset += (this.lines[lineNumber]?.length ?? 0) + 1;
		}

		return offset + Math.max(0, Math.min(position.ch, this.lines[line]?.length ?? 0));
	}

	replaceRange(text, fromPosition, toPosition) {
		const from = this.posToOffset(fromPosition);
		const to = this.posToOffset(toPosition);
		this.value = `${this.value.slice(0, from)}${text}${this.value.slice(to)}`;
		this.refreshLines();
	}

	selectNeedle(needle, occurrence = 0) {
		let from = -1;
		let searchFrom = 0;

		for (let index = 0; index <= occurrence; index += 1) {
			from = this.value.indexOf(needle, searchFrom);
			if (from === -1) {
				throw new Error(`Needle not found: ${needle}`);
			}
			searchFrom = from + needle.length;
		}

		this.selectionFrom = from;
		this.selectionTo = from + needle.length;
	}

	selectSpan(fromNeedle, toNeedle) {
		const from = this.value.indexOf(fromNeedle);
		const to = this.value.indexOf(toNeedle);
		if (from === -1 || to === -1) {
			throw new Error(`Needle not found: ${fromNeedle} or ${toNeedle}`);
		}

		this.selectionFrom = from;
		this.selectionTo = to + toNeedle.length;
	}

	refreshLines() {
		this.lines = this.value.split("\n");
	}
}

function configureTagLookup() {
	rebuildTagPrefixLookup([
		{
			name: "Block",
			type: "block",
			variants: [{ tagPrefix: blockTagPrefix, variantTokens: {} }],
		},
		{
			name: "Inline",
			type: "inline",
			variants: [
				{ tagPrefix: inlineTagPrefix, variantTokens: {} },
				{ tagPrefix: otherInlineTagPrefix, variantTokens: {} },
			],
		},
	]);
}

const configuredTools = [
	{
		name: "Block",
		type: "block",
		variants: [
			{
				name: "Block variant",
				tagPrefix: blockTagPrefix,
			},
		],
	},
	{
		name: "Inline",
		type: "inline",
		variants: [
			{
				name: "Inline variant",
				tagPrefix: inlineTagPrefix,
			},
			{
				name: "Other inline variant",
				tagPrefix: otherInlineTagPrefix,
			},
		],
	},
];

const tests = [
	{
		name: "removeSelectedTagPairs removes a block pair when selection overlaps all enclosed blocks",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB\n\nC${blockTag0}`);
			editor.selectionFrom = editor.getValue().indexOf("A");
			editor.selectionTo = editor.getValue().indexOf("C") + 1;

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(editor.getValue(), "A\n\nB\n\nC");
		},
	},
	{
		name: "removeSelectedTagPairs splits a block pair around an inner block selection",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB\n\nC${blockTag0}`);
			editor.selectNeedle("B");

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(
				editor.getValue(),
				`${blockTag0}A${blockTag0}\n\nB\n\n${blockTag1}C${blockTag1}`,
			);
		},
	},
	{
		name: "removeSelectedTagPairs removes the opening tag when the closing tag is selected",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB${blockTag0}`);
			editor.selectNeedle(blockTag0, 1);

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(editor.getValue(), "A\n\nB");
		},
	},
	{
		name: "removeSelectedTagPairs removes the closing tag when the opening tag is selected",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB${blockTag0}`);
			editor.selectNeedle(blockTag0);

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(editor.getValue(), "A\n\nB");
		},
	},
	{
		name: "removeSelectedTagPairs removes a block pair when a single touched block has no repair side",
		run() {
			const editor = new MockEditor(`${blockTag0}A${blockTag0}`);
			editor.selectNeedle(blockTag0, 1);

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(editor.getValue(), "A");
		},
	},
	{
		name: "removeSelectedTagPairs keeps inline split behaviour unchanged",
		run() {
			const editor = new MockEditor(`${inlineTag0}A B C${inlineTag0}`);
			editor.selectNeedle("B");

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(
				editor.getValue(),
				`${inlineTag0}A ${inlineTag0}B${inlineTag1} C${inlineTag1}`,
			);
		},
	},
	{
		name: "removeSelectedTagPairs removes standalone block marker lines",
		run() {
			const editor = new MockEditor(`${blockTag0}\nA\n\nB\n\nC\n${blockTag0}`);
			editor.selectSpan("A", "C");

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(editor.getValue(), "A\n\nB\n\nC");
		},
	},
	{
		name: "removeSelectedTagPairs splits standalone block markers around an inner block",
		run() {
			const editor = new MockEditor(`${blockTag0}\nA\n\nB\n\nC\n${blockTag0}`);
			editor.selectNeedle("B");

			assert.equal(removeSelectedTagPairs(editor), true);
			assert.equal(
				editor.getValue(),
				`${blockTag0}\nA\n${blockTag0}\n\nB\n\n${blockTag1}\nC\n${blockTag1}`,
			);
		},
	},
	{
		name: "getRemovableVariantsForSelection returns variants touching the selection",
		run() {
			const editor = new MockEditor(
				`${inlineTag0}A${inlineTag0} ${otherInlineTag0}B${otherInlineTag0}`,
			);
			editor.selectSpan("A", "B");

			const removableVariants = getRemovableVariantsForSelection(
				editor,
				configuredTools,
			);

			assert.deepEqual(
				removableVariants.map((variant) => variant.menuTitle),
				[
					"Inline / Inline variant",
					"Inline / Other inline variant",
				],
			);
		},
	},
	{
		name: "removeVariantStylesFromSelection removes only the selected variant",
		run() {
			const editor = new MockEditor(
				`${inlineTag0}${otherInlineTag0}A${otherInlineTag0}${inlineTag0}`,
			);
			editor.selectNeedle("A");

			assert.equal(
				removeVariantStylesFromSelection(editor, {
					tagPrefix: otherInlineTagPrefix,
					variantName: "Other inline variant",
					styleType: "inline",
					selectionRanges: [
						{
							from: editor.selectionFrom,
							to: editor.selectionTo,
						},
					],
				}),
				"removed",
			);
			assert.equal(editor.getValue(), `${inlineTag0}A${inlineTag0}`);
		},
	},
	{
		name: "removeVariantStylesFromSelection splits a partially selected variant",
		run() {
			const editor = new MockEditor(`${inlineTag0}A B C${inlineTag0}`);
			editor.selectNeedle("B");

			assert.equal(
				removeVariantStylesFromSelection(editor, {
					tagPrefix: inlineTagPrefix,
					variantName: "Inline variant",
					styleType: "inline",
					selectionRanges: [
						{
							from: editor.selectionFrom,
							to: editor.selectionTo,
						},
					],
				}),
				"removed",
			);
			assert.equal(
				editor.getValue(),
				`${inlineTag0}A ${inlineTag0}B${inlineTag1} C${inlineTag1}`,
			);
		},
	},
];

configureTagLookup();

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} remove-tags checks.`);
