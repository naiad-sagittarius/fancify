import type { ScanRange } from "./types";

interface MutableRange {
	from: number;
	to: number;
}

export function compareRanges(left: ScanRange, right: ScanRange): number {
	return left.from - right.from || left.to - right.to;
}

export function rangesOverlap(left: ScanRange, right: ScanRange): boolean {
	return left.from < right.to && right.from < left.to;
}

function advancePastEndedRanges(
	ranges: readonly ScanRange[],
	startIndex: number,
	position: number,
): number {
	let index = startIndex;

	while (index < ranges.length && (ranges[index]?.to ?? 0) <= position) {
		index++;
	}

	return index;
}

export function normaliseRanges(
	ranges: readonly ScanRange[],
	docLength: number,
): ScanRange[] {
	const clampedRanges = ranges
		.map((range) => ({
			from: Math.max(0, Math.min(docLength, range.from)),
			to: Math.max(0, Math.min(docLength, range.to)),
		}))
		.filter((range) => range.from < range.to);

	return mergeRanges(clampedRanges);
}

export function expandRanges(
	ranges: readonly ScanRange[],
	docLength: number,
	buffer: number,
): ScanRange[] {
	return normaliseRanges(
		ranges.map((range) => ({
			from: range.from - buffer,
			to: range.to + buffer,
		})),
		docLength,
	);
}

export function mergeRanges(ranges: readonly ScanRange[]): ScanRange[] {
	if (ranges.length === 0) {
		return [];
	}

	const sortedRanges = [...ranges].sort(compareRanges);
	const mergedRanges: MutableRange[] = [];

	for (const range of sortedRanges) {
		const previousRange = mergedRanges[mergedRanges.length - 1];

		if (previousRange && range.from <= previousRange.to) {
			previousRange.to = Math.max(previousRange.to, range.to);
			continue;
		}

		mergedRanges.push({ from: range.from, to: range.to });
	}

	return mergedRanges.map((range) => ({ ...range }));
}

export function subtractRanges(
	baseRanges: readonly ScanRange[],
	exclusions: readonly ScanRange[],
): ScanRange[] {
	if (baseRanges.length === 0) {
		return [];
	}

	if (exclusions.length === 0) {
		return baseRanges.map((range) => ({ ...range }));
	}

	const normalisedBaseRanges = mergeRanges(baseRanges);
	const normalisedExclusions = mergeRanges(exclusions);
	const result: ScanRange[] = [];

	let exclusionIndex = 0;

	for (const baseRange of normalisedBaseRanges) {
		let cursor = baseRange.from;
		exclusionIndex = advancePastEndedRanges(
			normalisedExclusions,
			exclusionIndex,
			baseRange.from,
		);

		let localExclusionIndex = exclusionIndex;

		while (localExclusionIndex < normalisedExclusions.length) {
			const exclusion = normalisedExclusions[localExclusionIndex];
			if (!exclusion || exclusion.from >= baseRange.to) {
				break;
			}

			if (exclusion.from > cursor) {
				result.push({
					from: cursor,
					to: Math.min(exclusion.from, baseRange.to),
				});
			}

			cursor = Math.max(cursor, exclusion.to);
			if (cursor >= baseRange.to) {
				break;
			}

			localExclusionIndex++;
		}

		if (cursor < baseRange.to) {
			result.push({
				from: cursor,
				to: baseRange.to,
			});
		}
	}

	return result;
}

export function intersectRanges<T extends ScanRange>(
	sourceRanges: readonly T[],
	clipRanges: readonly ScanRange[],
): T[] {
	if (sourceRanges.length === 0 || clipRanges.length === 0) {
		return [];
	}

	const normalisedClips = mergeRanges(clipRanges);
	const sortedSourceRanges = [...sourceRanges].sort(compareRanges);
	const result: T[] = [];
	let clipIndex = 0;

	for (const sourceRange of sortedSourceRanges) {
		clipIndex = advancePastEndedRanges(
			normalisedClips,
			clipIndex,
			sourceRange.from,
		);

		let localClipIndex = clipIndex;

		while (localClipIndex < normalisedClips.length) {
			const clipRange = normalisedClips[localClipIndex];
			if (!clipRange || clipRange.from >= sourceRange.to) {
				break;
			}

			const from = Math.max(sourceRange.from, clipRange.from);
			const to = Math.min(sourceRange.to, clipRange.to);
			if (from < to) {
				result.push({ ...sourceRange, from, to });
			}

			if (clipRange.to >= sourceRange.to) {
				break;
			}

			localClipIndex++;
		}
	}

	return result;
}
