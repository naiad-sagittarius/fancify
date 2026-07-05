import type { Editor } from "obsidian";
import {
	getBlockTargetsInRange,
	getLineOffsetRange,
	type BlockTargetContext,
	type BlockTargetRange,
} from "../../editor/block-targets";
import { isContentParagraphLine } from "../../editor/paragraph-ranges";
import {
	rangesOverlap,
	subtractRanges,
} from "../../editor/decorations/scan-range-utils";
import type {
	ScanRange,
	TagPair,
} from "../../editor/decorations/types";
import {
	isBlockRangeStyleType,
	type StyleType,
} from "../../styles/types";
import type { BlockTargetContextProvider } from "./types";

type ElementRange = BlockTargetRange;

export function selectionIsStyledByTargetPairs(
	editor: Editor,
	targetPairs: readonly TagPair[],
	selectionRanges: readonly ScanRange[],
	styleType: StyleType,
	getBlockContext: BlockTargetContextProvider,
): boolean {
	if (targetPairs.length === 0) {
		return false;
	}

	return isBlockRangeStyleType(styleType)
		? blockSelectionIsStyledByTargetPairs(
				editor,
				targetPairs,
				selectionRanges,
				getBlockContext,
			)
		: inlineSelectionIsStyledByTargetPairs(targetPairs, selectionRanges);
}

export function pairTouchesSelection(
	editor: Editor,
	pair: TagPair,
	selectionRanges: readonly ScanRange[],
	getBlockContext: BlockTargetContextProvider,
): boolean {
	const pairBodyRange = getPairBodyRange(pair);

	if (pair.openingTag.styleType === "inline") {
		return selectionRanges.some((range) => rangesOverlap(pairBodyRange, range));
	}

	return selectionRanges.some((selectionRange) =>
		getElementRangesInRange(editor, selectionRange, getBlockContext()).some(
			(element) => rangesOverlap(element, pairBodyRange),
		),
	);
}

export function getPairBodyRange(pair: TagPair): ScanRange {
	return {
		from: pair.openingTag.to,
		to: pair.closingTag.from,
	};
}

export function getPairAppliedRanges(
	editor: Editor,
	pair: TagPair,
	getBlockContext: BlockTargetContextProvider,
): ScanRange[] {
	const bodyRange = getPairBodyRange(pair);

	return isBlockRangeStyleType(pair.openingTag.styleType)
		? getBlockTargetsInRange(editor, bodyRange, getBlockContext()).map(
				({ from, to }) => ({ from, to }),
			)
		: [bodyRange];
}

export function clipRange(range: ScanRange, clip: ScanRange): ScanRange | null {
	const from = Math.max(range.from, clip.from);
	const to = Math.min(range.to, clip.to);

	return from < to ? { from, to } : null;
}

export function selectionOverlapsAllElementsBetweenTags(
	editor: Editor,
	pair: TagPair,
	selectionRange: ScanRange,
	blockContext: BlockTargetContext,
): boolean {
	const elements = getElementRangesInRange(
		editor,
		getPairBodyRange(pair),
		blockContext,
	);

	return (
		elements.length > 0 &&
		elements.every((element) => rangesOverlap(element, selectionRange))
	);
}

export function getElementEndBeforeSelection(
	editor: Editor,
	selectionRange: ScanRange,
	blockContext: BlockTargetContext,
): number | null {
	let lineNumber = findContentLineAtOrBeforeOffset(editor, selectionRange.from);

	while (lineNumber !== null) {
		const elementRanges = getElementRangesForLine(
			editor,
			lineNumber,
			blockContext,
		).sort((left, right) => right.to - left.to);
		if (elementRanges.length === 0) {
			lineNumber = findContentLineBeforeLine(editor, lineNumber);
			continue;
		}

		const beforeSelection = elementRanges.find(
			(elementRange) => elementRange.to <= selectionRange.from,
		);
		if (beforeSelection) {
			return beforeSelection.to;
		}

		lineNumber = findContentLineBeforeLine(
			editor,
			Math.min(...elementRanges.map((elementRange) => elementRange.fromLine)),
		);
	}

	return null;
}

