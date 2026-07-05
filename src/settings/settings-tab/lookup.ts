import type { Tool, Variant } from "../../tools/types";

export interface LocatedTool {
	tool: Tool;
}

export interface LocatedVariant {
	tool: Tool;
	variant: Variant;
}

export function locateTool(
	tools: Tool[],
	toolId: string,
): LocatedTool | undefined {
	const tool = tools.find(
		(candidate) => candidate.id === toolId,
	);
	if (tool) {
		return { tool };
	}

	return undefined;
}

export function locateVariant(
	tools: Tool[],
	variantId: string,
): LocatedVariant | undefined {
	for (const tool of tools) {
		const variant = tool.variants.find(
			(candidate) => candidate.id === variantId,
		);
		if (variant) {
			return { tool, variant };
		}
	}

	return undefined;
}
