import {
	EditorSelection,
	type ChangeSpec,
	type EditorState,
	type SelectionRange,
	type Text,
	type TransactionSpec,
	findClusterBreak,
} from "@codemirror/state";
import { mergeRanges, rangesOverlap } from "./scan-range-utils";
import type { ScanRange, TagPair, TagToken } from "./types";

export type DeleteDirection = -1 | 1;

export interface TagDeleteRange extends ScanRange {
	readonly pairId: string;
	readonly token: TagToken;
	readonly pairedToken: TagToken;
}

interface DeletePlan {
	readonly range: SelectionRange;
	readonly changes: ChangeSpec[];
	readonly handled: boolean;
	readonly removedTag: boolean;
}

interface ProtectedDeleteResult {
	readonly deletionRange: ScanRange | null;
	readonly cursorPosition: number;
	readonly affectedTagRanges: TagDeleteRange[];
	readonly handled: boolean;
}

export function createTagDeleteTransaction(
	state: EditorState,
	tagRanges: readonly TagDeleteRange[],
	direction: DeleteDirection,
): TransactionSpec | null {
	const removedPairIds = new Set<string>();
	const hasTextSelection = state.selection.ranges.some((range) => !range.empty);
	const plans = state.selection.ranges.map((range) =>
		hasTextSelection
			? planDeleteRange(range, state.doc, tagRanges, removedPairIds, direction)
			: planProtectedCursorDeleteRange(
					range,
					state.doc,
					tagRanges,
					removedPairIds,
					direction,
				),
	);
	if (!plans.some((plan) => plan.handled)) {
		return null;
	}

	let planIndex = 0;
	return state.changeByRange(() => {
		const plan = plans[planIndex];
		planIndex += 1;
		if (!plan) {
			throw new Error("Fancify delete plan missing for selection range.");
		}

		return plan.changes.length > 0
			? { range: plan.range, changes: plan.changes }
			: { range: plan.range };
	});
}

export function getTagDeleteRanges(tagPairs: readonly TagPair[]): TagDeleteRange[] {
	return tagPairs
		.flatMap((pair) => [
			{
				from: pair.openingTag.from,
				to: pair.openingTag.to,
				pairId: getPairId(pair),
				token: pair.openingTag,
				pairedToken: pair.closingTag,
			},
			{
				from: pair.closingTag.from,
				to: pair.closingTag.to,
				pairId: getPairId(pair),
				token: pair.closingTag,
				pairedToken: pair.openingTag,
			},
		])
		.sort((left, right) => left.from - right.from || left.to - right.to);
}

function planDeleteRange(
	range: SelectionRange,
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	removedPairIds: Set<string>,
	direction: DeleteDirection,
): DeletePlan {
	if (!range.empty) {
		const selectedTagRanges = findTagRangesOverlappingRange(tagRanges, range);
		const pairDeletionRanges = selectedTagRanges.flatMap((tagRange) =>
			getPairRemovalRanges(doc, tagRange, removedPairIds),
		);
		const deletionRanges = mergeRanges([
			{ from: range.from, to: range.to },
			...pairDeletionRanges,
		]);

		return {
			changes: deletionRanges.map(toDeletionChange),
			range: EditorSelection.cursor(
				mapPositionThroughDeletedRanges(range.from, deletionRanges),
			),
			handled: pairDeletionRanges.length > 0,
			removedTag: pairDeletionRanges.length > 0,
		};
	}

	const tagRange = findTagRangeInDeleteDirection(
		doc,
		tagRanges,
		range.from,
		direction,
	);
	if (tagRange) {
		const deletionRanges = getPairRemovalRanges(
			doc,
			tagRange,
			removedPairIds,
		);
		if (deletionRanges.length > 0) {
			return {
				changes: deletionRanges.map(toDeletionChange),
				range: EditorSelection.cursor(
					mapPositionThroughDeletedRanges(tagRange.from, deletionRanges),
				),
				handled: true,
				removedTag: true,
			};
		}
	}

	const deletionRange = getSingleDeleteRange(doc, range.from, direction);
	if (!deletionRange) {
		return {
			changes: [],
			range,
			handled: false,
			removedTag: false,
		};
	}

	return {
		changes: [toDeletionChange(deletionRange)],
		range: EditorSelection.cursor(deletionRange.from),
		handled: false,
		removedTag: false,
	};
}

