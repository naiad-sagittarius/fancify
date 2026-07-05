import type { Text, TransactionSpec } from "@codemirror/state";
import { isHorizontalLineStyleType } from "../styles/types";
import { mergeRanges } from "./decorations/scan-range-utils";
import type { ScanRange, TagPair } from "./decorations/types";
import { textPairUsesLineWrapper } from "./tag-lines";

interface SplitChange {
	readonly from: number;
	readonly insert: string;
}

export interface TagRangeSplitInsertion {
	readonly beforeObject: string;
	readonly afterObject: string;
}

const emptyTagRangeSplitInsertion: TagRangeSplitInsertion = {
	beforeObject: "",
	afterObject: "",
};

export function getTagRangeSplitInsertion(
	doc: Text,
	tagPairs: readonly TagPair[],
	splitRange: ScanRange,
): TagRangeSplitInsertion {
	const containingPairs = getContainingPairs(tagPairs, splitRange);
	if (containingPairs.length === 0) {
		return emptyTagRangeSplitInsertion;
	}

	return {
		beforeObject: [...containingPairs]
			.sort((left, right) => right.openingTag.from - left.openingTag.from)
			.map((pair) => getBeforeObjectText(doc, pair))
			.join(""),
		afterObject: [...containingPairs]
			.sort((left, right) => left.openingTag.from - right.openingTag.from)
			.map((pair) => getAfterInsertedObjectText(doc, pair))
			.join(""),
	};
}

export function createTagRangeSplitTransaction(
	doc: Text,
	tagPairs: readonly TagPair[],
	splitRanges: readonly ScanRange[],
): TransactionSpec | null {
	const changes: SplitChange[] = [];

	for (const splitRange of mergeRanges(splitRanges)) {
		const containingPairs = getContainingPairs(tagPairs, splitRange);
		if (containingPairs.length === 0) {
			continue;
		}

		changes.push({
			from: splitRange.from,
			insert: formatBeforeExistingObjectText(doc, containingPairs),
		});
		changes.push({
			from: splitRange.to,
			insert: formatAfterExistingObjectText(doc, containingPairs),
		});
	}

	const groupedChanges = groupSplitChanges(changes);
	if (groupedChanges.length === 0) {
		return null;
	}

	return {
		changes: groupedChanges,
	};
}

function getContainingPairs(
	tagPairs: readonly TagPair[],
	splitRange: ScanRange,
): TagPair[] {
	return tagPairs.filter((pair) => pairContainsRange(pair, splitRange));
}

function pairContainsRange(pair: TagPair, splitRange: ScanRange): boolean {
	return (
		!isHorizontalLineStyleType(pair.openingTag.styleType) &&
		pair.openingTag.to < splitRange.from &&
		splitRange.to < pair.closingTag.from
	);
}

function getBeforeObjectText(doc: Text, pair: TagPair): string {
	const tag = pair.openingTag.text;

	return textPairUsesLineWrapper(doc, pair) ? `${tag}\n` : tag;
}

function formatBeforeExistingObjectText(
	doc: Text,
	pairs: readonly TagPair[],
): string {
	const sortedPairs = [...pairs].sort(
		(left, right) => right.openingTag.from - left.openingTag.from,
	);
	const text = sortedPairs.map((pair) => getBeforeObjectText(doc, pair)).join("");

	return sortedPairs.some((pair) => textPairUsesLineWrapper(doc, pair))
		? `${text}\n`
		: text;
}

function getAfterInsertedObjectText(doc: Text, pair: TagPair): string {
	const tag = pair.openingTag.text;

	return textPairUsesLineWrapper(doc, pair) ? `\n${tag}` : tag;
}

function formatAfterExistingObjectText(
	doc: Text,
	pairs: readonly TagPair[],
): string {
	const sortedPairs = [...pairs].sort(
		(left, right) => left.openingTag.from - right.openingTag.from,
	);
	const text = sortedPairs.map((pair) => getAfterObjectText(doc, pair)).join("");

	return sortedPairs.some((pair) => textPairUsesLineWrapper(doc, pair))
		? `\n${text}`
		: text;
}

function getAfterObjectText(doc: Text, pair: TagPair): string {
	const tag = pair.openingTag.text;

	return textPairUsesLineWrapper(doc, pair) ? `${tag}\n` : tag;
}

function groupSplitChanges(changes: readonly SplitChange[]): SplitChange[] {
	const groupedChanges = new Map<number, string>();

	for (const change of changes) {
		if (change.insert.length === 0) {
			continue;
		}

		groupedChanges.set(
			change.from,
			`${groupedChanges.get(change.from) ?? ""}${change.insert}`,
		);
	}

	return Array.from(groupedChanges.entries())
		.map(([from, insert]) => ({ from, insert }))
		.sort((left, right) => left.from - right.from);
}