export function getElementStartAfterSelection(
	editor: Editor,
	selectionRange: ScanRange,
	blockContext: BlockTargetContext,
): number | null {
	let lineNumber = findContentLineAtOrAfterOffset(editor, selectionRange.to);

	while (lineNumber !== null) {
		const elementRanges = getElementRangesForLine(
			editor,
			lineNumber,
			blockContext,
		).sort((left, right) => left.from - right.from);
		if (elementRanges.length === 0) {
			lineNumber = findContentLineAfterLine(editor, lineNumber);
			continue;
		}

		const afterSelection = elementRanges.find(
			(elementRange) => elementRange.from >= selectionRange.to,
		);
		if (afterSelection) {
			return afterSelection.from;
		}

		lineNumber = findContentLineAfterLine(
			editor,
			Math.max(...elementRanges.map((elementRange) => elementRange.toLine)),
		);
	}

	return null;
}

function inlineSelectionIsStyledByTargetPairs(
	targetPairs: readonly TagPair[],
	selectionRanges: readonly ScanRange[],
): boolean {
	return (
		subtractRanges(selectionRanges, targetPairs.map(getPairBodyRange)).length === 0
	);
}

function blockSelectionIsStyledByTargetPairs(
	editor: Editor,
	targetPairs: readonly TagPair[],
	selectionRanges: readonly ScanRange[],
	getBlockContext: BlockTargetContextProvider,
): boolean {
	const selectedElements = selectionRanges.flatMap((selectionRange) =>
		getElementRangesInRange(editor, selectionRange, getBlockContext()),
	);
	const styledRanges = targetPairs.map(getPairBodyRange);

	return (
		selectedElements.length > 0 &&
		selectedElements.every((element) =>
			styledRanges.some((styledRange) => rangesOverlap(element, styledRange)),
		)
	);
}

function getElementRangesInRange(
	editor: Editor,
	range: ScanRange,
	blockContext: BlockTargetContext,
): ElementRange[] {
	if (range.from >= range.to) {
		return [];
	}

	const firstLine = editor.offsetToPos(range.from).line;
	const lastLine = editor.offsetToPos(Math.max(range.from, range.to - 1)).line;
	const elements: ElementRange[] = [];
	const seenElements = new Set<string>();
	let lineNumber = firstLine;

	while (lineNumber <= lastLine) {
		const lineElements = getElementRangesForLine(
			editor,
			lineNumber,
			blockContext,
		).filter((elementRange) => rangesOverlap(elementRange, range));
		if (lineElements.length === 0) {
			lineNumber += 1;
			continue;
		}

		for (const elementRange of lineElements) {
			const clippedElement = clipElementRange(elementRange, range);
			if (!clippedElement) {
				continue;
			}

			const elementKey = `${clippedElement.from}:${clippedElement.to}`;
			if (seenElements.has(elementKey)) {
				continue;
			}

			seenElements.add(elementKey);
			elements.push(clippedElement);
		}

		lineNumber =
			Math.max(...lineElements.map((elementRange) => elementRange.toLine)) + 1;
	}

	return elements;
}

function clipElementRange(
	elementRange: ElementRange,
	bodyRange: ScanRange,
): ElementRange | null {
	const from = Math.max(elementRange.from, bodyRange.from);
	const to = Math.min(elementRange.to, bodyRange.to);

	if (from >= to) {
		return null;
	}

	return {
		...elementRange,
		from,
		to,
	};
}

function getElementRangesForLine(
	editor: Editor,
	lineNumber: number,
	blockContext: BlockTargetContext,
): ElementRange[] {
	return getBlockTargetsInRange(
		editor,
		getLineOffsetRange(editor, lineNumber),
		blockContext,
	);
}

function findContentLineAtOrBeforeOffset(
	editor: Editor,
	offset: number,
): number | null {
	const position = editor.offsetToPos(offset);
	return findContentLineBeforeLine(editor, position.line + 1);
}

function findContentLineAtOrAfterOffset(
	editor: Editor,
	offset: number,
): number | null {
	const position = editor.offsetToPos(offset);
	return findContentLineAfterLine(editor, position.line - 1);
}

function findContentLineBeforeLine(
	editor: Editor,
	lineNumber: number,
): number | null {
	let currentLine = Math.min(lineNumber - 1, editor.lastLine());

	while (currentLine >= 0) {
		if (isContentParagraphLine(editor.getLine(currentLine))) {
			return currentLine;
		}
		currentLine -= 1;
	}

	return null;
}

function findContentLineAfterLine(
	editor: Editor,
	lineNumber: number,
): number | null {
	let currentLine = Math.max(lineNumber + 1, 0);
	const lastLine = editor.lastLine();

	while (currentLine <= lastLine) {
		if (isContentParagraphLine(editor.getLine(currentLine))) {
			return currentLine;
		}
		currentLine += 1;
	}

	return null;
}
