import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { applyVariant } = load("../src/commands/apply-variant.ts");
const { buildVariantTag, maxCounterIndex } = load("../src/editor/tag-format.ts");
const { rebuildTagPrefixLookup } = load("../src/editor/decorations/tag-scanner.ts");

const blockTagPrefix = "{{acaa";
const sameToolBlockTagPrefix = "{{acab";
const horizontalLineTagPrefix = "{{adaa";
const verticalLineTagPrefix = "{{aeaa";
const inlineTagPrefix = "{{aaaa";
const sameToolInlineTagPrefix = "{{aaab";
const otherInlineTagPrefix = "{{abaa";
const blockTag0 = "{{acaaaa}}";
const sameToolBlockTag0 = "{{acabaa}}";
const blockTag1 = "{{acaaab}}";
const blockTag2 = "{{acaaac}}";
const horizontalLineTag0 = "{{adaaaa}}";
const horizontalLinePair0 = `${horizontalLineTag0}${horizontalLineTag0}`;
const verticalLineTag0 = "{{aeaaaa}}";
const verticalLineTag1 = "{{aeaaab}}";
const inlineTag0 = "{{aaaaaa}}";
const inlineTag1 = "{{aaaaab}}";
const inlineTag2 = "{{aaaaac}}";
const sameToolInlineTag0 = "{{aaabaa}}";
const otherInlineTag0 = "{{abaaaa}}";

const blockVariant = {
	id: "block-variant",
	name: "Block",
	tagPrefix: blockTagPrefix,
	variantTokens: {},
};
const inlineVariant = {
	id: "inline-variant",
	name: "Inline",
	tagPrefix: inlineTagPrefix,
	variantTokens: {},
};
const sameToolInlineVariant = {
	id: "same-tool-inline-variant",
	name: "Same tool inline",
	tagPrefix: sameToolInlineTagPrefix,
	variantTokens: {},
};
const sameToolBlockVariant = {
	id: "same-tool-block-variant",
	name: "Same tool block",
	tagPrefix: sameToolBlockTagPrefix,
	variantTokens: {},
};
const horizontalLineVariant = {
	id: "horizontal-line-variant",
	name: "Horizontal line",
	tagPrefix: horizontalLineTagPrefix,
	variantTokens: {},
};
const verticalLineVariant = {
	id: "vertical-line-variant",
	name: "Vertical line",
	tagPrefix: verticalLineTagPrefix,
	variantTokens: {},
};
const otherInlineVariant = {
	id: "other-inline-variant",
	name: "Other inline",
	tagPrefix: otherInlineTagPrefix,
	variantTokens: {},
};

