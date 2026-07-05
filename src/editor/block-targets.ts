import { Text } from "@codemirror/state";
import type { Editor } from "obsidian";
import type { ScanRange } from "./decorations/types";
import {
	expandLineRangeToParagraphs,
	isContentParagraphLine,
} from "./paragraph-ranges";
import {
	rangesOverlap,
	subtractRanges,
} from "./decorations/scan-range-utils";
import { collectTextBlockElementExclusions } from "./decorations/text-exclusion-collector";

export type BlockWrapperMode = "line" | "inline";

export interface BlockTargetRange extends ScanRange {
	readonly fromLine: number;
	readonly toLine: number;
	readonly wrapperMode: BlockWrapperMode;
}

export interface BlockTargetContext {
	readonly blockExclusions: readonly ScanRange[];
}

const blockTargetContextCache = new WeakMap<Editor, {
	readonly text: string;
	readonly context: BlockTargetContext;
}>();

export function getBlockTargetContext(editor: Editor): BlockTargetContext {
	const text = editor.getValue();
	const cached = blockTargetContextCache.get(editor);
	if (cached?.text === text) {
		return cached.context;
	}

	const doc = Text.of(text.split("\n"));
	const context: BlockTargetContext = {
		blockExclusions: collectTextBlockElementExclusions(doc),
	};
	blockTargetContextCache.set(editor, { text, context });
	return context;
}

export function getBlockTargetsInRange(
	editor: Editor,
	range: ScanRange,
	context: BlockTargetContext = getBlockTargetContext(editor),
): BlockTargetRange[] {
	if (range.from >= range.to) {
		return [];
	}

	const candidateRanges = subtractRanges(
		[range],
		context.blockExclusions,
	);
	const targets = candidateRanges.flatMap((candidateRange) =>
		getTargetsForRange(editor, candidateRange),
	);

	return targets.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function getLineOffsetRange(
	editor: Editor,
	lineNumber: number,
): ScanRange {
	return {
		from: editor.posToOffset({ line: lineNumber, ch: 0 }),
		to: editor.posToOffset({
			line: lineNumber,
			ch: editor.getLine(lineNumber).length,
		}),
	};
}

function getTargetsForRange(
	editor: Editor,
	range: ScanRange,
): BlockTargetRange[] {
	if (range.from >= range.to) {
		return [];
	}

	const firstLine = editor.offsetToPos(range.from).line;
	const lastLine = editor.offsetToPos(Math.max(range.from, range.to - 1)).line;
	const firstContentLine = findContentLineInRun(
		editor,
		firstLine,
		lastLine,
		"forward",
	);
	if (firstContentLine === null) {
		return [];
	}

	const lastContentLine = findContentLineInRun(
		editor,
		firstContentLine,
		lastLine,
		"backward",
	);
	if (lastContentLine === null) {
		return [];
	}

	const paragraphRange = expandLineRangeToParagraphs({
		fromLine: firstContentLine,
		toLine: lastContentLine,
		firstLine: 0,
		lastLine: editor.lastLine(),
		getLineText: (currentLine) => editor.getLine(currentLine),
	});
	if (!paragraphRange) {
		return [];
	}

	const lineRange = {
		...getLineOffsetRange(editor, paragraphRange.fromLine),
		to: getLineOffsetRange(editor, paragraphRange.toLine).to,
		fromLine: paragraphRange.fromLine,
		toLine: paragraphRange.toLine,
		wrapperMode: "line" as const,
	};

	return rangesOverlap(lineRange, range) ? [lineRange] : [];
}

function findContentLineInRun(
	editor: Editor,
	runStart: number,
	runEnd: number,
	direction: "forward" | "backward",
): number | null {
	const step = direction === "forward" ? 1 : -1;
	let lineNumber = direction === "forward" ? runStart : runEnd;

	while (
		direction === "forward"
			? lineNumber <= runEnd
			: lineNumber >= runStart
	) {
		if (isContentParagraphLine(editor.getLine(lineNumber))) {
			return lineNumber;
		}

		lineNumber += step;
	}

	return null;
}
