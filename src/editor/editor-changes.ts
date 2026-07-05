import type { Editor, EditorChange } from "obsidian";

const fancifyEditOrigin = "fancify";

export function applyEditorChanges(
	editor: Editor,
	changes: readonly EditorChange[],
): void {
	const editorChanges = changes.map((change) => ({ ...change }));
	const transaction = (
		editor as {
			transaction?: (
				tx: { changes?: EditorChange[] },
				origin?: string,
			) => void;
		}
	).transaction;

	if (typeof transaction === "function") {
		transaction.call(editor, { changes: editorChanges }, fancifyEditOrigin);
		return;
	}

	for (const change of editorChanges.sort(
		(left, right) =>
			editor.posToOffset(right.from) -
				editor.posToOffset(left.from) ||
			editor.posToOffset(right.to ?? right.from) -
				editor.posToOffset(left.to ?? left.from),
	)) {
		editor.replaceRange(change.text, change.from, change.to ?? change.from);
	}
}
