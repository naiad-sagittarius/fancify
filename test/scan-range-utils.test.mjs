import assert from "node:assert/strict";
import { Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const {
	expandRanges,
	intersectRanges,
	mergeRanges,
	normaliseRanges,
	subtractRanges,
} = load("../src/editor/decorations/scan-range-utils.ts");
const { filterStyledRangesByExclusions } = load(
	"../src/editor/decorations/styled-range-filter.ts",
);
const {
	expandLineRangeToParagraphs,
} = load("../src/editor/paragraph-ranges.ts");
const {
	collectMarkdownSyntaxExclusions,
	collectTextBlockElementExclusions,
} = load(
	"../src/editor/decorations/text-exclusion-collector.ts",
);

const tests = [
	{
		name: "mergeRanges sorts deterministically and merges touching ranges",
		run() {
			assert.deepStrictEqual(
				mergeRanges([
					{ from: 5, to: 7 },
					{ from: 0, to: 2 },
					{ from: 2, to: 4 },
					{ from: 4, to: 5 },
					{ from: 9, to: 10 },
				]),
				[
					{ from: 0, to: 7 },
					{ from: 9, to: 10 },
				],
			);
		},
	},
	{
		name: "normaliseRanges clamps to the document and drops empty ranges",
		run() {
			assert.deepStrictEqual(
				normaliseRanges(
					[
						{ from: -4, to: 3 },
						{ from: 3, to: 8 },
						{ from: 12, to: 40 },
						{ from: 20, to: 20 },
					],
					20,
				),
				[
					{ from: 0, to: 8 },
					{ from: 12, to: 20 },
				],
			);
		},
	},
	{
		name: "expandRanges applies the buffer and clamps the result",
		run() {
			assert.deepStrictEqual(
				expandRanges(
					[
						{ from: 3, to: 5 },
						{ from: 14, to: 16 },
					],
					18,
					3,
				),
				[
					{ from: 0, to: 8 },
					{ from: 11, to: 18 },
				],
			);
		},
	},
	{
		name: "subtractRanges handles nested and unsorted exclusions",
		run() {
			assert.deepStrictEqual(
				subtractRanges(
					[{ from: 0, to: 12 }],
					[
						{ from: 8, to: 12 },
						{ from: 3, to: 5 },
						{ from: 5, to: 6 },
					],
				),
				[
					{ from: 0, to: 3 },
					{ from: 6, to: 8 },
				],
			);
		},
	},
	{
		name: "intersectRanges keeps matches for unsorted source ranges",
		run() {
			assert.deepStrictEqual(
				intersectRanges(
					[
						{ from: 10, to: 14, cssClass: "b" },
						{ from: 0, to: 4, cssClass: "a" },
					],
					[{ from: 2, to: 12 }],
				),
				[
					{ from: 2, to: 4, cssClass: "a" },
					{ from: 10, to: 12, cssClass: "b" },
				],
			);
		},
	},
	{
		name: "filterStyledRangesByExclusions splits styled ranges around exclusions",
		run() {
			assert.deepStrictEqual(
				filterStyledRangesByExclusions(
					[
						{
							from: 0,
							to: 12,
							cssClass: "fancify-block-test",
							styleType: "block",
						},
					],
					[
						{ from: 3, to: 5 },
						{ from: 8, to: 10 },
					],
				),
				[
					{
						from: 0,
						to: 3,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
					{
						from: 5,
						to: 8,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
					{
						from: 10,
						to: 12,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs expands partial selections to paragraph edges",
		run() {
			const lines = [
				"first paragraph",
				"continues here",
				"",
				"second paragraph",
				"continues too",
			];

			assert.deepStrictEqual(
				expandLineRangeToParagraphs({
					fromLine: 1,
					toLine: 3,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				{ fromLine: 0, toLine: 4 },
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs ignores blank-only selections",
		run() {
			const lines = ["first paragraph", "", "second paragraph"];

			assert.equal(
				expandLineRangeToParagraphs({
					fromLine: 1,
					toLine: 1,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				null,
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs treats markdown headings as separate blocks",
		run() {
			const lines = ["# Heading", "paragraph text", "more text"];

			assert.deepStrictEqual(
				expandLineRangeToParagraphs({
					fromLine: 0,
					toLine: 0,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				{ fromLine: 0, toLine: 0 },
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs expands list selections across the list block",
		run() {
			const lines = [
				"intro",
				"",
				"- first",
				"  continuation",
				"- second",
				"",
				"outro",
			];

			assert.deepStrictEqual(
				expandLineRangeToParagraphs({
					fromLine: 3,
					toLine: 3,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				{ fromLine: 2, toLine: 4 },
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs expands fenced code selections to the fence",
		run() {
			const lines = ["before", "```ts", "const value = 1;", "```", "after"];

			assert.deepStrictEqual(
				expandLineRangeToParagraphs({
					fromLine: 2,
					toLine: 2,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				{ fromLine: 1, toLine: 3 },
			);
		},
	},
	{
		name: "expandLineRangeToParagraphs treats standalone Fancify tags as boundaries",
		run() {
			const lines = ["{{acaaaa}}", "- first", "- second", "{{acaaaa}}"];

			assert.deepStrictEqual(
				expandLineRangeToParagraphs({
					fromLine: 1,
					toLine: 2,
					firstLine: 0,
					lastLine: lines.length - 1,
					getLineText: (lineNumber) => lines[lineNumber],
				}),
				{ fromLine: 1, toLine: 2 },
			);
		},
	},
	{
		name: "collectMarkdownSyntaxExclusions uses Lezer GFM table nodes",
		run() {
			const doc = Text.of([
				"before",
				"",
				"| A | |",
				"| --- | --- |",
				"| | D |",
				"",
				"after",
			]);

			assert.deepStrictEqual(collectMarkdownSyntaxExclusions(doc), [
				{
					from: doc.line(3).from,
					to: doc.line(6).from,
				},
			]);
		},
	},
	{
		name: "collectMarkdownSyntaxExclusions accepts empty GFM table headers",
		run() {
			const doc = Text.of([
				"| | |",
				"| :-: | :-: |",
				"| One | Two |",
			]);

			assert.deepStrictEqual(collectMarkdownSyntaxExclusions(doc), [
				{
					from: 0,
					to: doc.length,
				},
			]);
		},
	},
	{
		name: "collectMarkdownSyntaxExclusions rejects pipe text without a valid delimiter row",
		run() {
			const doc = Text.of([
				"A | B",
				"",
				"| A | B |",
				"| --- |",
				"| C | D |",
				"",
				"A \\| B",
				"A `|` B",
			]);

			assert.deepStrictEqual(collectMarkdownSyntaxExclusions(doc), []);
		},
	},
	{
		name: "collectMarkdownSyntaxExclusions uses Lezer block nodes for code and horizontal rules",
		run() {
			const doc = Text.of([
				"before",
				"",
				"```ts",
				"const value = 1;",
				"```",
				"",
				"---",
				"",
				"    indented code",
				"",
				"after",
			]);

			assert.deepStrictEqual(collectMarkdownSyntaxExclusions(doc), [
				{
					from: doc.line(3).from,
					to: doc.line(6).from,
				},
				{
					from: doc.line(7).from,
					to: doc.line(8).from,
				},
				{
					from: doc.line(9).from,
					to: doc.line(10).from,
				},
			]);
		},
	},
	{
		name: "collectTextBlockElementExclusions keeps math block handling outside Lezer",
		run() {
			const doc = Text.of([
				"before",
				"$$",
				"x = 1",
				"$$",
				"after",
			]);

			assert.deepStrictEqual(collectTextBlockElementExclusions(doc), [
				{
					from: doc.line(2).from,
					to: doc.line(5).from,
				},
			]);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} range utility checks.`);
