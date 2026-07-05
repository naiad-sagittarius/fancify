import { parseVariantTag, tagLength } from "./tag-format";

export interface ParagraphLineRange {
	readonly fromLine: number;
	readonly toLine: number;
}

interface ExpandLineRangeToParagraphsOptions {
	readonly fromLine: number;
	readonly toLine: number;
	readonly firstLine: number;
	readonly lastLine: number;
	readonly getLineText: (lineNumber: number) => string;
}

type MarkdownLineKind =
	| "blank"
	| "blockquote"
	| "fenced-code"
	| "fancify-tag"
	| "heading"
	| "indented-code"
	| "list"
	| "math-block"
	| "paragraph"
	| "thematic-break";

export function isBlankParagraphLine(text: string): boolean {
	return text.trim().length === 0;
}

export function isStandaloneFancifyTagLine(text: string): boolean {
	const trimmedText = text.trim();
	if (
		trimmedText.length === 0 ||
		trimmedText.length % tagLength !== 0
	) {
		return false;
	}

	for (let index = 0; index < trimmedText.length; index += tagLength) {
		if (parseVariantTag(trimmedText.slice(index, index + tagLength)) === undefined) {
			return false;
		}
	}

	return true;
}

export function isContentParagraphLine(text: string): boolean {
	return !isBlankParagraphLine(text) && !isStandaloneFancifyTagLine(text);
}

export function expandLineRangeToParagraphs(
	options: ExpandLineRangeToParagraphsOptions,
): ParagraphLineRange | null {
	const rangeStart = clampLine(
		Math.min(options.fromLine, options.toLine),
		options.firstLine,
		options.lastLine,
	);
	const rangeEnd = clampLine(
		Math.max(options.fromLine, options.toLine),
		options.firstLine,
		options.lastLine,
	);

	let firstContentLine: number | null = null;
	for (let lineNumber = rangeStart; lineNumber <= rangeEnd; lineNumber += 1) {
		if (!isBlankParagraphLine(options.getLineText(lineNumber))) {
			firstContentLine = lineNumber;
			break;
		}
	}

	if (firstContentLine === null) {
		return null;
	}

	let lastContentLine = firstContentLine;
	for (let lineNumber = rangeEnd; lineNumber >= firstContentLine; lineNumber -= 1) {
		if (!isBlankParagraphLine(options.getLineText(lineNumber))) {
			lastContentLine = lineNumber;
			break;
		}
	}

	const startBlock = findMarkdownBlockRange(firstContentLine, options);
	const endBlock = findMarkdownBlockRange(lastContentLine, options);

	return {
		fromLine: startBlock.fromLine,
		toLine: endBlock.toLine,
	};
}

function clampLine(lineNumber: number, firstLine: number, lastLine: number): number {
	return Math.max(firstLine, Math.min(lineNumber, lastLine));
}

function findMarkdownBlockRange(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): ParagraphLineRange {
	const fencedCodeRange = findFencedCodeRange(lineNumber, options);
	if (fencedCodeRange) {
		return fencedCodeRange;
	}

	if (isListContinuationContext(lineNumber, options)) {
		return expandContiguousBlock(lineNumber, "list", options);
	}

	const kind = getMarkdownLineKind(options.getLineText(lineNumber));
	if (kind === "heading" || kind === "thematic-break" || kind === "math-block") {
		return { fromLine: lineNumber, toLine: lineNumber };
	}

	if (kind === "fancify-tag") {
		return { fromLine: lineNumber, toLine: lineNumber };
	}

	if (kind === "blockquote" || kind === "list") {
		return expandContiguousBlock(lineNumber, kind, options);
	}

	return expandParagraphBlock(lineNumber, options);
}

function expandContiguousBlock(
	lineNumber: number,
	kind: MarkdownLineKind,
	options: ExpandLineRangeToParagraphsOptions,
): ParagraphLineRange {
	let fromLine = lineNumber;
	while (
		fromLine > options.firstLine &&
		isCompatibleBlockLine(fromLine - 1, kind, options)
	) {
		fromLine -= 1;
	}

	let toLine = lineNumber;
	while (
		toLine < options.lastLine &&
		isCompatibleBlockLine(toLine + 1, kind, options)
	) {
		toLine += 1;
	}

	return { fromLine, toLine };
}

