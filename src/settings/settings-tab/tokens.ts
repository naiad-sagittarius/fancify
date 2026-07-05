import { buildStyleTokenId } from "../../styles/tokens";
import { getTokens } from "../../styles/helpers";
import type { PropertyTokenMap, StyleToken } from "../../styles/types";
import type { FancifySettings } from "../settings";
import type { Tool } from "../../tools/types";
import { type Validation, validateStyleValue } from "../../validation";

function normaliseTokenValue(value: string): string {
	return value.trim();
}

function buildTokenCounts(tools: Tool[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const tool of tools) {
		for (const variant of tool.variants) {
			for (const tokenId of Object.values(variant.variantTokens)) {
				if (tokenId) {
					counts.set(tokenId, (counts.get(tokenId) ?? 0) + 1);
				}
			}
		}
	}

	return counts;
}

export function cleanTokens(
	settings: FancifySettings,
	properties?: Iterable<string>,
): void {
	const counts = buildTokenCounts(settings.tools);
	const propertyFilter = properties ? new Set(properties) : null;
	settings.tokens = settings.tokens.filter((token) => {
		if (propertyFilter && !propertyFilter.has(token.property)) {
			return true;
		}

		return (counts.get(token.id) ?? 0) > 0;
	});
}

function findMatchingToken(
	tokens: StyleToken[],
	property: string,
	value: string,
): StyleToken | undefined {
	const normalisedValue = normaliseTokenValue(value);
	return normalisedValue
		? getTokens(tokens, property).find(
				(token) => normaliseTokenValue(token.value) === normalisedValue,
			)
		: undefined;
}

function buildToken(
	tokens: StyleToken[],
	property: string,
	value: string,
): string {
	const matchingToken = findMatchingToken(tokens, property, value);
	if (matchingToken) {
		return matchingToken.id;
	}

	const createdToken: StyleToken = {
		id: buildStyleTokenId(property, tokens),
		property,
		value,
	};
	tokens.push(createdToken);
	return createdToken.id;
}

export function getValueSuggestions(
	tokens: StyleToken[],
	property: string,
	query: string,
): StyleToken[] {
	const propertyTokens = getTokens(tokens, property);
	const normalisedQuery = query.trim().toLowerCase();
	const suggestions: StyleToken[] = [];

	for (const token of propertyTokens) {
		const lowerCaseValue = token.value.trim().toLowerCase();
		if (normalisedQuery && !lowerCaseValue.includes(normalisedQuery)) {
			continue;
		}

		suggestions.push(token);
	}

	return suggestions;
}

export function buildTokenMap(params: {
	tool: Tool;
	tokens: StyleToken[];
	values: Partial<Record<string, string>>;
}): Validation<PropertyTokenMap> {
	const nextPropertyTokenMap: PropertyTokenMap = {};
	const availableTokens = [...params.tokens];

	for (const field of params.tool.styleFields) {
		const rawValue = params.values[field.property] ?? "";
		const normalisedValue = normaliseTokenValue(rawValue);
		if (!normalisedValue) {
			continue;
		}

		const validation = validateStyleValue(field.property, normalisedValue);
		if (!validation.valid) {
			return {
				valid: false,
				message: validation.message,
				property: field.property,
			};
		}

		nextPropertyTokenMap[field.property] = buildToken(
			availableTokens,
			field.property,
			validation.value,
		);
	}

	params.tokens.splice(0, params.tokens.length, ...availableTokens);
	return { valid: true, value: nextPropertyTokenMap };
}
