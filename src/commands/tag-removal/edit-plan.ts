import type { Editor } from "obsidian";
import { getLineOffsetRange } from "../../editor/block-targets";
import type { TagAllocator } from "../../editor/tag-allocator";
import { applyEditorChanges } from "../../editor/editor-changes";
import {
	editorPairUsesLineWrapper,
	editorTagIsOnStandaloneTagLine,
} from "../../editor/tag-lines";
import { rangesOverlap } from "../../editor/decorations/scan-range-utils";
import type {
	InvalidTag,
	ScanRange,
	TagPair,
	TagToken,
} from "../../editor/decorations/types";
import { isBlockRangeStyleType, type StyleType } from "../../styles/types";
import {
	clipRange,
	getElementEndBeforeSelection,
	getElementStartAfterSelection,
	getPairBodyRange,
	selectionOverlapsAllElementsBetweenTags,
} from "./block-ranges";
import type {
	BlockTargetContextProvider,
	InsertAffinity,
	PlannedEdit,
	StyleSelectionRange,
} from "./types";

export function removeInvalidTags(
	editor: Editor,
	invalidTags: readonly InvalidTag[],
	edits: PlannedEdit[],
): void {
	for (const invalidTag of invalidTags) {
		addTagRemovalEdit(editor, invalidTag, edits);
	}
}

export function splitContainingPairs(
	editor: Editor,
	tagPairs: readonly TagPair[],
	removedTokens: ReadonlySet<TagToken>,
	selectionRanges: readonly ScanRange[],
	allocateTag: TagAllocator,
	getBlockContext: BlockTargetContextProvider,
	edits: PlannedEdit[],
): boolean {
	for (const pair of tagPairs) {
		if (
			removedTokens.has(pair.openingTag) ||
			removedTokens.has(pair.closingTag)
		) {
			continue;
		}

		const selectionRange = selectionRanges.find((range) =>
			pairContainsSelection(pair, range),
		);
		if (!selectionRange) {
			continue;
		}

		const didPlanSplit =
			pair.openingTag.styleType === "inline"
				? planInlineSplit(pair, selectionRange, allocateTag, edits)
				: planBlockSplit(
						editor,
						pair,
						selectionRange,
						allocateTag,
						getBlockContext,
						edits,
					);
		if (!didPlanSplit) {
			return false;
		}
	}

	return true;
}

export function planTargetPairRemoval(
	editor: Editor,
	targetPairs: readonly TagPair[],
	selectionRanges: readonly ScanRange[],
	styleType: StyleType,
	allocateTag: TagAllocator,
	getBlockContext: BlockTargetContextProvider,
	edits: PlannedEdit[],
): boolean {
	for (const pair of targetPairs) {
		for (const selectionRange of selectionRanges) {
			const bodySelectionRange =
				styleType === "inline"
					? clipRange(selectionRange, getPairBodyRange(pair))
					: rangesOverlap(getPairBodyRange(pair), selectionRange)
						? selectionRange
						: null;
			if (!bodySelectionRange) {
				continue;
			}

			const didPlanRemoval =
				styleType === "inline"
					? planInlineSplit(pair, bodySelectionRange, allocateTag, edits)
					: planBlockSplit(
							editor,
							pair,
							bodySelectionRange,
							allocateTag,
							getBlockContext,
							edits,
						);
			if (!didPlanRemoval) {
				return false;
			}
		}
	}

	return true;
}

export function addWrapperStartEdit(
	styleType: StyleType,
	range: StyleSelectionRange,
	tag: string,
	edits: PlannedEdit[],
): void {
	if (usesLineWrapper(styleType, range)) {
		addEdit(edits, range.from, range.from, `${tag}\n`, "before");
		return;
	}

	addEdit(edits, range.from, range.from, tag, "before");
}

export function addWrapperEndEdit(
	styleType: StyleType,
	range: StyleSelectionRange,
	tag: string,
	edits: PlannedEdit[],
): void {
	if (usesLineWrapper(styleType, range)) {
		addEdit(edits, range.to, range.to, `\n${tag}`, "after");
		return;
	}

	addEdit(edits, range.to, range.to, tag, "after");
}

export function addTagRemovalEdit(
	editor: Editor,
	token: ScanRange,
	edits: PlannedEdit[],
): void {
	const lineRange = getStandaloneTagLineRemovalRange(editor, token);
	const range = lineRange ?? token;

	addEdit(edits, range.from, range.to, "");
}

export function applyEdits(editor: Editor, edits: readonly PlannedEdit[]): void {
	const groupedEdits = groupEdits(moveInsertionsOutOfRemovals(edits));
	applyEditorChanges(
		editor,
		groupedEdits
			.sort((left, right) => left.from - right.from || left.to - right.to)
			.map((edit) => ({
				from: editor.offsetToPos(edit.from),
				to: editor.offsetToPos(edit.to),
				text: edit.text,
			})),
	);
}

function planInlineSplit(
	pair: TagPair,
	selectionRange: ScanRange,
	allocateTag: TagAllocator,
	edits: PlannedEdit[],
): boolean {
	const hasRangeBeforeSelection = pair.openingTag.to < selectionRange.from;
	const hasRangeAfterSelection = selectionRange.to < pair.closingTag.from;

	if (hasRangeBeforeSelection) {
		addEdit(
			edits,
			selectionRange.from,
			selectionRange.from,
			pair.openingTag.text,
			"before",
		);
	} else {
		addEdit(edits, pair.openingTag.from, pair.openingTag.to, "");
	}

	if (!hasRangeAfterSelection) {
		addEdit(edits, pair.closingTag.from, pair.closingTag.to, "");
		return true;
	}

	const newTag = allocateTag(pair.openingTag.tagPrefix);
	if (!newTag) {
		return false;
	}

	addEdit(edits, selectionRange.to, selectionRange.to, newTag, "after");
	addEdit(edits, pair.closingTag.from, pair.closingTag.to, newTag);
	return true;
}