function expandParagraphBlock(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): ParagraphLineRange {
	let fromLine = lineNumber;
	while (
		fromLine > options.firstLine &&
		isParagraphContinuationLine(fromLine - 1, options)
	) {
		fromLine -= 1;
	}

	let toLine = lineNumber;
	while (
		toLine < options.lastLine &&
		isParagraphContinuationLine(toLine + 1, options)
	) {
		toLine += 1;
	}

	return { fromLine, toLine };
}

function isCompatibleBlockLine(
	lineNumber: number,
	kind: MarkdownLineKind,
	options: ExpandLineRangeToParagraphsOptions,
): boolean {
	const lineKind = getMarkdownLineKind(options.getLineText(lineNumber));
	if (lineKind === "blank") {
		return false;
	}

	if (kind === "list") {
		return lineKind === "list" || isIndentedContinuationLine(lineNumber, options);
	}

	return lineKind === kind;
}

function isParagraphContinuationLine(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): boolean {
	const lineKind = getMarkdownLineKind(options.getLineText(lineNumber));
	return lineKind === "paragraph" || lineKind === "indented-code";
}

function isIndentedContinuationLine(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): boolean {
	const text = options.getLineText(lineNumber);
	return /^\s{2,}\S/.test(text) && getMarkdownLineKind(text) !== "list";
}

function isListContinuationContext(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): boolean {
	if (!isIndentedContinuationLine(lineNumber, options)) {
		return false;
	}

	const previousKind =
		lineNumber > options.firstLine
			? getMarkdownLineKind(options.getLineText(lineNumber - 1))
			: "blank";
	const nextKind =
		lineNumber < options.lastLine
			? getMarkdownLineKind(options.getLineText(lineNumber + 1))
			: "blank";

	return previousKind === "list" || nextKind === "list";
}

function findFencedCodeRange(
	lineNumber: number,
	options: ExpandLineRangeToParagraphsOptions,
): ParagraphLineRange | null {
	let activeFence: string | null = null;
	let fenceStart = options.firstLine;

	for (
		let currentLine = options.firstLine;
		currentLine <= lineNumber;
		currentLine += 1
	) {
		const fence = getFenceMarker(options.getLineText(currentLine));
		if (!fence) {
			continue;
		}

		if (!activeFence) {
			activeFence = fence;
			fenceStart = currentLine;
			continue;
		}

		if (fence === activeFence) {
			if (currentLine >= lineNumber) {
				return { fromLine: fenceStart, toLine: currentLine };
			}

			activeFence = null;
		}
	}

	if (!activeFence) {
		return null;
	}

	let fenceEnd = options.lastLine;
	for (
		let currentLine = lineNumber + 1;
		currentLine <= options.lastLine;
		currentLine += 1
	) {
		if (getFenceMarker(options.getLineText(currentLine)) === activeFence) {
			fenceEnd = currentLine;
			break;
		}
	}

	return { fromLine: fenceStart, toLine: fenceEnd };
}

function getMarkdownLineKind(text: string): MarkdownLineKind {
	if (isBlankParagraphLine(text)) {
		return "blank";
	}

	if (isStandaloneFancifyTagLine(text)) {
		return "fancify-tag";
	}

	if (getFenceMarker(text)) {
		return "fenced-code";
	}

	if (/^\s{0,3}#{1,6}\s+/.test(text)) {
		return "heading";
	}

	if (isThematicBreakLine(text)) {
		return "thematic-break";
	}

	if (isMathBlockDelimiterLine(text)) {
		return "math-block";
	}

	if (/^\s{0,3}>/.test(text)) {
		return "blockquote";
	}

	if (/^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(text)) {
		return "list";
	}

	if (/^\s{4,}\S/.test(text)) {
		return "indented-code";
	}

	return "paragraph";
}

function getFenceMarker(text: string): string | null {
	const match = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
	return match?.[1]?.charAt(0) ?? null;
}

export function isThematicBreakLine(text: string): boolean {
	return /^\s{0,3}(?:[-*_]\s*){3,}$/.test(text.trim());
}

function isMathBlockDelimiterLine(text: string): boolean {
	return text.trim().startsWith("$$");
}
