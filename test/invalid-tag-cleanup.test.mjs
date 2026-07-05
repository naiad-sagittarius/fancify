import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { FancifyScanEngine } = load("../src/editor/decorations/scan-engine.ts");
const { createInvalidTagCleanupTransaction } = load(
	"../src/editor/decorations/invalid-tag-cleanup.ts",
);
const { rebuildTagPrefixLookup } = load(
	"../src/editor/decorations/tag-scanner.ts",
);

const tag = "{{aaaaaa}}";
const invalidTag = "{{zzaaaa}}";
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

function getCleanupInput(doc) {
	const state = EditorState.create({ doc });
	const result = new FancifyScanEngine().build(
		tree,
		state.doc,
		[{ from: 0, to: state.doc.length }],
	);

	return { state, result };
}

function applyTagCleanup(doc) {
	const { state, result } = getCleanupInput(doc);
	const transaction = createInvalidTagCleanupTransaction(
		state,
		result.invalidTags,
	);
	if (!transaction) {
		return null;
	}

	return state.update(transaction).state.doc.toString();
}

const tests = [
	{
		name: "createInvalidTagCleanupTransaction removes unpaired known tags",
		run() {
			configureInlinePrefix();

			assert.equal(applyTagCleanup(`A ${tag} B`), "A  B");
		},
	},
	{
		name: "createInvalidTagCleanupTransaction removes invalid tag candidates",
		run() {
			configureInlinePrefix();

			assert.equal(applyTagCleanup(`A ${invalidTag} B`), "A  B");
		},
	},
	{
		name: "createInvalidTagCleanupTransaction removes repeated ambiguous tags",
		run() {
			configureInlinePrefix();

			assert.equal(applyTagCleanup(`${tag}A${tag}B${tag}C${tag}`), "ABC");
		},
	},
	{
		name: "createInvalidTagCleanupTransaction ignores stale tag ranges",
		run() {
			configureInlinePrefix();
			const { result } = getCleanupInput(`A ${invalidTag} B`);
			const state = EditorState.create({ doc: "A changed B" });
			const transaction = createInvalidTagCleanupTransaction(
				state,
				result.invalidTags,
			);

			assert.equal(transaction, null);
		},
	},
	{
		name: "createInvalidTagCleanupTransaction ignores currently known tag ranges",
		run() {
			configureInlinePrefix();
			const source = `A ${tag} B`;
			const from = source.indexOf(tag);
			const state = EditorState.create({ doc: source });
			const transaction = createInvalidTagCleanupTransaction(
				state,
				[
					{
						from,
						to: from + tag.length,
						text: tag,
						tagPrefix: "{{aaaa",
						groupId: "aaaaaa",
						counterIndex: 0,
						reason: "unknown-prefix",
					},
				],
			);

			assert.equal(transaction, null);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} invalid-tag-cleanup checks.`);