function planBlockSplit(
	editor: Editor,
	pair: TagPair,
	selectionRange: ScanRange,
	allocateTag: TagAllocator,
	getBlockContext: BlockTargetContextProvider,
	edits: PlannedEdit[],
): boolean {
	const blockContext = getBlockContext();

	if (
		selectionOverlapsAllElementsBetweenTags(
			editor,
			pair,
			selectionRange,
			blockContext,
		)
	) {
		addTagRemovalEdit(editor, pair.openingTag, edits);
		addTagRemovalEdit(editor, pair.closingTag, edits);
		return true;
	}

	const beforeSelectionEnd = getElementEndBeforeSelection(
		editor,
		selectionRange,
		blockContext,
	);
	const afterSelectionStart = getElementStartAfterSelection(
		editor,
		selectionRange,
		blockContext,
	);
	const hasRangeBeforeSelection =
		beforeSelectionEnd !== null && pair.openingTag.to < beforeSelectionEnd;
	const hasRangeAfterSelection =
		afterSelectionStart !== null && afterSelectionStart < pair.closingTag.from;

	if (hasRangeBeforeSelection) {
		addBlockSplitEndEdit(editor, pair, beforeSelectionEnd, edits);
	} else {
		addTagRemovalEdit(editor, pair.openingTag, edits);
	}

	if (!hasRangeAfterSelection) {
		addTagRemovalEdit(editor, pair.closingTag, edits);
		return true;
	}

	const newTag = allocateTag(pair.openingTag.tagPrefix);
	if (!newTag) {
		return false;
	}

	addBlockSplitStartEdit(editor, pair, afterSelectionStart, newTag, edits);
	addEdit(edits, pair.closingTag.from, pair.closingTag.to, newTag);
	return true;
}

function addBlockSplitEndEdit(
	editor: Editor,
	pair: TagPair,
	offset: number,
	edits: PlannedEdit[],
): void {
	const text = editorPairUsesLineWrapper(editor, pair)
		? `\n${pair.openingTag.text}`
		: pair.openingTag.text;

	addEdit(edits, offset, offset, text, "before");
}

function addBlockSplitStartEdit(
	editor: Editor,
	pair: TagPair,
	offset: number,
	tag: string,
	edits: PlannedEdit[],
): void {
	const text = editorPairUsesLineWrapper(editor, pair) ? `${tag}\n` : tag;

	addEdit(edits, offset, offset, text, "after");
}

function getStandaloneTagLineRemovalRange(
	editor: Editor,
	token: ScanRange,
): ScanRange | null {
	if (!editorTagIsOnStandaloneTagLine(editor, token)) {
		return null;
	}

	const lineNumber = editor.offsetToPos(token.from).line;
	const lineRange = getLineOffsetRange(editor, lineNumber);
	if (token.from < lineRange.from || token.to > lineRange.to) {
		return null;
	}

	if (lineNumber < editor.lastLine()) {
		return { from: lineRange.from, to: lineRange.to + 1 };
	}

	if (lineNumber > 0) {
		return { from: lineRange.from - 1, to: lineRange.to };
	}

	return lineRange;
}

function usesLineWrapper(
	styleType: StyleType,
	range: StyleSelectionRange,
): boolean {
	return isBlockRangeStyleType(styleType) && range.wrapperMode !== "inline";
}

function pairContainsSelection(pair: TagPair, selectionRange: ScanRange): boolean {
	return (
		pair.openingTag.to <= selectionRange.from &&
		selectionRange.to <= pair.closingTag.from &&
		!rangesOverlap(pair.openingTag, selectionRange) &&
		!rangesOverlap(pair.closingTag, selectionRange)
	);
}

function addEdit(
	edits: PlannedEdit[],
	from: number,
	to: number,
	text: string,
	affinity?: InsertAffinity,
): void {
	edits.push({
		from,
		to,
		text,
		sequence: edits.length,
		affinity,
	});
}

function moveInsertionsOutOfRemovals(
	edits: readonly PlannedEdit[],
): PlannedEdit[] {
	const removals = edits.filter((edit) => edit.from < edit.to);

	return edits.map((edit) => {
		if (edit.from !== edit.to) {
			return edit;
		}

		const containingRemoval = removals.find(
			(removal) => removal.from < edit.from && edit.from < removal.to,
		);
		if (!containingRemoval) {
			return edit;
		}

		const offset =
			edit.affinity === "after" ? containingRemoval.to : containingRemoval.from;
		return {
			...edit,
			from: offset,
			to: offset,
		};
	});
}

function groupEdits(edits: readonly PlannedEdit[]): PlannedEdit[] {
	const groupedEdits = new Map<number, PlannedEdit>();

	for (const edit of [...edits].sort(
		(left, right) => left.sequence - right.sequence,
	)) {
		const existingEdit = groupedEdits.get(edit.from);
		if (!existingEdit) {
			groupedEdits.set(edit.from, edit);
			continue;
		}

		groupedEdits.set(edit.from, {
			from: existingEdit.from,
			to: Math.max(existingEdit.to, edit.to),
			text: `${existingEdit.text}${edit.text}`,
			sequence: Math.min(existingEdit.sequence, edit.sequence),
		});
	}

	return Array.from(groupedEdits.values()).filter(
		(edit) => edit.from < edit.to || edit.text.length > 0,
	);
}
