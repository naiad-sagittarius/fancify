import { buildStyleTokenVariableName } from "./tokens";
import type { StyleToken, StyleTokenId } from "./types";

const styleTokenVariablePrefix = buildStyleTokenVariableName("");

export function getTokens(
	tokens: StyleToken[],
	property: string,
): StyleToken[] {
	return tokens.filter((token) => token.property === property);
}

export function getStyleTokenById(
	tokens: StyleToken[],
	tokenId: StyleTokenId,
): StyleToken | undefined {
	return tokens.find((token) => token.id === tokenId);
}

export function isStyleTokenVariableName(propertyName: string): boolean {
	return propertyName.startsWith(styleTokenVariablePrefix);
}
