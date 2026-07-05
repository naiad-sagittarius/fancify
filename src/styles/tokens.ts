import { charset } from "../tools/constants";
import type { StyleToken, StyleTokenId } from "./types";

const tokenPrefix = "fancify-token";
const base = charset.length;
const maxSuffix = base * base * base;

export function buildStyleTokenId(
	property: string,
	tokens: StyleToken[],
): StyleTokenId {
	const usedIds = new Set(
		tokens
			.filter((token) => token.property === property)
			.map((token) => token.id),
	);

	for (let index = 0; index < maxSuffix; index++) {
		const first = Math.floor(index / (base * base));
		const second = Math.floor(index / base) % base;
		const third = index % base;
		const suffix = `${charset[first]}${charset[second]}${charset[third]}`;
		const tokenId: StyleTokenId = `${property}-${suffix}`;
		if (!usedIds.has(tokenId)) {
			return tokenId;
		}
	}

	throw new Error(
		`You have reached the maximum number of values for ${property}`,
	);
}

export function buildStyleTokenClass(tokenId: StyleTokenId): string {
	return `${tokenPrefix}-${tokenId}`;
}

export function buildStyleTokenVariableName(tokenId: StyleTokenId): string {
	return `--${tokenPrefix}-${tokenId}`;
}
