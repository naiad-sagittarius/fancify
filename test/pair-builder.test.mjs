import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { getHiddenTagRanges, pairTokens } = load("../src/editor/decorations/pair-builder.ts");

function token(from, to, groupId) {
	return {
		from,
		to,
		groupId,
		tagPrefix: "{{aaaa",
		counterIndex: 0,
		text: "{{aaaaaa}}",
		cssClass: "fancify-mark-test",
		styleType: "inline",
	};
}

function lineToken(from, to, groupId, styleType = "horizontal-line") {
	return {
		...token(from, to, groupId),
		cssClass:
			styleType === "vertical-line"
				? "fancify-line fancify-line-vertical"
				: "fancify-line fancify-line-horizontal",
		styleType,
	};
}

const tests = [
	{
		name: "pairTokens keeps tag ranges derivable from paired tags",
		run() {
			const result = pairTokens(
				[token(0, 10, "aaaaaa"), token(14, 24, "aaaaaa")],
				true,
			);

			assert.equal(Object.hasOwn(result, "tagRanges"), false);
			assert.deepStrictEqual(
				result.tagPairs.map((pair) => [
					{ from: pair.openingTag.from, to: pair.openingTag.to },
					{ from: pair.closingTag.from, to: pair.closingTag.to },
				]),
				[[{ from: 0, to: 10 }, { from: 14, to: 24 }]],
			);
			assert.deepStrictEqual(result.invalidTags, []);
		},
	},
	{
		name: "pairTokens reports unpaired tags as invalid after a full scan",
		run() {
			const result = pairTokens([token(0, 10, "aaaaaa")], true);

			assert.deepStrictEqual(result.tagPairs, []);
			assert.deepStrictEqual(
				result.invalidTags.map((invalidTag) => ({
					from: invalidTag.from,
					to: invalidTag.to,
					reason: invalidTag.reason,
				})),
				[{ from: 0, to: 10, reason: "unpaired" }],
			);
		},
	},
	{
		name: "pairTokens treats a single horizontal line marker as unpaired",
		run() {
			const result = pairTokens([lineToken(0, 10, "aaaaaa")], true);

			assert.deepStrictEqual(
				result.invalidTags.map((invalidTag) => ({
					from: invalidTag.from,
					to: invalidTag.to,
					reason: invalidTag.reason,
				})),
				[{ from: 0, to: 10, reason: "unpaired" }],
			);
			assert.deepStrictEqual(result.tagPairs, []);
			assert.deepStrictEqual(result.nodes, []);
		},
	},
	{
		name: "pairTokens renders directly adjacent horizontal line pairs as single nodes",
		run() {
			const result = pairTokens(
				[
					lineToken(0, 10, "aaaaaa"),
					lineToken(10, 20, "aaaaaa"),
				],
				true,
			);

			assert.deepStrictEqual(result.invalidTags, []);
			assert.deepStrictEqual(
				result.tagPairs.map((pair) => [
					{ from: pair.openingTag.from, to: pair.openingTag.to },
					{ from: pair.closingTag.from, to: pair.closingTag.to },
				]),
				[[{ from: 0, to: 10 }, { from: 10, to: 20 }]],
			);
			assert.deepStrictEqual(result.nodes, [
				{
					from: 0,
					to: 20,
					cssClass: "fancify-line fancify-line-horizontal",
					styleType: "horizontal-line",
				},
			]);
			assert.deepStrictEqual(getHiddenTagRanges(result.tagPairs), []);
		},
	},
	{
		name: "pairTokens does not render separated horizontal line pairs",
		run() {
			const result = pairTokens(
				[
					lineToken(0, 10, "aaaaaa"),
					lineToken(14, 24, "aaaaaa"),
				],
				true,
			);

			assert.deepStrictEqual(result.tagPairs, []);
			assert.deepStrictEqual(result.invalidTags, []);
		},
	},
	{
		name: "pairTokens treats vertical line markers as block ranges",
		run() {
			const result = pairTokens(
				[
					lineToken(0, 10, "aaaaaa", "vertical-line"),
					lineToken(14, 24, "aaaaaa", "vertical-line"),
				],
				true,
			);

			assert.deepStrictEqual(result.invalidTags, []);
			assert.deepStrictEqual(
				result.tagPairs.map((pair) => [
					{ from: pair.openingTag.from, to: pair.openingTag.to },
					{ from: pair.closingTag.from, to: pair.closingTag.to },
				]),
				[[{ from: 0, to: 10 }, { from: 14, to: 24 }]],
			);
			assert.deepStrictEqual(result.nodes, [
				{
					from: 10,
					to: 14,
					cssClass: "fancify-line fancify-line-vertical",
					styleType: "vertical-line",
				},
			]);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} pair-builder checks.`);
