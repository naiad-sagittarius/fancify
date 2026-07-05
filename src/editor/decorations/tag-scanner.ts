import type { Text } from "@codemirror/state";
import { getVariantDecorationClassName } from "../../styles/dom";
import type { StyleType } from "../../styles/types";
import type { Tool } from "../../tools/types";
import {
	type ParsedVariantTag,
	parseVariantTag,
	tagLength,
} from "../tag-format";
import type { ScanRange, TagToken } from "./types";

interface TagPrefixInfo {
	readonly cssClass: string;
	readonly styleType: StyleType;
}

export interface VariantTagCandidate extends ScanRange {
	readonly text: string;
	readonly parsedTag: ParsedVariantTag;
}

const prefixMap = new Map<string, TagPrefixInfo>();
const tagCandidateStart = "{{";

export function rebuildTagPrefixLookup(tools: Tool[]): void {
	prefixMap.clear();

	for (const tool of tools) {
		for (const variant of tool.variants) {
			prefixMap.set(
				variant.tagPrefix,
				{
					cssClass: getVariantDecorationClassName(
						variant,
						tool.type,
					),
					styleType: tool.type,
				},
			);
		}
	}
}

export function clearTagPrefixLookup(): void {
	prefixMap.clear();
}

export function scanTags(doc: Text, ranges: readonly ScanRange[]): TagToken[] {
	return matchVariantTagCandidates(scanVariantTagCandidates(doc, ranges));
}

export function matchVariantTagCandidates(
	candidates: readonly VariantTagCandidate[],
): TagToken[] {
	const tokens: TagToken[] = [];

	for (const candidate of candidates) {
		const prefixInfo = matchPrefix(candidate.parsedTag.tagPrefix);
		if (!prefixInfo) {
			continue;
		}

		tokens.push({
			from: candidate.from,
			to: candidate.to,
			groupId: candidate.parsedTag.groupId,
			tagPrefix: candidate.parsedTag.tagPrefix,
			counterIndex: candidate.parsedTag.counterIndex,
			text: candidate.text,
			cssClass: prefixInfo.cssClass,
			styleType: prefixInfo.styleType,
		});
	}

	return tokens;
}

export function scanVariantTagCandidates(
	doc: Text,
	ranges: readonly ScanRange[],
): VariantTagCandidate[] {
	const candidates: VariantTagCandidate[] = [];

	for (const range of ranges) {
		const text = doc.sliceString(range.from, range.to);
		let searchIndex = 0;

		while (searchIndex <= text.length - 1) {
			const relativeTagIndex = text.indexOf(tagCandidateStart, searchIndex);
			if (relativeTagIndex === -1) {
				break;
			}

			if (relativeTagIndex + tagLength > text.length) {
				break;
			}

			const candidate = text.slice(
				relativeTagIndex,
				relativeTagIndex + tagLength,
			);
			const parsedTag = parseVariantTag(candidate);
			if (parsedTag) {
				const from = range.from + relativeTagIndex;
				candidates.push({
					from,
					to: from + tagLength,
					text: candidate,
					parsedTag,
				});
				searchIndex = relativeTagIndex + tagLength;
				continue;
			}

			searchIndex = relativeTagIndex + 1;
		}
	}

	return candidates;
}

function matchPrefix(prefix: string): TagPrefixInfo | undefined {
	return prefixMap.get(prefix);
}
