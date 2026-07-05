import type { Editor } from "obsidian";
import { pairTokens } from "../editor/decorations/pair-builder";
import {
	compareRanges,
	mergeRanges,
	rangesOverlap,
} from "../editor/decorations/scan-range-utils";
import type { ScanRange, TagPair, TagToken } from "../editor/decorations/types";
import { createTagAllocator } from "../editor/tag-allocator";
import { maxCounterIndex } from "../editor/tag-format";
import type { Tool } from "../tools/types";
import { getTagContext } from "./tag-context";
import {
	pairTouchesSelection,
	getPairAppliedRanges,
	selectionIsStyledByTargetPairs,
} from "./tag-removal/block-ranges";
import {
	addTagRemovalEdit,
	addWrapperEndEdit,
	addWrapperStartEdit,
	applyEdits,
	planTargetPairRemoval,
	removeInvalidTags,
	splitContainingPairs,
} from "./tag-removal/edit-plan";
import {
	createBlockTargetContextProvider,
	getApplySelectionRanges,
	getSelectionRanges,
	getTargetPairs,
	getToolKeyFromTagPrefix,
	getVariantStyleKey,
} from "./tag-removal/selection";
import type {
	PlannedEdit,
	PlannedWrapper,
	RemovableVariantStyle,
	VariantApplyOptions,
	VariantApplyResult,
	VariantRemovalResult,
} from "./tag-removal/types";
import { showNotice } from "./notices";

export type {
	RemovableVariantStyle,
	VariantApplyOptions,
	VariantApplyResult,
	VariantRemovalResult,
} from "./tag-removal/types";

export function removeSelectedTagPairs(editor: Editor): boolean {
	const selectionRanges = mergeRanges(getSelectionRanges(editor));
	if (selectionRanges.length === 0) {
		return false;
	}

	const { tokens, tagPairs } = getTagContext(editor);
	const removedTokens = new Set<TagToken>();
	const edits: PlannedEdit[] = [];
	const getBlockContext = createBlockTargetContextProvider(editor);

	for (const token of tokens) {
		if (!selectionRanges.some((range) => rangesOverlap(token, range))) {
			continue;
		}

		removedTokens.add(token);
		addTagRemovalEdit(editor, token, edits);
	}

	const remainingTokens = tokens.filter((token) => !removedTokens.has(token));
	const remainingResult = pairTokens(remainingTokens, true);
	const allocateTag = createTagAllocator(tokens);

	removeInvalidTags(
		editor,
		remainingResult.invalidTags,
		edits,
	);

	if (
		!splitContainingPairs(
			editor,
			tagPairs,
			removedTokens,
			selectionRanges,
			allocateTag,
			getBlockContext,
			edits,
		)
	) {
		showNotice(
			`Fancify: maximum of ${maxCounterIndex} tags reached for one variant.`,
		);
		return false;
	}

	if (edits.length === 0) {
		return false;
	}

	applyEdits(editor, edits);
	return true;
}

export function removeVariantStylesFromSelection(
	editor: Editor,
	options: VariantApplyOptions,
): VariantRemovalResult {
	const selectionRanges = mergeRanges(options.selectionRanges);
	if (selectionRanges.length === 0) {
		return "not-styled";
	}

	const { tokens, tagPairs } = getTagContext(editor);
	const targetPairs = getTargetPairs(tagPairs, options);
	const getBlockContext = createBlockTargetContextProvider(editor);

	if (
		!targetPairs.some((pair) =>
			pairTouchesSelection(editor, pair, selectionRanges, getBlockContext),
		)
	) {
		return "not-styled";
	}

	const allocateTag = createTagAllocator(tokens);
	const edits: PlannedEdit[] = [];

	if (
		!planTargetPairRemoval(
			editor,
			targetPairs,
			selectionRanges,
			options.styleType,
			allocateTag,
			getBlockContext,
			edits,
		)
	) {
		showVariantLimitNotice(options.variantName);
		return "failed";
	}

	if (edits.length === 0) {
		return "not-styled";
	}

	applyEdits(editor, edits);
	return "removed";
}

