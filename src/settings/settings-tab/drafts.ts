import { getStyleTokenById } from "../../styles/helpers";
import type { StyleField, StyleToken, StyleType } from "../../styles/types";
import type { Tool, Variant } from "../../tools/types";

export interface DraftTool {
	name: string;
	type: StyleType;
	icon: Tool["icon"] | null;
	styleFields: StyleField[];
	persistedStyleFields: StyleField[];
	dirty: boolean;
	propertyMenuOpen: boolean;
	propertySearch: string;
}

export interface DraftVariant {
	name: string;
	commandName: string;
	icon: Variant["icon"] | null;
	values: Partial<Record<string, string>>;
	fieldErrors: Partial<Record<string, string>>;
	dirty: boolean;
	error: string | null;
}

export function createDraftTool(tool: Tool): DraftTool {
	const styleFields = copyStyleFields(tool.styleFields);
	return {
		name: tool.name,
		type: tool.type,
		icon: tool.icon ?? null,
		styleFields,
		persistedStyleFields: copyStyleFields(styleFields),
		dirty: false,
		propertyMenuOpen: false,
		propertySearch: "",
	};
}

export function createDraftVariant(
	tool: Tool,
	variant: Variant,
	tokens: StyleToken[],
): DraftVariant {
	const values: Partial<Record<string, string>> = {};

	for (const field of tool.styleFields) {
		const tokenId = variant.variantTokens[field.property];
		const token = tokenId ? getStyleTokenById(tokens, tokenId) : undefined;
		values[field.property] = token?.value ?? "";
	}

	return {
		name: variant.name,
		commandName: variant.commandName ?? "",
		icon: variant.icon ?? null,
		values,
		fieldErrors: {},
		dirty: false,
		error: null,
	};
}

export function copyStyleFields(styleFields: StyleField[]): StyleField[] {
	return styleFields.map((field) => ({ property: field.property }));
}
