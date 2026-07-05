import type { Text } from "@codemirror/state";
import type { Editor } from "obsidian";
import type { ScanRange, TagPair, TagToken } from "./decorations/types";
import { isStandaloneFancifyTagLine } from "./paragraph-ranges";

export function editorPairUsesLineWrapper(
	editor: Editor,
	pair: TagPair,
): boolean {
	return (
		editorTagIsOnStandaloneTagLine(editor, pair.openingTag) &&
		editorTagIsOnStandaloneTagLine(editor, pair.closingTag)
	);
}

export function textPairUsesLineWrapper(doc: Text, pair: TagPair): boolean {
	return (
		textTagIsOnStandaloneTagLine(doc, pair.openingTag) &&
		textTagIsOnStandaloneTagLine(doc, pair.closingTag)
	);
}

export function editorTagIsOnStandaloneTagLine(
	editor: Editor,
	token: ScanRange,
): boolean {
	const position = editor.offsetToPos(token.from);
	return isStandaloneFancifyTagLine(editor.getLine(position.line));
}

function textTagIsOnStandaloneTagLine(doc: Text, token: TagToken): boolean {
	const line = doc.lineAt(token.from);
	return isStandaloneFancifyTagLine(line.text);
}
