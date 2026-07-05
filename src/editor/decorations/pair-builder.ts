import { isHorizontalLineStyleType } from "../../styles/types";
import type {
	BuildResult,
	InvalidTag,
	ScanRange,
	StyledRange,
	TagPair,
	TagToken,
} from "./types";

export function pairTokens(
	tokens: readonly TagToken[],
	isFullScan: boolean,
): BuildResult {
	const nodes: StyledRange[] = [];
	const tagPairs: TagPair[] = [];
	const invalidTags: InvalidTag[] = [];
	const groups = new Map<string, TagToken[]>();
	let needsWiderScan = false;

	for (const token of tokens) {
		const group = groups.get(token.groupId);
		if (group) {
			group.push(token);
			continue;
		}

		groups.set(token.groupId, [token]);
	}

	for (const group of groups.values()) {
		const sortedGroup = [...group].sort((left, right) => left.from - right.from);
		const firstToken = sortedGroup[0];
		if (!firstToken) {
			continue;
		}

		if (!isFullScan && sortedGroup.length !== 2) {
			needsWiderScan = true;
			continue;
		}

		if (isFullScan && sortedGroup.length !== 2) {
			invalidTags.push(...sortedGroup.map(buildUnpairedInvalidTag));
			continue;
		}

		const openingTag = sortedGroup[0];
		const closingTag = sortedGroup[1];
		if (!openingTag || !closingTag || !isValidPairRange(openingTag, closingTag)) {
			continue;
		}

		tagPairs.push({
			openingTag,
			closingTag,
		});

		nodes.push({
			from: isHorizontalLineStyleType(openingTag.styleType)
				? openingTag.from
				: openingTag.to,
			to: isHorizontalLineStyleType(openingTag.styleType)
				? closingTag.to
				: closingTag.from,
			cssClass: openingTag.cssClass,
			styleType: openingTag.styleType,
		});
	}

	return {
		nodes,
		tagPairs,
		invalidTags,
		needsWiderScan,
	};
}

function buildUnpairedInvalidTag(token: TagToken): InvalidTag {
	return {
		from: token.from,
		to: token.to,
		text: token.text,
		tagPrefix: token.tagPrefix,
		groupId: token.groupId,
		counterIndex: token.counterIndex,
		reason: "unpaired",
	};
}

function isValidPairRange(openingTag: TagToken, closingTag: TagToken): boolean {
	if (isHorizontalLineStyleType(openingTag.styleType)) {
		return openingTag.to === closingTag.from;
	}

	return openingTag.to < closingTag.from;
}

export function getHiddenTagRanges(tagPairs: readonly TagPair[]): ScanRange[] {
	const ranges: ScanRange[] = [];

	for (const pair of tagPairs) {
		if (isHorizontalLineStyleType(pair.openingTag.styleType)) {
			continue;
		}

		ranges.push(
			{
				from: pair.openingTag.from,
				to: pair.openingTag.to,
			},
			{
				from: pair.closingTag.from,
				to: pair.closingTag.to,
			},
		);
	}

	return ranges;
}
