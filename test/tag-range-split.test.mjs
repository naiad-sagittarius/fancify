import assert from "node:assert/strict";
import { EditorState, Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { createTagRangeSplitTransaction } = load("../src/editor/tag-range-split.ts");
const { collectTextBlockElementExclusions } = load(
	"../src/editor/decorations/text-exclusion-collector.ts",
);

const tag = "{{acaaaa}}";

function token(from) {
	return {
		from,
		to: from + tag.length,
		groupId: "acaaaa",
		tagPrefix: "{{acaa",
		counterIndex: 0,
		text: tag,
		cssClass: "fancify-mark-test",
		styleType: "block",
	};
}

function pairForSource(source) {
	const openingFrom = source.indexOf(tag);
	const closingFrom = source.lastIndexOf(tag);

	return {
		openingTag: token(openingFrom),
		closingTag: token(closingFrom),
	};
}

function getExclusionForNeedle(source, needle) {
	const doc = Text.of(source.split("\n"));
	const needleFrom = source.indexOf(needle);
	if (needleFrom === -1) {
		throw new Error(`Needle not found: ${needle}`);
	}

	const exclusion = collectTextBlockElementExclusions(doc).find(
		(range) => range.from <= needleFrom && needleFrom < range.to,
	);
	if (!exclusion) {
		throw new Error(`Exclusion not found for: ${needle}`);
	}

	return exclusion;
}

const tests = [
	{
		name: "createTagRangeSplitTransaction splits block tags around collected exclusions",
		run() {
			const cases = [
				{
					source: `${tag}\nAlpha\n| A | B |\n| --- | --- |\n| C | D |\nBeta\n${tag}`,
					needle: "| A | B |",
				},
				{
					source: `${tag}\nAlpha\n\`\`\`ts\nconst value = 1;\n\`\`\`\nBeta\n${tag}`,
					needle: "```ts",
				},
				{
					source: `${tag}\nAlpha\n$$\nx = 1\n$$\nBeta\n${tag}`,
					needle: "$$",
				},
				{
					source: `${tag}\nAlpha\n> [!note] Title\n> Body\nBeta\n${tag}`,
					needle: "> [!note]",
				},
			];

			for (const { source, needle } of cases) {
				const state = EditorState.create({ doc: source });
				const exclusion = getExclusionForNeedle(source, needle);
				const transaction = createTagRangeSplitTransaction(
					state.doc,
					[pairForSource(source)],
					[exclusion],
				);

				assert.notEqual(transaction, null, needle);
				assert.equal(
					state.update(transaction).state.doc.toString(),
					`${source.slice(0, exclusion.from)}${tag}\n\n${source.slice(
						exclusion.from,
						exclusion.to,
					)}\n${tag}\n${source.slice(exclusion.to)}`,
				);
			}
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} tag-range-split checks.`);
