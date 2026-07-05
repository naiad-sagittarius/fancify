import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const {
	getHorizontalLineRemovalRange,
	hasHorizontalLines,
	removeNextHorizontalLine,
} = load("../src/commands/remove-horizontal-line.ts");
const { rebuildTagPrefixLookup } = load("../src/editor/decorations/tag-scanner.ts");

const horizontalLineTagPrefix = "{{adaa";
const horizontalLineTag0 = "{{adaaaa}}";
const horizontalLineTag1 = "{{adaaab}}";
const horizontalLinePair0 = `${horizontalLineTag0}${horizontalLineTag0}`;
const horizontalLinePair1 = `${horizontalLineTag1}${horizontalLineTag1}`;

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

	getCursor(which) {
		const from = Math.min(this.selectionFrom, this.selectionTo);
		const to = Math.max(this.selectionFrom, this.selectionTo);
		return this.offsetToPos(which === "to" ? to : from);
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
			type: "horizontal-line",
			variants: [
				{
					tagPrefix: horizontalLineTagPrefix,
					variantTokens: {},
				},
			],
		},
	]);
}

const tests = [
	{
		name: "hasHorizontalLines detects horizontal line markers",
		run() {
			const editor = new MockEditor(`A\n${horizontalLinePair0}\nB`);

			assert.equal(hasHorizontalLines(editor), true);
		},
	},
	{
		name: "removeNextHorizontalLine removes the next marker line",
		run() {
			const editor = new MockEditor(
				`A\n${horizontalLinePair0}\nB\n${horizontalLinePair1}\nC`,
			);
			editor.setCursor(editor.getValue().indexOf("B"));

			assert.equal(removeNextHorizontalLine(editor), true);
			assert.equal(editor.getValue(), `A\n${horizontalLinePair0}\nB\nC`);
			assert.equal(editor.transactions.length, 1);
			assert.equal(editor.transactions[0].origin, "fancify");
		},
	},
	{
		name: "removeNextHorizontalLine wraps to the first marker",
		run() {
			const editor = new MockEditor(`A\n${horizontalLinePair0}\nB`);
			editor.setCursor(editor.getValue().length);

			assert.equal(removeNextHorizontalLine(editor), true);
			assert.equal(editor.getValue(), "A\nB");
		},
	},
	{
		name: "getHorizontalLineRemovalRange removes a whole standalone marker line",
		run() {
			const source = `A\n ${horizontalLinePair0} \nB`;
			const from = source.indexOf(horizontalLinePair0);
			const range = getHorizontalLineRemovalRange(source, {
				from,
				to: from + horizontalLinePair0.length,
			});

			assert.deepEqual(range, { from: 2, to: 25 });
		},
	},
];

configureTagLookup();

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} remove-horizontal-line checks.`);
