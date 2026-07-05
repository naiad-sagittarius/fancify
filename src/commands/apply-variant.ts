import {
	type Editor,
	type EditorPosition,
} from "obsidian";
import { Text } from "@codemirror/state";
import {
	isBlockRangeStyleType,
	isHorizontalLineStyleType,
	type StyleType,
} from "../styles/types";
import type { Variant } from "../tools/types";
import { maxCounterIndex } from "../editor/tag-format";
import { getBlockTargetsInRange } from "../editor/block-targets";
import type { ScanRange } from "../editor/decorations/types";
import { applyEditorChanges } from "../editor/editor-changes";
import { createTagAllocator } from "../editor/tag-allocator";
import {
	getTagRangeSplitInsertion,
	type TagRangeSplitInsertion,
} from "../editor/tag-range-split";
import { getTagContext } from "./tag-context";
import { applyVariantToSelection } from "./remove-tags";
import { showNotice } from "./notices";

export function applyVariant(
	editor: Editor,
	variant: Variant,
	styleType: StyleType = "inline",
	toolKey?: string,
): void {
	if (isHorizontalLineStyleType(styleType)) {
		insertHorizontalLineVariant(editor, variant);
		return;
	}

	const selectionRanges = getVariantSelectionRanges(editor, styleType);
	if (selectionRanges.length === 0) return;

	applyVariantToSelection(editor, {
		tagPrefix: variant.tagPrefix,
		variantName: variant.name,
		styleType,
		selectionRanges,
		toolKey,
	});
}

function insertHorizontalLineVariant(editor: Editor, variant: Variant): void {
	const { tokens, tagPairs } = getTagContext(editor);
	const tag = createTagAllocator(tokens)(variant.tagPrefix);
	if (!tag) {
		showNotice(
			`"${variant.name}" cannot be used more than ${maxCounterIndex} times.`,
		);
		return;
	}

	const position = editor.getCursor("to");
	const cursorOffset = editor.posToOffset(position);
	const splitInsertion = getTagRangeSplitInsertion(
		Text.of(editor.getValue().split("\n")),
		tagPairs,
		{ from: cursorOffset, to: cursorOffset },
	);

	applySingleEdit(editor, {
		from: position,
		text: getHorizontalLineInsertion(editor, position, tag, splitInsertion),
	});
}

function getHorizontalLineInsertion(
	editor: Editor,
	position: EditorPosition,
	tag: string,
	splitInsertion: TagRangeSplitInsertion,
): string {
	const lineText = editor.getLine(position.line);
	const beforeText = lineText.slice(0, position.ch);
	const afterText = lineText.slice(position.ch);
	const prefix = getHorizontalLinePrefix(editor, position, beforeText);
	const suffix = getHorizontalLineSuffix(editor, position, afterText);

	return `${prefix}${splitInsertion.beforeObject}${tag}${tag}${splitInsertion.afterObject}${suffix}`;
}

function getHorizontalLinePrefix(
	editor: Editor,
	position: EditorPosition,
	beforeText: string,
): string {
	if (beforeText.trim().length > 0) {
		return "\n";
	}

	return isBlankEditorLine(editor, position.line - 1) ? "" : "\n";
}

function getHorizontalLineSuffix(
	editor: Editor,
	position: EditorPosition,
	afterText: string,
): string {
	if (afterText.trim().length > 0) {
		return "\n";
	}

	return isBlankEditorLine(editor, position.line + 1) ? "" : "\n";
}

function isBlankEditorLine(editor: Editor, lineNumber: number): boolean {
	if (lineNumber < 0 || lineNumber > editor.lastLine()) {
		return false;
	}

	return editor.getLine(lineNumber).trim().length === 0;
}

function applySingleEdit(
	editor: Editor,
	edit: { from: EditorPosition; to?: EditorPosition; text: string },
): void {
	applyEditorChanges(editor, [
		{
			from: edit.from,
			to: edit.to ?? edit.from,
			text: edit.text,
		},
	]);
}

function getVariantSelectionRanges(
	editor: Editor,
	styleType: StyleType,
): ScanRange[] {
	return isBlockRangeStyleType(styleType)
		? getBlockSelectionRanges(editor)
		: getInlineSelectionRanges(editor);
}

function getInlineSelectionRanges(editor: Editor): ScanRange[] {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");

	if (from.line === to.line && from.ch === to.ch) {
		return [];
	}

	return [
		{
			from: editor.posToOffset(from),
			to: editor.posToOffset(to),
		},
	];
}

function getBlockSelectionRanges(editor: Editor): ScanRange[] {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");
	if (from.line === to.line && from.ch === to.ch) {
		return [];
	}

	return getBlockTargetsInRange(editor, {
		from: editor.posToOffset(from),
		to: editor.posToOffset(to),
	});
}
