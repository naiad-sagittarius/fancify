import assert from "node:assert/strict";
import { Text } from "@codemirror/state";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const {
	getParagraphSelectionForLine,
} = load(
	"../src/editor/mobile-paragraph-selection.ts",
);

const tests = [
	{
		name: "getParagraphSelectionForLine selects the surrounding paragraph",
		run() {
			const doc = Text.of(["Alpha", "Beta", "", "Gamma"]);

			assert.deepStrictEqual(getParagraphSelectionForLine(doc, 2), {
				from: doc.line(1).from,
				to: doc.line(2).to,
			});
		},
	},
	{
		name: "getParagraphSelectionForLine ignores blank lines",
		run() {
			const doc = Text.of(["Alpha", "", "Gamma"]);

			assert.equal(getParagraphSelectionForLine(doc, 2), null);
		},
	},
	{
		name: "getParagraphSelectionForLine expands list continuations",
		run() {
			const doc = Text.of(["- Alpha", "  Beta", "Gamma"]);

			assert.deepStrictEqual(getParagraphSelectionForLine(doc, 2), {
				from: doc.line(1).from,
				to: doc.line(2).to,
			});
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} mobile paragraph selection checks.`);