function planProtectedCursorDeleteRange(
	range: SelectionRange,
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	removedPairIds: Set<string>,
	direction: DeleteDirection,
): DeletePlan {
	if (!range.empty) {
		return {
			changes: [],
			range,
			handled: false,
			removedTag: false,
		};
	}

	const result = getProtectedDeleteResult(
		doc,
		range.from,
		tagRanges,
		direction,
		);
	if (!result.handled) {
		const deletionRange = result.deletionRange;
		const emptyPairRemovalRanges = deletionRange
			? getPairRemovalRangesMadeAdjacentByDelete(
					doc,
					tagRanges,
					deletionRange,
					removedPairIds,
				)
			: [];
		if (deletionRange && emptyPairRemovalRanges.length > 0) {
			const deletionRanges = mergeRanges([
				deletionRange,
				...emptyPairRemovalRanges,
			]);
			return {
				changes: deletionRanges.map(toDeletionChange),
				range: EditorSelection.cursor(
					mapPositionThroughDeletedRanges(deletionRange.from, deletionRanges),
				),
				handled: true,
				removedTag: true,
			};
		}

		return {
			changes: deletionRange ? [toDeletionChange(deletionRange)] : [],
			range: deletionRange ? EditorSelection.cursor(deletionRange.from) : range,
			handled: false,
			removedTag: false,
		};
	}

	const deletionRangesBeforeCleanup = result.deletionRange
		? [result.deletionRange]
		: [];
	const emptyPairRemovalRanges = getAffectedPairRemovalRangesMadeAdjacentByDelete(
		doc,
		result.affectedTagRanges,
		deletionRangesBeforeCleanup,
		removedPairIds,
	);
	const deletionRanges = mergeRanges([
		...deletionRangesBeforeCleanup,
		...emptyPairRemovalRanges,
	]);

	return {
		changes: deletionRanges.map(toDeletionChange),
		range: EditorSelection.cursor(
			mapPositionThroughDeletedRanges(
				result.deletionRange?.from ?? result.cursorPosition,
				deletionRanges,
			),
		),
		handled: true,
		removedTag: emptyPairRemovalRanges.length > 0,
	};
}

function getProtectedDeleteResult(
	doc: Text,
	position: number,
	tagRanges: readonly TagDeleteRange[],
	direction: DeleteDirection,
): ProtectedDeleteResult {
	let cursorPosition = position;
	const affectedTagRanges: TagDeleteRange[] = [];
	let handled = false;

	while (true) {
		const deletionRange = getSingleDeleteRange(doc, cursorPosition, direction);
		if (!deletionRange) {
			return {
				deletionRange: null,
				cursorPosition,
				affectedTagRanges,
				handled,
			};
		}

		const tagRange = findCurrentTagRangeOverlappingRange(
			doc,
			tagRanges,
			deletionRange,
		);
		if (!tagRange) {
			return {
				deletionRange,
				cursorPosition: deletionRange.from,
				affectedTagRanges,
				handled,
			};
		}

		handled = true;
		affectedTagRanges.push(tagRange);
		const nextCursorPosition = direction < 0 ? tagRange.from : tagRange.to;
		if (nextCursorPosition === cursorPosition) {
			return {
				deletionRange: null,
				cursorPosition,
				affectedTagRanges,
				handled,
			};
		}

		cursorPosition = nextCursorPosition;
	}
}

function findTagRangeInDeleteDirection(
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	position: number,
	direction: DeleteDirection,
): TagDeleteRange | null {
	if (direction < 0) {
		return findTagRangeEndingAt(tagRanges, position) ??
			findTagRangeStartingAt(tagRanges, position) ??
			findStandaloneTagLineBefore(doc, tagRanges, position);
	}

	return findTagRangeStartingAt(tagRanges, position) ??
		findTagRangeEndingAt(tagRanges, position) ??
		findStandaloneTagLineAfter(doc, tagRanges, position);
}

function findStandaloneTagLineBefore(
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	position: number,
): TagDeleteRange | null {
	if (position <= 0 || doc.sliceString(position - 1, position) !== "\n") {
		return null;
	}

	return findTagRangeEndingAt(tagRanges, position - 1);
}

