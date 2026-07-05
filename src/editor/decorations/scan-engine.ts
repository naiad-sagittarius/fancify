import type { Text } from "@codemirror/state";
import type { Tree } from "@lezer/common";
import { collectSyntaxExclusions } from "./exclusion-collector";
import { pairTokens } from "./pair-builder";
import {
	mergeRanges,
	normaliseRanges,
	subtractRanges,
} from "./scan-range-utils";
import {
	matchVariantTagCandidates,
	scanVariantTagCandidates,
	type VariantTagCandidate,
} from "./tag-scanner";
import { filterStyledRangesByExclusions } from "./styled-range-filter";
import { collectTextInlineCodeExclusions } from "./text-exclusion-collector";
import type { BuildResult, InvalidTag, ScanRange } from "./types";

export class FancifyScanEngine {
	build(
		tree: Tree,
		doc: Text,
		ranges: readonly ScanRange[],
		documentBlockExclusions: readonly ScanRange[] = [],
	): BuildResult {
		const normalisedRanges = normaliseRanges(
			ranges.length > 0 ? ranges : [{ from: 0, to: doc.length }],
			doc.length,
		);
		const [fullRange] = normalisedRanges;
		const isFullScan =
			normalisedRanges.length === 1 &&
			fullRange?.from === 0 &&
			fullRange?.to === doc.length;

		const syntaxExclusions = collectSyntaxExclusions(tree, normalisedRanges);
		const blockExclusions = mergeRanges([
			...documentBlockExclusions,
			...syntaxExclusions,
		]);
		const inlineCodeExclusions = collectTextInlineCodeExclusions(
			doc,
			subtractRanges(normalisedRanges, blockExclusions),
		);
		const exclusions = mergeRanges([
			...blockExclusions,
			...inlineCodeExclusions,
		]);
		const allowedRanges = subtractRanges(normalisedRanges, exclusions);
		const tagCandidates = scanVariantTagCandidates(doc, allowedRanges);
		const tokens = matchVariantTagCandidates(tagCandidates);
		const pairedResult = pairTokens(tokens, isFullScan);
		const nodes = filterStyledRangesByExclusions(
			pairedResult.nodes,
			exclusions,
		);
		const knownTagRangeIds = new Set(tokens.map(formatRangeId));
		const unknownPrefixTags = tagCandidates
			.filter((candidate) => !knownTagRangeIds.has(formatRangeId(candidate)))
			.map(buildUnknownPrefixInvalidTag);

		return {
			...pairedResult,
			nodes,
			invalidTags: [...unknownPrefixTags, ...pairedResult.invalidTags],
		};
	}
}

function formatRangeId(range: ScanRange): string {
	return `${range.from}:${range.to}`;
}

function buildUnknownPrefixInvalidTag(candidate: VariantTagCandidate): InvalidTag {
	return {
		from: candidate.from,
		to: candidate.to,
		text: candidate.text,
		tagPrefix: candidate.parsedTag.tagPrefix,
		groupId: candidate.parsedTag.groupId,
		counterIndex: candidate.parsedTag.counterIndex,
		reason: "unknown-prefix",
	};
}
