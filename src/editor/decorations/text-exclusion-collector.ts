import type { Text } from "@codemirror/state";
import { parser, Table } from "@lezer/markdown";
import { mergeRanges } from "./scan-range-utils";
import type { ScanRange } from "./types";

const markdownSyntaxExclusionNodeNames = new Set([
	"CodeBlock",
	"FencedCode",
	"HorizontalRule",
	"Table",
]);
const gfmMarkdownParser = parser.configure([Table]);

export function collectTextBlockElementExclusions(doc: Text): ScanRange[] {
	const exclusions: ScanRange[] = [
		...collectMarkdownSyntaxExclusions(doc),
		...collectCalloutExclusions(doc),
	];
	let activeMathBlockFrom: number | null = null;

	for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
		const line = doc.line(lineNumber);

		if (activeMathBlockFrom !== null) {
			if (isMathBlockDelimiterLine(line.text)) {
				exclusions.push({
					from: activeMathBlockFrom,
					to: getLineEndWithBreak(doc, lineNumber),
				});
				activeMathBlockFrom = null;
			}
			continue;
		}

		const mathBlock = parseMathBlockLine(line.text);
		if (mathBlock === "single-line") {
			exclusions.push(getWholeLineRange(doc, lineNumber));
			continue;
		}
		if (mathBlock === "start") {
			activeMathBlockFrom = line.from;
		}
	}

	if (activeMathBlockFrom !== null) {
		exclusions.push({
			from: activeMathBlockFrom,
			to: doc.length,
		});
	}

	return mergeRanges(exclusions);
}

function collectCalloutExclusions(doc: Text): ScanRange[] {
	const exclusions: ScanRange[] = [];
	let lineNumber = 1;

	while (lineNumber <= doc.lines) {
		const line = doc.line(lineNumber);
		if (!isCalloutStartLine(line.text)) {
			lineNumber++;
			continue;
		}

		const from = line.from;
		let toLineNumber = lineNumber;
		while (
			toLineNumber < doc.lines &&
			isBlockquoteLine(doc.line(toLineNumber + 1).text)
		) {
			toLineNumber++;
		}

		exclusions.push({
			from,
			to: getLineEndWithBreak(doc, toLineNumber),
		});
		lineNumber = toLineNumber + 1;
	}

	return exclusions;
}

export function collectMarkdownSyntaxExclusions(doc: Text): ScanRange[] {
	const text = doc.sliceString(0, doc.length);
	const exclusions: ScanRange[] = [];
	const tree = gfmMarkdownParser.parse(text);

	tree.iterate({
		enter: (node) => {
			if (!markdownSyntaxExclusionNodeNames.has(node.name)) {
				return;
			}

			const fromLine = doc.lineAt(node.from);
			const toLine = doc.lineAt(Math.max(node.from, node.to - 1));
			exclusions.push(
				node.name === "Table"
					? getTableExclusionRange(doc, fromLine.number, toLine.number)
					: {
							from: fromLine.from,
							to: getLineEndWithBreak(doc, toLine.number),
						},
			);
		},
	});

	return mergeRanges(exclusions);
}

export function collectTextInlineCodeExclusions(
	doc: Text,
	allowedRanges: readonly ScanRange[],
): ScanRange[] {
	const exclusions: ScanRange[] = [];
	const normalisedAllowedRanges = mergeRanges(allowedRanges);

	for (const range of normalisedAllowedRanges) {
		const startLineNumber = doc.lineAt(range.from).number;
		const endLineNumber = doc.lineAt(Math.max(range.to - 1, range.from)).number;

		for (
			let lineNumber = startLineNumber;
			lineNumber <= endLineNumber;
			lineNumber++
		) {
			const line = doc.line(lineNumber);
			const segment = {
				from: Math.max(line.from, range.from),
				to: Math.min(line.to, range.to),
			};
			if (segment.from < segment.to) {
				exclusions.push(...scanInlineCodeInRange(doc, segment));
			}
		}
	}

	return mergeRanges(exclusions);
}

function scanInlineCodeInRange(
	doc: Text,
	range: ScanRange,
): ScanRange[] {
	const exclusions: ScanRange[] = [];
	const text = doc.sliceString(range.from, range.to);
	let index = 0;

	while (index < text.length) {
		if (text[index] !== "`") {
			index++;
			continue;
		}

		const openerLength = countRepeated(text, index, "`");
		const openerStart = index;
		index += openerLength;

		const closerIndex = findClosingBacktickRun(text, index, openerLength);
		if (closerIndex === -1) {
			continue;
		}

		const closerLength = countRepeated(text, closerIndex, "`");
		exclusions.push({
			from: range.from + openerStart,
			to: range.from + closerIndex + closerLength,
		});
		index = closerIndex + closerLength;
	}

	return exclusions;
}

function getTableExclusionRange(
	doc: Text,
	fromLineNumber: number,
	toLineNumber: number,
): ScanRange {
	let tableEndLineNumber = fromLineNumber;

	while (
		tableEndLineNumber < toLineNumber &&
		isTableContentLine(doc.line(tableEndLineNumber + 1).text)
	) {
		tableEndLineNumber++;
	}

	return {
		from: doc.line(fromLineNumber).from,
		to: getLineEndWithBreak(doc, tableEndLineNumber),
	};
}

function parseMathBlockLine(text: string): "start" | "single-line" | null {
	const trimmedText = text.trim();
	if (!trimmedText.startsWith("$$")) {
		return null;
	}

	return trimmedText.indexOf("$$", 2) === -1 ? "start" : "single-line";
}

function isMathBlockDelimiterLine(text: string): boolean {
	return text.trim().startsWith("$$");
}

function isCalloutStartLine(text: string): boolean {
	return /^\s{0,3}>\s*\[![^\]\s]+][^\n]*$/i.test(text);
}

function isBlockquoteLine(text: string): boolean {
	return /^\s{0,3}>/.test(text);
}

function isTableContentLine(text: string): boolean {
	return text.includes("|");
}

function getWholeLineRange(doc: Text, lineNumber: number): ScanRange {
	const line = doc.line(lineNumber);
	return {
		from: line.from,
		to: getLineEndWithBreak(doc, lineNumber),
	};
}

function getLineEndWithBreak(doc: Text, lineNumber: number): number {
	if (lineNumber >= doc.lines) {
		return doc.line(lineNumber).to;
	}

	return doc.line(lineNumber + 1).from;
}

function findClosingBacktickRun(
	text: string,
	startIndex: number,
	requiredLength: number,
): number {
	let index = startIndex;

	while (index < text.length) {
		if (text[index] !== "`") {
			index++;
			continue;
		}

		const runLength = countRepeated(text, index, "`");
		if (runLength === requiredLength) {
			return index;
		}

		index += runLength;
	}

	return -1;
}

function countRepeated(text: string, startIndex: number, character: string): number {
	let length = 0;

	while (text[startIndex + length] === character) {
		length++;
	}

	return length;
}