function findStandaloneTagLineAfter(
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	position: number,
): TagDeleteRange | null {
	if (position >= doc.length || doc.sliceString(position, position + 1) !== "\n") {
		return null;
	}

	return findTagRangeStartingAt(tagRanges, position + 1);
}

function findTagRangeEndingAt(
	tagRanges: readonly TagDeleteRange[],
	position: number,
): TagDeleteRange | null {
	const tagRange = tagRanges[findLastRangeStartingAtOrBefore(
		tagRanges,
		position,
	)];
	return tagRange && tagRange.from < position && position <= tagRange.to
		? tagRange
		: null;
}

function findTagRangeStartingAt(
	tagRanges: readonly TagDeleteRange[],
	position: number,
): TagDeleteRange | null {
	const tagRange = tagRanges[findLastRangeStartingAtOrBefore(
		tagRanges,
		position,
	)];
	if (tagRange && tagRange.from <= position && position < tagRange.to) {
		return tagRange;
	}

	const nextTagRange = tagRanges[findFirstRangeStartingAfter(
		tagRanges,
		position,
	)];
	return nextTagRange?.from === position ? nextTagRange : null;
}

function findLastRangeStartingAtOrBefore(
	tagRanges: readonly TagDeleteRange[],
	position: number,
): number {
	let low = 0;
	let high = tagRanges.length - 1;
	let foundIndex = -1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const tagRange = tagRanges[mid];
		if (!tagRange) {
			break;
		}

		if (tagRange.from <= position) {
			foundIndex = mid;
			low = mid + 1;
			continue;
		}

		high = mid - 1;
	}

	return foundIndex;
}

function findFirstRangeStartingAfter(
	tagRanges: readonly TagDeleteRange[],
	position: number,
): number {
	let low = 0;
	let high = tagRanges.length - 1;
	let foundIndex = tagRanges.length;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const tagRange = tagRanges[mid];
		if (!tagRange) {
			break;
		}

		if (tagRange.from > position) {
			foundIndex = mid;
			high = mid - 1;
			continue;
		}

		low = mid + 1;
	}

	return foundIndex;
}

function findTagRangesOverlappingRange(
	tagRanges: readonly TagDeleteRange[],
	range: ScanRange,
): TagDeleteRange[] {
	return tagRanges.filter((tagRange) =>
		tagRange.from < range.to && range.from < tagRange.to,
	);
}

function findCurrentTagRangeOverlappingRange(
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	range: ScanRange,
): TagDeleteRange | null {
	const startIndex = Math.max(
		0,
		findLastRangeStartingAtOrBefore(tagRanges, range.from),
	);

	for (let index = startIndex; index < tagRanges.length; index += 1) {
		const tagRange = tagRanges[index];
		if (!tagRange || tagRange.from >= range.to) {
			break;
		}

		if (rangesOverlap(tagRange, range) && isCurrentTagToken(doc, tagRange.token)) {
			return tagRange;
		}
	}

	return null;
}

function getPairRemovalRangesMadeAdjacentByDelete(
	doc: Text,
	tagRanges: readonly TagDeleteRange[],
	deletionRange: ScanRange,
	removedPairIds: Set<string>,
): ScanRange[] {
	const tagRange = findTagRangeMadeAdjacentByDeleteRange(
		tagRanges,
		deletionRange,
	);
	return tagRange ? getPairRemovalRanges(doc, tagRange, removedPairIds) : [];
}

function findTagRangeMadeAdjacentByDeleteRange(
	tagRanges: readonly TagDeleteRange[],
	deletionRange: ScanRange,
): TagDeleteRange | null {
	const tagRange = findTagRangeEndingAt(tagRanges, deletionRange.from);
	if (!tagRange || tagRange.to !== deletionRange.from) {
		return null;
	}

	const [openingTag, closingTag] = getOrderedPairTokens(tagRange);
	return openingTag.to === deletionRange.from &&
		closingTag.from === deletionRange.to
		? tagRange
		: null;
}