class MockEditor {
	constructor(value) {
		this.value = value;
		this.selectionFrom = 0;
		this.selectionTo = 0;
		this.transactions = [];
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

	getCursor(which) {
		const from = Math.min(this.selectionFrom, this.selectionTo);
		const to = Math.max(this.selectionFrom, this.selectionTo);

		return this.offsetToPos(which === "to" ? to : from);
	}

	getRange(fromPosition, toPosition) {
		const from = this.posToOffset(fromPosition);
		const to = this.posToOffset(toPosition);

		return this.value.slice(from, to);
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

	transaction(tx, origin) {
		this.transactions.push({ origin, tx });
		for (const change of [...(tx.changes ?? [])].sort((left, right) => {
			const leftFrom = this.posToOffset(left.from);
			const rightFrom = this.posToOffset(right.from);
			const leftTo = this.posToOffset(left.to ?? left.from);
			const rightTo = this.posToOffset(right.to ?? right.from);

			return rightFrom - leftFrom || rightTo - leftTo;
		})) {
			this.replaceRange(change.text, change.from, change.to ?? change.from);
		}
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

	setCursor(offset) {
		this.selectionFrom = offset;
		this.selectionTo = offset;
	}

	refreshLines() {
		this.lines = this.value.split("\n");
	}
}

function configureTagLookup() {
	rebuildTagPrefixLookup([
		{
			type: "block",
			variants: [blockVariant, sameToolBlockVariant],
		},
		{
			type: "inline",
			variants: [inlineVariant, sameToolInlineVariant, otherInlineVariant],
		},
		{
			type: "horizontal-line",
			variants: [horizontalLineVariant],
		},
		{
			type: "vertical-line",
			variants: [verticalLineVariant],
		},
	]);
}

const tests = [
	{
		name: "applyVariant applies an inline variant to unstyled text",
		run() {
			const editor = new MockEditor("Alpha");
			editor.selectNeedle("Alpha");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(editor.getValue(), `${inlineTag0}Alpha${inlineTag0}`);
			assert.equal(editor.transactions.length, 1);
			assert.equal(editor.transactions[0].origin, "fancify");
			assert.equal(editor.transactions[0].tx.changes.length, 2);
		},
	},
	{
		name: "applyVariant leaves an already styled inline selection unchanged",
		run() {
			const editor = new MockEditor(`${inlineTag0}Alpha${inlineTag0}`);
			editor.selectNeedle("Alpha");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(editor.getValue(), `${inlineTag0}Alpha${inlineTag0}`);
		},
	},
	{
		name: "applyVariant replaces an exact inline variant from the same tool",
		run() {
			const editor = new MockEditor(
				`${sameToolInlineTag0}Alpha${sameToolInlineTag0}`,
			);
			editor.selectNeedle("Alpha");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(editor.getValue(), `${inlineTag0}Alpha${inlineTag0}`);
		},
	},
	{
		name: "applyVariant keeps a same-tool inline variant when the range differs",
		run() {
			const editor = new MockEditor(
				`${sameToolInlineTag0}Alpha Beta${sameToolInlineTag0}`,
			);
			editor.selectNeedle("Alpha");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(
				editor.getValue(),
				`${sameToolInlineTag0}${inlineTag0}Alpha${inlineTag0} Beta${sameToolInlineTag0}`,
			);
		},
	},
	{
		name: "applyVariant keeps an exact inline variant from another tool",
		run() {
			const editor = new MockEditor(
				`${otherInlineTag0}Alpha${otherInlineTag0}`,
			);
			editor.selectNeedle("Alpha");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(
				editor.getValue(),
				`${otherInlineTag0}${inlineTag0}Alpha${inlineTag0}${otherInlineTag0}`,
			);
		},
	},
	{
		name: "applyVariant applies an inline variant across a partially styled selection without nesting",
		run() {
			const editor = new MockEditor(`A ${inlineTag0}B${inlineTag0} C`);
			editor.selectSpan("A", "C");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(editor.getValue(), `${inlineTag1}A B C${inlineTag1}`);
		},
	},
	{
		name: "applyVariant applies an inline variant from inside an existing variant range",
		run() {
			const editor = new MockEditor(`${inlineTag0}A B${inlineTag0} C`);
			editor.selectSpan("B", "C");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(
				editor.getValue(),
				`${inlineTag0}A ${inlineTag0}${inlineTag1}B C${inlineTag1}`,
			);
		},
	},
	{
		name: "applyVariant applies an inline variant into an existing variant range",
		run() {
			const editor = new MockEditor(`A ${inlineTag0}B C${inlineTag0}`);
			editor.selectSpan("A", "B");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(
				editor.getValue(),
				`${inlineTag1}A B${inlineTag1}${inlineTag2} C${inlineTag2}`,
			);
		},
	},
	{
		name: "applyVariant leaves the selected inline variant unchanged when other variants overlap",
		run() {
			const editor = new MockEditor(
				`${inlineTag0}${otherInlineTag0}A B C${otherInlineTag0}${inlineTag0}`,
			);
			editor.selectNeedle("B");

			applyVariant(editor, inlineVariant, "inline");

			assert.equal(
				editor.getValue(),
				`${inlineTag0}${otherInlineTag0}A B C${otherInlineTag0}${inlineTag0}`,
			);
		},
	},
	{
		name: "applyVariant leaves an already styled inner block unchanged",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB\n\nC${blockTag0}`);
			editor.selectNeedle("B");

			applyVariant(editor, blockVariant, "block");

			assert.equal(editor.getValue(), `${blockTag0}A\n\nB\n\nC${blockTag0}`);
		},
	},
	{
		name: "applyVariant replaces an exact block variant from the same tool",
		run() {
			const editor = new MockEditor(
				`${sameToolBlockTag0}\nAlpha\n${sameToolBlockTag0}`,
			);
			editor.selectNeedle("Alpha");

			applyVariant(editor, blockVariant, "block");

			assert.equal(editor.getValue(), `${blockTag0}\nAlpha\n${blockTag0}`);
		},
	},
	{
		name: "applyVariant leaves fully styled selected blocks unchanged",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB\n\nC${blockTag0}`);
			editor.selectSpan("A", "C");

			applyVariant(editor, blockVariant, "block");

			assert.equal(editor.getValue(), `${blockTag0}A\n\nB\n\nC${blockTag0}`);
		},
	},
	{
		name: "applyVariant applies a block variant across a partially styled block selection",
		run() {
			const editor = new MockEditor(`${blockTag0}A\n\nB${blockTag0}\n\nC`);
			editor.selectSpan("B", "C");

			applyVariant(editor, blockVariant, "block");

			assert.equal(
				editor.getValue(),
				`${blockTag0}A${blockTag0}\n\n${blockTag1}\nB\n\nC\n${blockTag1}`,
			);
		},
	},
	{
		name: "applyVariant leaves selected table cells unchanged",
		run() {
			const editor = new MockEditor("| A | B |\n|---|---|\n| C | D |");
			editor.selectNeedle("B");

			applyVariant(editor, blockVariant, "block");

			assert.equal(editor.getValue(), "| A | B |\n|---|---|\n| C | D |");
		},
	},
	{
		name: "applyVariant styles pipe text that Lezer does not parse as a GFM table",
		run() {
			const editor = new MockEditor("Alpha\n\nA | B\n\nBeta");
			editor.selectNeedle("A | B");

			applyVariant(editor, blockVariant, "block");

			assert.equal(
				editor.getValue(),
				`Alpha\n\n${blockTag0}\nA | B\n${blockTag0}\n\nBeta`,
			);
		},
	},
	{
		name: "applyVariant splits block ranges around excluded markdown blocks",
		run() {
			const cases = [
				"| A | B |\n|---|---|\n| C | D |",
				"| A | |\n|---|---|\n| | D |",
				"```js\nconst value = 1;\n```",
				"$$\nvalue\n$$",
				"---",
			];

			for (const excludedBlock of cases) {
				const editor = new MockEditor(`Alpha\n\n${excludedBlock}\n\nBeta`);
				editor.selectSpan("Alpha", "Beta");

				applyVariant(editor, blockVariant, "block");

				assert.equal(
					editor.getValue(),
					`${blockTag0}\nAlpha\n${blockTag0}\n\n${excludedBlock}\n\n${blockTag1}\nBeta\n${blockTag1}`,
				);
			}
		},
	},
	{
		name: "applyVariant reuses free counters before high existing counters",
		run() {
			const existingTag = buildVariantTag(blockTagPrefix, maxCounterIndex - 3);
			const editor = new MockEditor(
				`${existingTag}\n\nAlpha\n\n---\n\nBeta\n\n---\n\nGamma`,
			);
			editor.selectSpan("Alpha", "Gamma");

			applyVariant(editor, blockVariant, "block");

			assert.equal(
				editor.getValue(),
				`${existingTag}\n\n${blockTag0}\nAlpha\n${blockTag0}\n\n---\n\n${blockTag1}\nBeta\n${blockTag1}\n\n---\n\n${blockTag2}\nGamma\n${blockTag2}`,
			);
		},
	},
	{
		name: "applyVariant inserts a horizontal line marker with needed line breaks",
		run() {
			const editor = new MockEditor("Alpha");
			editor.setCursor(2);

			applyVariant(editor, horizontalLineVariant, "horizontal-line");

			assert.equal(editor.getValue(), `Al\n${horizontalLinePair0}\npha`);
			assert.equal(editor.transactions.length, 1);
			assert.equal(editor.transactions[0].origin, "fancify");
		},
	},
	{
		name: "applyVariant inserts horizontal line breaks only where missing",
		run() {
			const cases = [
				{
					source: "",
					cursor: 0,
					expected: `\n${horizontalLinePair0}\n`,
				},
				{
					source: "Alpha",
					cursor: "Alpha".length,
					expected: `Alpha\n${horizontalLinePair0}\n`,
				},
				{
					source: "Alpha",
					cursor: 0,
					expected: `\n${horizontalLinePair0}\nAlpha`,
				},
				{
					source: "Alpha\n\nBeta",
					cursor: "Alpha".length,
					expected: `Alpha\n${horizontalLinePair0}\n\nBeta`,
				},
				{
					source: "Alpha\n\nBeta",
					cursor: "Alpha\n\n".length,
					expected: `Alpha\n\n${horizontalLinePair0}\nBeta`,
				},
			];

			for (const testCase of cases) {
				const editor = new MockEditor(testCase.source);
				editor.setCursor(testCase.cursor);

				applyVariant(editor, horizontalLineVariant, "horizontal-line");

				assert.equal(editor.getValue(), testCase.expected);
			}
		},
	},
	{
		name: "applyVariant splits a containing block range before inserting a horizontal line",
		run() {
			const editor = new MockEditor(`${blockTag0}\nAlpha\nBeta\n${blockTag0}`);
			editor.setCursor(editor.getValue().indexOf("Alpha") + "Alpha".length);

			applyVariant(editor, horizontalLineVariant, "horizontal-line");

			assert.equal(
				editor.getValue(),
				`${blockTag0}\nAlpha\n${blockTag0}\n${horizontalLinePair0}\n${blockTag0}\n\nBeta\n${blockTag0}`,
			);
		},
	},
	{
		name: "applyVariant applies a vertical line to every touched block",
		run() {
			const editor = new MockEditor("Alpha");
			editor.selectNeedle("ph");

			applyVariant(editor, verticalLineVariant, "vertical-line");

			assert.equal(
				editor.getValue(),
				`${verticalLineTag0}\nAlpha\n${verticalLineTag0}`,
			);
			assert.equal(editor.transactions.length, 1);
			assert.equal(editor.transactions[0].origin, "fancify");
		},
	},
	{
		name: "applyVariant splits vertical line ranges around excluded markdown blocks",
		run() {
			const editor = new MockEditor("Alpha\n\n---\n\nBeta");
			editor.selectSpan("Alpha", "Beta");

			applyVariant(editor, verticalLineVariant, "vertical-line");

			assert.equal(
				editor.getValue(),
				`${verticalLineTag0}\nAlpha\n${verticalLineTag0}\n\n---\n\n${verticalLineTag1}\nBeta\n${verticalLineTag1}`,
			);
		},
	},
];

configureTagLookup();

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} apply-variant checks.`);
