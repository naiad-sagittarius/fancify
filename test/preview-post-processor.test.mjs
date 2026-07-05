import assert from "node:assert/strict";
import { Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { getPreviewScanRanges } = load("../src/preview/post-processor.ts");
const { pairTokens } = load("../src/editor/decorations/pair-builder.ts");
const { rebuildTagPrefixLookup, scanTags } = load(
	"../src/editor/decorations/tag-scanner.ts",
);

const tests = [
	{
		name: "getPreviewScanRanges keeps inline tags detectable across text-node splits",
		run() {
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

			const source = "{{aaaaaa}}body{{aaaaaa}}";
			const doc = Text.of([source]);
			const splitTextNodeRanges = [
				{ from: 0, to: 4 },
				{ from: 4, to: 9 },
				{ from: 9, to: 13 },
				{ from: 13, to: 18 },
				{ from: 18, to: source.length },
			];

			assert.equal(scanTags(doc, splitTextNodeRanges).length, 0);

			const tokens = scanTags(doc, getPreviewScanRanges(doc.length, []));
			const result = pairTokens(tokens, true);

			assert.equal(tokens.length, 2);
			assert.deepStrictEqual(result.nodes, [
				{
					from: 10,
					to: 14,
					cssClass: "fancify-mark fancify-token-color-aaa",
					styleType: "inline",
				},
			]);
		},
	},
	{
		name: "getPreviewScanRanges excludes ignored rendered text ranges",
		run() {
			assert.deepStrictEqual(getPreviewScanRanges(20, [{ from: 5, to: 10 }]), [
				{ from: 0, to: 5 },
				{ from: 10, to: 20 },
			]);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} preview post-processor checks.`);