function getAffectedPairRemovalRangesMadeAdjacentByDelete(
	doc: Text,
	affectedTagRanges: readonly TagDeleteRange[],
	deletionRanges: readonly ScanRange[],
	removedPairIds: Set<string>,
): ScanRange[] {
	return mergeRanges(
		affectedTagRanges.flatMap((tagRange) =>
			isPairAdjacentAfterDelete(tagRange, deletionRanges)
				? getPairRemovalRanges(doc, tagRange, removedPairIds)
				: [],
		),
	);
}

function isPairAdjacentAfterDelete(
	tagRange: TagDeleteRange,
	deletionRanges: readonly ScanRange[],
): boolean {
	const [openingTag, closingTag] = getOrderedPairTokens(tagRange);
	return (
		mapPositionThroughDeletedRanges(openingTag.to, deletionRanges) ===
		mapPositionThroughDeletedRanges(closingTag.from, deletionRanges)
	);
}

function getOrderedPairTokens(
	tagRange: TagDeleteRange,
): readonly [TagToken, TagToken] {
	return tagRange.token.from <= tagRange.pairedToken.from
		? [tagRange.token, tagRange.pairedToken]
		: [tagRange.pairedToken, tagRange.token];
}

function getPairRemovalRanges(
	doc: Text,
	tagRange: TagDeleteRange,
	removedPairIds: Set<string>,
): ScanRange[] {
	if (removedPairIds.has(tagRange.pairId)) {
		return [];
	}

	if (
		!isCurrentTagToken(doc, tagRange.token) ||
		!isCurrentTagToken(doc, tagRange.pairedToken)
	) {
		return [];
	}

	removedPairIds.add(tagRange.pairId);
	return mergeRanges([
		...getTagRemovalRanges(doc, tagRange.token),
		...getTagRemovalRanges(doc, tagRange.pairedToken),
	]);
}

function getTagRemovalRanges(doc: Text, token: TagToken): ScanRange[] {
	const line = doc.lineAt(token.from);
	if (
		token.from >= line.from &&
		token.to <= line.to &&
		line.text.trim() === token.text
	) {
		return [getLineRemovalRange(doc.length, line)];
	}

	return [{ from: token.from, to: token.to }];
}

function isCurrentTagToken(doc: Text, token: TagToken): boolean {
	return (
		token.from >= 0 &&
		token.to <= doc.length &&
		doc.sliceString(token.from, token.to) === token.text
	);
}

function getLineRemovalRange(
	docLength: number,
	line: {
		readonly from: number;
		readonly to: number;
	},
): ScanRange {
	if (line.to < docLength) {
		return {
			from: line.from,
			to: line.to + 1,
		};
	}

	if (line.from > 0) {
		return {
			from: line.from - 1,
			to: line.to,
		};
	}

	return {
		from: line.from,
		to: line.to,
	};
}

function toDeletionChange(range: ScanRange): ChangeSpec {
	return {
		from: range.from,
		to: range.to,
		insert: "",
	};
}

function mapPositionThroughDeletedRanges(
	position: number,
	deletionRanges: readonly ScanRange[],
): number {
	let deletedBefore = 0;

	for (const deletionRange of deletionRanges) {
		if (position < deletionRange.from) {
			break;
		}

		if (position <= deletionRange.to) {
			return deletionRange.from - deletedBefore;
		}

		deletedBefore += deletionRange.to - deletionRange.from;
	}

	return position - deletedBefore;
}

function getPairId(pair: TagPair): string {
	return `${pair.openingTag.groupId}:${pair.openingTag.from}:${pair.closingTag.from}`;
}

function getSingleDeleteRange(
	doc: Text,
	position: number,
	direction: DeleteDirection,
): ScanRange | null {
	if (direction < 0) {
		if (position <= 0) {
			return null;
		}

		const line = doc.lineAt(position);
		if (position === line.from) {
			return {
				from: position - 1,
				to: position,
			};
		}

		const linePosition = position - line.from;
		return {
			from: line.from + findClusterBreak(line.text, linePosition, false),
			to: position,
		};
	}

	if (position >= doc.length) {
		return null;
	}

	const line = doc.lineAt(position);
	if (position === line.to) {
		return {
			from: position,
			to: position + 1,
		};
	}

	const linePosition = position - line.from;
	return {
		from: position,
		to: line.from + findClusterBreak(line.text, linePosition),
	};
}
