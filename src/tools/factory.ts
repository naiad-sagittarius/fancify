import {
	buildKey,
	buildToolId,
	buildTagPrefix,
	buildVariantId,
} from "./builder";
import type { Tool, Variant } from "./types";
import type { PropertyTokenMap, StyleField, StyleType } from "../styles/types";

export function createTool(
	existingTools: Tool[],
	name: string,
	type: StyleType,
	styleFields: StyleField[] = [],
	icon?: Tool["icon"],
): Tool {
	const toolKey = buildKey(
		existingTools,
		(tool) => tool.toolKey,
	);

	const tool: Tool = {
		id: buildToolId(toolKey),
		name,
		type,
		icon,
		toolKey,
		styleFields,
		variants: [],
	};

	existingTools.push(tool);
	return tool;
}

export function createVariant(
	tool: Tool,
	name: string,
	variantTokens: PropertyTokenMap = {},
	icon?: Variant["icon"],
): Variant {
	const variantKey = buildKey(
		tool.variants,
		(variant) => variant.variantKey,
	);
	const normalisedPropertyTokenMap: PropertyTokenMap = {};

	for (const field of tool.styleFields) {
		const tokenId = variantTokens[field.property];
		if (typeof tokenId === "string" && tokenId) {
			normalisedPropertyTokenMap[field.property] = tokenId;
		}
	}

	const variant: Variant = {
		id: buildVariantId(tool.toolKey, variantKey),
		name,
		variantKey,
		tagPrefix: buildTagPrefix(tool.toolKey, variantKey),
		variantTokens: normalisedPropertyTokenMap,
		icon,
	};

	tool.variants.push(variant);
	return variant;
}
