import {
	compareRanges,
	mergeRanges,
} from "./scan-range-utils";
import type { ScanRange, StyledRange } from "./types";

export function filterStyledRangesByExclusions(
	styledRanges: readonly StyledRange[],
	exclusions: readonly ScanRange[],
): StyledRange[] {
	if (styledRanges.length === 0 || exclusions.length === 0) {
		return styledRanges.map((range) => ({ ...range }));
	}

	const normalisedExclusions = mergeRanges(exclusions);
	const filteredRanges: StyledRange[] = [];
	let exclusionIndex = 0;

	for (const styledRange of [...styledRanges].sort(compareRanges)) {
		while (
			exclusionIndex < normalisedExclusions.length &&
			(normalisedExclusions[exclusionIndex]?.to ?? 0) <= styledRange.from
		) {
			exclusionIndex++;
		}

		let cursor = styledRange.from;
		let localExclusionIndex = exclusionIndex;

		while (localExclusionIndex < normalisedExclusions.length) {
			const exclusion = normalisedExclusions[localExclusionIndex];
			if (!exclusion || exclusion.from >= styledRange.to) {
				break;
			}

			if (exclusion.from > cursor) {
				filteredRanges.push({
					...styledRange,
					from: cursor,
					to: Math.min(exclusion.from, styledRange.to),
				});
			}

			cursor = Math.max(cursor, exclusion.to);
			if (cursor >= styledRange.to) {
				break;
			}

			localExclusionIndex++;
		}

		if (cursor < styledRange.to) {
			filteredRanges.push({
				...styledRange,
				from: cursor,
				to: styledRange.to,
			});
		}
	}

	return filteredRanges;
}
