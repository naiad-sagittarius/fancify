import assert from "node:assert/strict";
import { Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { buildFancifyDecorations } = load(
	"../src/editor/decorations/decoration-builder.ts",
);

function collectDecorations(decorationSet, to) {
	const ranges = [];

	decorationSet.between(0, to, (from, rangeTo, decoration) => {
		const range = {
			from,
			to: rangeTo,
			isReplace: decoration.isReplace === true,
			className: decoration.spec.class,
		};
		if (decoration.spec.attributes) {
			range.attributes = decoration.spec.attributes;
		}
		if (decoration.spec.widget) {
			range.hasWidget = true;
		}
		ranges.push(range);
	});

	return ranges;
}

const tests = [
	{
		name: "buildFancifyDecorations hides tag ranges with replace decorations",
		run() {
			const doc = Text.of(["{{aaaaaa}}body{{aaaaaa}}"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 10,
						to: 14,
						cssClass: "fancify-mark-test",
						styleType: "inline",
					},
				],
				doc,
				[
					{ from: 0, to: 10 },
					{ from: 14, to: 24 },
				],
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{ from: 0, to: 10, isReplace: true, className: undefined },
				{
					from: 10,
					to: 14,
					isReplace: false,
					className: "fancify-mark-test",
				},
				{ from: 14, to: 24, isReplace: true, className: undefined },
			]);
		},
	},
	{
		name: "buildFancifyDecorations can sort block line and tag replace decorations",
		run() {
			const doc = Text.of(["{{aaaaaa}}body{{aaaaaa}}"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 10,
						to: 14,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
				doc,
				[
					{ from: 0, to: 10 },
					{ from: 14, to: 24 },
				],
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-start fancify-block-end",
				},
				{ from: 0, to: 10, isReplace: true, className: undefined },
				{ from: 14, to: 24, isReplace: true, className: undefined },
			]);
		},
	},
	{
		name: "buildFancifyDecorations marks block edges at blank-line paragraph boundaries",
		run() {
			const doc = Text.of(["first", "second", "", "third"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-start",
				},
				{
					from: 6,
					to: 6,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-end",
				},
				{
					from: 13,
					to: 13,
					isReplace: false,
					className: "fancify-block-gap",
				},
				{
					from: 14,
					to: 14,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-start fancify-block-end",
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations keeps paragraph edges stable when the visible range starts inside a block",
		run() {
			const doc = Text.of(["first", "second", "third"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
				doc,
				[],
				[{ from: 6, to: doc.length }],
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 6,
					to: 6,
					isReplace: false,
					className: "fancify-block-test fancify-block-line",
				},
				{
					from: 13,
					to: 13,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-end",
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations renders list items as block lines",
		run() {
			const doc = Text.of(["- [ ] Task"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-list fancify-block-start fancify-block-end",
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations does not classify standalone indented lines as lists",
		run() {
			const doc = Text.of(["  Indented"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-block-test",
						styleType: "block",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-block-test fancify-block-line fancify-block-start fancify-block-end",
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations replaces horizontal line pairs with widgets",
		run() {
			const doc = Text.of(["{{haaaaa}}{{haaaaa}}"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: 20,
						cssClass: "fancify-line fancify-line-horizontal",
						styleType: "horizontal-line",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 20,
					isReplace: true,
					className: undefined,
					hasWidget: true,
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations keeps vertical list lines continuous across list items",
		run() {
			const doc = Text.of(["- Alpha", "- Beta", "- Gamma"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-line fancify-line-vertical",
						styleType: "vertical-line",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-line fancify-line-vertical fancify-block-line fancify-block-list fancify-block-start",
				},
				{
					from: 8,
					to: 8,
					isReplace: false,
					className:
						"fancify-line fancify-line-vertical fancify-block-line fancify-block-list",
				},
				{
					from: 15,
					to: 15,
					isReplace: false,
					className:
						"fancify-line fancify-line-vertical fancify-block-line fancify-block-list fancify-block-end",
				},
			]);
		},
	},
	{
		name: "buildFancifyDecorations renders vertical lines as block line classes",
		run() {
			const doc = Text.of(["Alpha", "Beta"]);
			const decorationSet = buildFancifyDecorations(
				[
					{
						from: 0,
						to: doc.length,
						cssClass: "fancify-line fancify-line-vertical",
						styleType: "vertical-line",
					},
				],
				doc,
			);

			assert.deepStrictEqual(collectDecorations(decorationSet, doc.length), [
				{
					from: 0,
					to: 0,
					isReplace: false,
					className:
						"fancify-line fancify-line-vertical fancify-block-line fancify-block-start",
				},
				{
					from: 6,
					to: 6,
					isReplace: false,
					className:
						"fancify-line fancify-line-vertical fancify-block-line fancify-block-end",
				},
			]);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} decoration-builder checks.`);
