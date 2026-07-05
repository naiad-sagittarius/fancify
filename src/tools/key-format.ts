import { charset } from "./constants";

export type KeySegment = string;

export const keySegmentLength = 2;

const base = charset.length;

export const maxKeySegmentIndex = base * base;

const keyIndexLookup = new Map<string, number>(
	charset.map((char, index) => [char, index]),
);

export function formatKeySegment(index: number): KeySegment {
	if (index < 0 || index >= maxKeySegmentIndex) {
		throw new RangeError(
			`Fancify key out of range: ${index}. Max is ${maxKeySegmentIndex - 1}`,
		);
	}

	const high = Math.floor(index / base);
	const low = index % base;

	return `${charset[high]}${charset[low]}`;
}

export function parseKeySegment(key: string): number | undefined {
	if (key.length !== keySegmentLength) return undefined;

	const first = keyIndexLookup.get(key.charAt(0));
	const second = keyIndexLookup.get(key.charAt(1));

	if (first === undefined || second === undefined) return undefined;

	return first * base + second;
}
