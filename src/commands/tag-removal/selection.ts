import type { Editor } from "obsidian";
import {
	getBlockTargetContext,
	type BlockTargetContext,
} from "../../editor/block-targets";
import type {
	ScanRange,
	TagPair,
} from "../../editor/decorations/types";
import { mergeRanges } from "../../editor/decorations/scan-range-utils";
import { isBlockRangeStyleType } from "../../styles/types";
import type { StyleType } from "../../styles/types";
import { keySegmentLength } from "../../tools/key-format";
import type {
	BlockTargetContextProvider,
	StyleSelectionRange,
	VariantRemovalOptions,
	VariantApplyOptions,
} from "./types";

export function createBlockTargetContextProvider(
	editor: Editor,
): BlockTargetContextProvider {
	let context: BlockTargetContext | null = null;

	return () => {
		context ??= getBlockTargetContext(editor);
		return context;
	};
}

export function getSelectionRanges(editor: Editor): ScanRange[] {
	return editor
		.listSelections()
		.map((selection) => {
			const anchor = editor.posToOffset(selection.anchor);
			const head = editor.posToOffset(selection.head);

			return {
				from: Math.min(anchor, head),
				to: Math.max(anchor, head),
			};
		})
		.filter((range) => range.from < range.to);
}

export function getApplySelectionRanges(
	options: VariantApplyOptions,
): StyleSelectionRange[] {
	if (!isBlockRangeStyleType(options.styleType)) {
		return mergeRanges(options.selectionRanges);
	}

	return [...options.selectionRanges]
		.filter((range) => range.from < range.to)
		.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function getTargetPairs(
	tagPairs: readonly TagPair[],
	options: VariantRemovalOptions,
): TagPair[] {
	return tagPairs.filter(
		(pair) =>
			pair.openingTag.tagPrefix === options.tagPrefix &&
			pair.openingTag.styleType === options.styleType,
	);
}

export function getVariantStyleKey(
	tagPrefix: string,
	styleType: StyleType,
): string {
	return `${styleType}:${tagPrefix}`;
}

export function getToolKeyFromTagPrefix(tagPrefix: string): string | undefined {
	const prefixStart = "{{";
	if (!tagPrefix.startsWith(prefixStart)) {
		return undefined;
	}

	const toolKeyStart = prefixStart.length;
	const toolKeyEnd = toolKeyStart + keySegmentLength;
	if (tagPrefix.length < toolKeyEnd) {
		return undefined;
	}

	return tagPrefix.slice(toolKeyStart, toolKeyEnd);
}
