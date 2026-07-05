import assert from "node:assert/strict";
import { Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { FancifyScanEngine } = load("../src/editor/decorations/scan-engine.ts");
const { rebuildTagPrefixLookup } = load(
	"../src/editor/decorations/tag-scanner.ts",
);

const tree = {
	iterate() {
		return undefined;
	},
};

function configureInlinePrefix() {
	rebuildTagPrefixLookup([
		{
			type: "inline",
			variants: [
				{
					tagPrefix: "{{aaaa",
					variantTokens: {
						color: "color-aaa",
					},
				},
			],
		},
	]);
}

function scan(source) {
	const doc = Text.of([source]);
	return new FancifyScanEngine().build(
		tree,
		doc,
		[{ from: 0, to: doc.length }],
	);
}

const tests = [
	{
		name: "FancifyScanEngine reports structurally valid tags with unknown prefixes",
		run() {
			configureInlinePrefix();
			const source = "{{aaaaaa}}body{{aaaaaa}} {{zzaaaa}}";
			const invalidFrom = source.indexOf("{{zzaaaa}}");
			const result = scan(source);

			assert.equal(result.tagPairs.length, 1);
			assert.deepStrictEqual(result.invalidTags.map((tag) => ({
				from: tag.from,
				to: tag.to,
				reason: tag.reason,
			})), [
				{
					from: invalidFrom,
					to: invalidFrom + "{{zzaaaa}}".length,
					reason: "unknown-prefix",
				},
			]);
		},
	},
	{
		name: "FancifyScanEngine reports known unpaired tags after a full scan",
		run() {
			configureInlinePrefix();
			const source = "Alpha {{aaaaaa}}";
			const invalidFrom = source.indexOf("{{aaaaaa}}");
			const result = scan(source);

			assert.deepStrictEqual(result.invalidTags.map((tag) => ({
				from: tag.from,
				to: tag.to,
				reason: tag.reason,
			})), [
				{
					from: invalidFrom,
					to: invalidFrom + "{{aaaaaa}}".length,
					reason: "unpaired",
				},
			]);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} scan-engine checks.`);
