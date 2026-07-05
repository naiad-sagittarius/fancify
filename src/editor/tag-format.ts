import {
	formatKeySegment,
	keySegmentLength,
	maxKeySegmentIndex,
	parseKeySegment,
} from "../tools/key-format";

const tagOpen = "{{";
const tagClose = "}}";
const prefixKeyLength = keySegmentLength * 2;
const counterLength = keySegmentLength;
const tagPrefixLength = tagOpen.length + prefixKeyLength;
const groupIdStart = tagOpen.length;
const groupIdLength = prefixKeyLength + counterLength;
const counterStart = tagPrefixLength;

export const tagLength = tagPrefixLength + counterLength + tagClose.length;
export const maxCounterIndex = maxKeySegmentIndex;

export interface ParsedVariantTag {
	readonly tagPrefix: string;
	readonly groupId: string;
	readonly counterIndex: number;
}

function formatCounter(index: number): string {
	if (index < 0 || index >= maxCounterIndex) {
		throw new RangeError(
			`Fancify counter out of range: ${index}. Max is ${maxCounterIndex - 1}`,
		);
	}

	return formatKeySegment(index);
}

function parseCounter(counter: string): number | undefined {
	if (counter.length !== counterLength) return undefined;
	return parseKeySegment(counter);
}

export function buildVariantTag(
	tagPrefix: string,
	counterIndex: number,
): string {
	return `${tagPrefix}${formatCounter(counterIndex)}${tagClose}`;
}

export function parseVariantTag(
	candidate: string,
): ParsedVariantTag | undefined {
	if (candidate.length !== tagLength) return undefined;
	if (!candidate.startsWith(tagOpen) || !candidate.endsWith(tagClose)) {
		return undefined;
	}

	const counterIndex = parseCounter(
		candidate.slice(counterStart, counterStart + counterLength),
	);
	if (counterIndex === undefined) return undefined;

	return {
		tagPrefix: candidate.slice(0, tagPrefixLength),
		groupId: candidate.slice(
			groupIdStart,
			groupIdStart + groupIdLength,
		),
		counterIndex,
	};
}
