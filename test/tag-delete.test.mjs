import assert from "node:assert/strict";
import { EditorSelection, EditorState } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { createTagDeleteTransaction, getTagDeleteRanges } = load(
	"../src/editor/decorations/tag-delete.ts",
);

const tag = "{{aaaaaa}}";

function token(from) {
	return {
		from,
		to: from + tag.length,
		groupId: "aaaaaa",
		tagPrefix: "{{aaaa",
		counterIndex: 0,
		text: tag,
		cssClass: "fancify-mark-test",
		styleType: "inline",
	};
}

function pair(openingFrom, closingFrom) {
	return {
		openingTag: token(openingFrom),
		closingTag: token(closingFrom),
	};
}

function applyDelete(doc, selection, tagPairs, direction) {
	const state = EditorState.create({
		doc,
		extensions: [EditorState.allowMultipleSelections.of(true)],
		selection,
	});
	const transaction = createTagDeleteTransaction(
		state,
		getTagDeleteRanges(tagPairs),
		direction,
	);
	if (!transaction) {
		return null;
	}

	const updatedState = state.update(transaction).state;
	return {
		doc: updatedState.doc.toString(),
		ranges: updatedState.selection.ranges.map((range) => ({
			from: range.from,
			to: range.to,
		})),
	};
}

const tests = [
	{
		name: "Backspace after a valid tag deletes the previous visible character",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + tag.length),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: `a${tag}cd${tag}ef`,
				ranges: [{ from: openingFrom - 1, to: openingFrom - 1 }],
			});
		},
	},
	{
		name: "Delete before a valid tag deletes the next visible character",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.deepStrictEqual(result, {
				doc: `ab${tag}d${tag}ef`,
				ranges: [{ from: openingFrom + tag.length, to: openingFrom + tag.length }],
			});
		},
	},
	{
		name: "Backspace before a tag returns null so CodeMirror handles normal deletion",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Delete after a tag returns null so CodeMirror handles normal deletion",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + tag.length),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Backspace inside a valid tag deletes the previous visible character",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + 3),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: `a${tag}cd${tag}ef`,
				ranges: [{ from: openingFrom - 1, to: openingFrom - 1 }],
			});
		},
	},
	{
		name: "Delete inside a valid tag deletes the next visible character",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + 3),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.deepStrictEqual(result, {
				doc: `ab${tag}d${tag}ef`,
				ranges: [{ from: openingFrom + tag.length, to: openingFrom + tag.length }],
			});
		},
	},
	{
		name: "Delete removing the last inner character removes the adjacent tag pair",
		run() {
			const doc = `ab${tag}c${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + tag.length),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.deepStrictEqual(result, {
				doc: "abef",
				ranges: [{ from: openingFrom, to: openingFrom }],
			});
		},
	},
	{
		name: "Backspace removing the last inner character removes the adjacent tag pair",
		run() {
			const doc = `ab${tag}c${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(closingFrom),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: "abef",
				ranges: [{ from: openingFrom, to: openingFrom }],
			});
		},
	},
	{
		name: "Delete through a tag removes the pair when the tags become adjacent",
		run() {
			const doc = `ab${tag}c${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(openingFrom + 3),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.deepStrictEqual(result, {
				doc: "abef",
				ranges: [{ from: openingFrom, to: openingFrom }],
			});
		},
	},
	{
		name: "Backspace through a tag removes the pair when the tags become adjacent",
		run() {
			const doc = `ab${tag}c${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(closingFrom + 3),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: "abef",
				ranges: [{ from: openingFrom, to: openingFrom }],
			});
		},
	},
	{
		name: "Backspace after a standalone closing tag line returns null",
		run() {
			const doc = `${tag}\nAlpha\n${tag}\nBeta`;
			const closingFrom = tag.length + 1 + "Alpha".length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(closingFrom + tag.length + 1),
				[pair(0, closingFrom)],
				-1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Delete before a standalone opening tag line returns null",
		run() {
			const doc = `Alpha\n${tag}\nBeta\n${tag}`;
			const openingFrom = "Alpha".length + 1;
			const closingFrom = openingFrom + tag.length + 1 + "Beta".length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor("Alpha".length),
				[pair(openingFrom, closingFrom)],
				1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Mixed cursors keep normal character deletion when another cursor skips a tag",
		run() {
			const doc = `ab${tag}cd${tag}ef`;
			const openingFrom = 2;
			const closingFrom = 2 + tag.length + 2;
			const result = applyDelete(
				doc,
				EditorSelection.create([
					EditorSelection.cursor(openingFrom + tag.length),
					EditorSelection.cursor(doc.length),
				]),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: `a${tag}cd${tag}e`,
				ranges: [
					{ from: openingFrom - 1, to: openingFrom - 1 },
					{ from: doc.length - 2, to: doc.length - 2 },
				],
			});
		},
	},
	{
		name: "Backspace inside a leading tag prevents tag deletion",
		run() {
			const doc = `${tag}A${tag}`;
			const closingFrom = tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(3),
				[pair(0, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc,
				ranges: [{ from: 0, to: 0 }],
			});
		},
	},
	{
		name: "Plain Backspace returns null so CodeMirror handles normal deletion",
		run() {
			const result = applyDelete(
				"Alpha",
				EditorSelection.cursor(3),
				[],
				-1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Selections without tags return null so CodeMirror handles them normally",
		run() {
			const result = applyDelete(
				"Alpha",
				EditorSelection.range(1, 4),
				[],
				-1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Selections touching one valid tag delete both paired tags",
		run() {
			const doc = `A${tag}B${tag}C`;
			const openingFrom = 1;
			const closingFrom = 1 + tag.length + 1;
			const result = applyDelete(
				doc,
				EditorSelection.range(openingFrom, openingFrom + tag.length),
				[pair(openingFrom, closingFrom)],
				-1,
			);

			assert.deepStrictEqual(result, {
				doc: "ABC",
				ranges: [{ from: openingFrom, to: openingFrom }],
			});
		},
	},
	{
		name: "Unpaired tags do not trigger the custom delete path",
		run() {
			const doc = `A${tag}B`;
			const result = applyDelete(
				doc,
				EditorSelection.cursor(1 + tag.length),
				[],
				-1,
			);

			assert.equal(result, null);
		},
	},
	{
		name: "Stale paired tag ranges do not trigger the custom delete path",
		run() {
			const doc = "ab0123456789cd0123456789ef";
			const result = applyDelete(
				doc,
				EditorSelection.cursor(2 + tag.length),
				[pair(2, 2 + tag.length + 2)],
				-1,
			);

			assert.equal(result, null);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} tag-delete checks.`);