export function applyVariantToSelection(
	editor: Editor,
	options: VariantApplyOptions,
): VariantApplyResult {
	const selectionRanges = getApplySelectionRanges(options);
	if (selectionRanges.length === 0) {
		return "failed";
	}

	const { tokens, tagPairs } = getTagContext(editor);
	const targetPairs = getTargetPairs(tagPairs, options);
	const allocateTag = createTagAllocator(tokens);
	const edits: PlannedEdit[] = [];
	const getBlockContext = createBlockTargetContextProvider(editor);

	if (
		selectionIsStyledByTargetPairs(
			editor,
			targetPairs,
			selectionRanges,
			options.styleType,
			getBlockContext,
		)
	) {
		return "unchanged";
	}

	const wrappers: PlannedWrapper[] = [];

	for (const selectionRange of selectionRanges) {
		const tag = allocateTag(options.tagPrefix);
		if (!tag) {
			showVariantLimitNotice(options.variantName);
			break;
		}

		wrappers.push({ ...selectionRange, tag });
		addWrapperEndEdit(options.styleType, selectionRange, tag, edits);
	}

	if (wrappers.length === 0) {
		return "failed";
	}

	const plannedSelectionRanges = wrappers.map((wrapper) => ({
		from: wrapper.from,
		to: wrapper.to,
		wrapperMode: wrapper.wrapperMode,
	}));

	planSameToolExactVariantReplacement(
		editor,
		tagPairs,
		options,
		plannedSelectionRanges,
		getBlockContext,
		edits,
	);

	if (
		!planTargetPairRemoval(
			editor,
			targetPairs,
			plannedSelectionRanges,
			options.styleType,
			allocateTag,
			getBlockContext,
			edits,
		)
	) {
		showVariantLimitNotice(options.variantName);
		return "failed";
	}

	for (const wrapper of wrappers) {
		addWrapperStartEdit(options.styleType, wrapper, wrapper.tag, edits);
	}

	applyEdits(editor, edits);
	return "applied";
}

function planSameToolExactVariantReplacement(
	editor: Editor,
	tagPairs: readonly TagPair[],
	options: VariantApplyOptions,
	selectionRanges: readonly ScanRange[],
	getBlockContext: ReturnType<typeof createBlockTargetContextProvider>,
	edits: PlannedEdit[],
): void {
	const toolKey = options.toolKey ?? getToolKeyFromTagPrefix(options.tagPrefix);
	if (!toolKey) {
		return;
	}

	const sortedSelectionRanges = [...selectionRanges].sort(compareRanges);

	for (const pair of tagPairs) {
		if (
			pair.openingTag.styleType !== options.styleType ||
			pair.openingTag.tagPrefix === options.tagPrefix ||
			getToolKeyFromTagPrefix(pair.openingTag.tagPrefix) !== toolKey
		) {
			continue;
		}

		const pairRanges = getPairAppliedRanges(editor, pair, getBlockContext).sort(
			compareRanges,
		);
		if (!rangesEqual(pairRanges, sortedSelectionRanges)) {
			continue;
		}

		addTagRemovalEdit(editor, pair.openingTag, edits);
		addTagRemovalEdit(editor, pair.closingTag, edits);
	}
}

function rangesEqual(
	leftRanges: readonly ScanRange[],
	rightRanges: readonly ScanRange[],
): boolean {
	return (
		leftRanges.length === rightRanges.length &&
		leftRanges.every((leftRange, index) => {
			const rightRange = rightRanges[index];
			return (
				rightRange !== undefined &&
				leftRange.from === rightRange.from &&
				leftRange.to === rightRange.to
			);
		})
	);
}

export function getRemovableVariantsForSelection(
	editor: Editor,
	tools: readonly Tool[],
): RemovableVariantStyle[] {
	const selectionRanges = mergeRanges(getSelectionRanges(editor));
	if (selectionRanges.length === 0) {
		return [];
	}

	const { tagPairs } = getTagContext(editor);
	const touchedVariantKeys = new Set<string>();
	const getBlockContext = createBlockTargetContextProvider(editor);

	for (const pair of tagPairs) {
		if (pairTouchesSelection(editor, pair, selectionRanges, getBlockContext)) {
			touchedVariantKeys.add(
				getVariantStyleKey(pair.openingTag.tagPrefix, pair.openingTag.styleType),
			);
		}
	}

	const removableVariants: RemovableVariantStyle[] = [];

	for (const tool of tools) {
		for (const variant of tool.variants) {
			const styleType = tool.type;
			const variantKey = getVariantStyleKey(variant.tagPrefix, styleType);
			if (!touchedVariantKeys.has(variantKey)) {
				continue;
			}

			removableVariants.push({
				tagPrefix: variant.tagPrefix,
				styleType,
				selectionRanges,
				variantName: variant.name,
				menuTitle: `${tool.name} / ${variant.name}`,
				icon: variant.icon ?? tool.icon,
			});
		}
	}

	return removableVariants;
}

function showVariantLimitNotice(variantName: string): void {
	showNotice(
		`"${variantName}" cannot be used more than ${maxCounterIndex} times.`,
	);
}
