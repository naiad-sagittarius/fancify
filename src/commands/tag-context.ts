import { Text } from "@codemirror/state";
import type { Editor } from "obsidian";
import { pairTokens } from "../editor/decorations/pair-builder";
import { scanTags } from "../editor/decorations/tag-scanner";
import type { TagPair, TagToken } from "../editor/decorations/types";

export interface TagContext {
	readonly tokens: TagToken[];
	readonly tagPairs: TagPair[];
}

const tagContextCache = new WeakMap<Editor, {
	readonly text: string;
	readonly context: TagContext;
}>();

export function getTagContext(editor: Editor): TagContext {
	const text = editor.getValue();
	const cached = tagContextCache.get(editor);
	if (cached?.text === text) {
		return cached.context;
	}

	const doc = Text.of(text.split("\n"));
	const tokens = scanTags(doc, [{ from: 0, to: doc.length }]);
	const context = {
		tokens,
		tagPairs: pairTokens(tokens, true).tagPairs,
	};

	tagContextCache.set(editor, { text, context });
	return context;
}
