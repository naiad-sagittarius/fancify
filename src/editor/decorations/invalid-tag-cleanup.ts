import {
	type EditorState,
	type Text,
	type TransactionSpec,
} from "@codemirror/state";
import { parseVariantTag } from "../tag-format";
import { scanTags } from "./tag-scanner";
import type {
	InvalidTag,
	ScanRange,
} from "./types";

export function createInvalidTagCleanupTransaction(
	state: EditorState,
	invalidTags: readonly InvalidTag[],
): TransactionSpec | null {
	const changes = invalidTags.flatMap((tag) => {
		const range = getCurrentInvalidTagRange(state, tag);
		return range ? [{ from: range.from, to: range.to, insert: "" }] : [];
	});

	if (changes.length === 0) {
		return null;
	}

	return {
		changes: changes.sort(
			(left, right) =>
				left.from - right.from ||
				(left.to - right.to),
		),
	};
}

function getCurrentInvalidTagRange(
	state: EditorState,
	tag: InvalidTag,
): ScanRange | null {
	if (!isCurrentTagCandidate(state.doc, tag)) {
		return null;
	}

	if (tag.reason === "unknown-prefix" && scanTags(state.doc, [tag]).length > 0) {
		return null;
	}

	return { from: tag.from, to: tag.to };
}

function isCurrentTagCandidate(doc: Text, range: ScanRange): boolean {
	if (
		range.from < 0 ||
		range.to > doc.length ||
		range.from >= range.to
	) {
		return false;
	}

	return parseVariantTag(doc.sliceString(range.from, range.to)) !== undefined;
}
