import type { Editor } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import type { ScanRange, TagPair } from "../editor/decorations/types";
import { applyEditorChanges } from "../editor/editor-changes";
import { isHorizontalLineStyleType } from "../styles/types";
import { getTagContext } from "./tag-context";

export function hasHorizontalLines(editor: Editor): boolean {
	return getHorizontalLinePairs(editor).length > 0;
}

export function removeNextHorizontalLine(editor: Editor): boolean {
	const pair = getNextHorizontalLinePair(editor);
	if (!pair) {
		return false;
	}

	const range = getHorizontalLineRemovalRange(
		editor.getValue(),
		getPairMarkerRange(pair),
	);
	applyEditorRemoval(editor, range);
	return true;
}

export function removeHorizontalLineFromView(
	view: EditorView,
	markerRange: ScanRange,
): boolean {
	if (markerRange.from < 0 || markerRange.to > view.state.doc.length) {
		return false;
	}

	const source = view.state.doc.toString();
	const markerText = source.slice(markerRange.from, markerRange.to);
	if (!markerText.startsWith("{{")) {
		return false;
	}

	const range = getHorizontalLineRemovalRange(source, markerRange);
	view.dispatch({
		changes: {
			from: range.from,
			to: range.to,
			insert: "",
		},
		annotations: Transaction.userEvent.of("delete"),
	});
	view.focus();
	return true;
}

export function getHorizontalLineRemovalRange(
	source: string,
	markerRange: ScanRange,
): ScanRange {
	const markerText = source.slice(markerRange.from, markerRange.to);
	const line = getLineBounds(source, markerRange.from);
	const lineText = source.slice(line.from, line.to);

	if (lineText.trim() !== markerText) {
		return markerRange;
	}

	if (line.to < source.length && source.charAt(line.to) === "\n") {
		return {
			from: line.from,
			to: line.to + 1,
		};
	}

	if (line.from > 0 && source.charAt(line.from - 1) === "\n") {
		return {
			from: line.from - 1,
			to: line.to,
		};
	}

	return line;
}

function getHorizontalLinePairs(editor: Editor): TagPair[] {
	return getTagContext(editor).tagPairs
		.filter((pair) => isHorizontalLineStyleType(pair.openingTag.styleType))
		.sort(
			(left, right) =>
				left.openingTag.from - right.openingTag.from ||
				left.closingTag.to - right.closingTag.to,
		);
}

function getNextHorizontalLinePair(editor: Editor): TagPair | null {
	const pairs = getHorizontalLinePairs(editor);
	if (pairs.length === 0) {
		return null;
	}

	const cursorOffset = editor.posToOffset(editor.getCursor("to"));
	return (
		pairs.find((pair) => pair.closingTag.to >= cursorOffset) ??
		pairs[0] ??
		null
	);
}

function getPairMarkerRange(pair: TagPair): ScanRange {
	return {
		from: pair.openingTag.from,
		to: pair.closingTag.to,
	};
}

function applyEditorRemoval(editor: Editor, range: ScanRange): void {
	applyEditorChanges(editor, [
		{
			from: editor.offsetToPos(range.from),
			to: editor.offsetToPos(range.to),
			text: "",
		},
	]);
}

function getLineBounds(source: string, offset: number): ScanRange {
	const safeOffset = Math.max(0, Math.min(offset, source.length));
	const lineStart = source.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1;
	const lineBreakIndex = source.indexOf("\n", safeOffset);

	return {
		from: lineStart,
		to: lineBreakIndex === -1 ? source.length : lineBreakIndex,
	};
}
