import { buildTokenMap, cleanTokens } from "../settings-tab/tokens";
import type { FancifySettings } from "../settings";
import { createDefaultSettings } from "../settings";
import { isPropertyStyleType } from "../../styles/properties";
import type { StyleField, StyleType } from "../../styles/types";
import { createTool, createVariant } from "../../tools/factory";
import type { Tool, Variant } from "../../tools/types";
import { type Validation, validateStyleValue } from "../../validation";
import {
	backupFormat,
	importExportFormatVersion,
	presetFormat,
	type FancifyBackupExport,
	type FancifyImportExport,
	type FancifyPresetExport,
	type PresetTool,
	type PresetVariant,
} from "./types";

const validStyleTypes = new Set<StyleType>([
	"inline",
	"block",
	"horizontal-line",
	"vertical-line",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(
	record: Record<string, unknown>,
	property: string,
): string | null {
	const value = record[property];
	return typeof value === "string" ? value : null;
}

function getOptionalString(
	record: Record<string, unknown>,
	property: string,
): string | undefined {
	const value = record[property];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseJson(text: string): Validation<unknown> {
	try {
		return { valid: true, value: JSON.parse(text) as unknown };
	} catch {
		return { valid: false, message: "Import file is not valid JSON." };
	}
}

function cloneSettings(settings: FancifySettings): FancifySettings {
	return {
		tools: settings.tools.map((tool) => ({
			...tool,
			styleFields: tool.styleFields.map((field) => ({ ...field })),
			variants: tool.variants.map((variant) => ({
				...variant,
				variantTokens: { ...variant.variantTokens },
			})),
		})),
		tokens: settings.tokens.map((token) => ({ ...token })),
	};
}

function validateStyleFields(
	fields: unknown,
	type: StyleType,
): Validation<StyleField[]> {
	if (!Array.isArray(fields)) {
		return { valid: false, message: "Tool style fields are missing." };
	}

	const styleFields: StyleField[] = [];
	const usedProperties = new Set<string>();

	for (const field of fields) {
		if (!isRecord(field)) {
			return { valid: false, message: "Tool style field is invalid." };
		}

		const property = getString(field, "property");
		if (!property) {
			return { valid: false, message: "Tool style field property is missing." };
		}

		if (!isPropertyStyleType(property, type)) {
			return {
				valid: false,
				message: `Property "${property}" is not valid for ${type} tools.`,
			};
		}

		if (!usedProperties.has(property)) {
			usedProperties.add(property);
			styleFields.push({ property });
		}
	}

	return { valid: true, value: styleFields };
}

function validatePresetVariant(
	value: unknown,
	styleFields: StyleField[],
): Validation<PresetVariant> {
	if (!isRecord(value)) {
		return { valid: false, message: "Variant entry is invalid." };
	}

	const name = getString(value, "name");
	if (!name) {
		return { valid: false, message: "Variant name is missing." };
	}

	if (!isRecord(value.values)) {
		return { valid: false, message: `Variant "${name}" values are missing.` };
	}

	const values: Partial<Record<string, string>> = {};
	const fieldProperties = new Set(styleFields.map((field) => field.property));

	for (const property of Object.keys(value.values)) {
		if (!fieldProperties.has(property)) {
			continue;
		}

		const rawValue = value.values[property];
		if (typeof rawValue !== "string") {
			return {
				valid: false,
				message: `Variant "${name}" has an invalid value for "${property}".`,
			};
		}

		const validation = validateStyleValue(property, rawValue);
		if (!validation.valid) {
			return {
				valid: false,
				message: `Variant "${name}" has an invalid value for "${property}": ${validation.message}`,
			};
		}

		if (validation.value) {
			values[property] = validation.value;
		}
	}

	return {
		valid: true,
		value: {
			name,
			commandName: getOptionalString(value, "commandName"),
			icon: getOptionalString(value, "icon"),
			values,
		},
	};
}

function validatePresetTool(value: unknown): Validation<PresetTool> {
	if (!isRecord(value)) {
		return { valid: false, message: "Tool entry is invalid." };
	}

	const name = getString(value, "name");
	if (!name) {
		return { valid: false, message: "Tool name is missing." };
	}

	const type = getString(value, "type");
	if (!type || !validStyleTypes.has(type as StyleType)) {
		return { valid: false, message: `Tool "${name}" has an invalid type.` };
	}

	const styleFields = validateStyleFields(value.styleFields, type as StyleType);
	if (!styleFields.valid) {
		return styleFields;
	}

	if (!Array.isArray(value.variants)) {
		return { valid: false, message: `Tool "${name}" variants are missing.` };
	}

	const variants: PresetVariant[] = [];
	for (const variant of value.variants) {
		const validatedVariant = validatePresetVariant(
			variant,
			styleFields.value,
		);
		if (!validatedVariant.valid) {
			return validatedVariant;
		}
		variants.push(validatedVariant.value);
	}

	return {
		valid: true,
		value: {
			name,
			type: type as StyleType,
			icon: getOptionalString(value, "icon"),
			styleFields: styleFields.value,
			variants,
		},
	};
}

function validatePresetExport(
	value: Record<string, unknown>,
): Validation<FancifyPresetExport> {
	if (!Array.isArray(value.tools)) {
		return { valid: false, message: "Preset tools are missing." };
	}

	const tools: PresetTool[] = [];
	for (const tool of value.tools) {
		const validatedTool = validatePresetTool(tool);
		if (!validatedTool.valid) {
			return validatedTool;
		}
		tools.push(validatedTool.value);
	}

	return {
		valid: true,
		value: {
			format: presetFormat,
			formatVersion: importExportFormatVersion,
			pluginVersion: getString(value, "pluginVersion") ?? "",
			exportedAt: getString(value, "exportedAt") ?? "",
			tools,
		},
	};
}

function validateVariant(value: unknown): Validation<Variant> {
	if (!isRecord(value)) {
		return { valid: false, message: "Backup variant entry is invalid." };
	}

	const id = getString(value, "id");
	const name = getString(value, "name");
	const variantKey = getString(value, "variantKey");
	const tagPrefix = getString(value, "tagPrefix");
	if (!id || !name || !variantKey || !tagPrefix) {
		return { valid: false, message: "Backup variant is missing required data." };
	}

	if (!isRecord(value.variantTokens)) {
		return { valid: false, message: `Variant "${name}" tokens are invalid.` };
	}

	const variantTokens: Partial<Record<string, string>> = {};
	for (const [property, tokenId] of Object.entries(value.variantTokens)) {
		if (typeof tokenId === "string" && tokenId) {
			variantTokens[property] = tokenId;
		}
	}

	const variant: Variant = {
		id,
		name,
		variantKey,
		tagPrefix,
		variantTokens,
	};

	const commandName = getOptionalString(value, "commandName");
	if (commandName) {
		variant.commandName = commandName;
	}

	const icon = getOptionalString(value, "icon");
	if (icon) {
		variant.icon = icon;
	}

	return { valid: true, value: variant };
}

function validateTool(value: unknown): Validation<Tool> {
	if (!isRecord(value)) {
		return { valid: false, message: "Backup tool entry is invalid." };
	}

	const id = getString(value, "id");
	const name = getString(value, "name");
	const type = getString(value, "type");
	const toolKey = getString(value, "toolKey");
	if (!id || !name || !type || !validStyleTypes.has(type as StyleType) || !toolKey) {
		return { valid: false, message: "Backup tool is missing required data." };
	}

	const styleFields = validateStyleFields(value.styleFields, type as StyleType);
	if (!styleFields.valid) {
		return styleFields;
	}

	if (!Array.isArray(value.variants)) {
		return { valid: false, message: `Tool "${name}" variants are missing.` };
	}

	const variants: Variant[] = [];
	for (const variant of value.variants) {
		const validatedVariant = validateVariant(variant);
		if (!validatedVariant.valid) {
			return validatedVariant;
		}
		variants.push(validatedVariant.value);
	}

	const tool: Tool = {
		id,
		name,
		type: type as StyleType,
		toolKey,
		styleFields: styleFields.value,
		variants,
	};

	const icon = getOptionalString(value, "icon");
	if (icon) {
		tool.icon = icon;
	}

	return { valid: true, value: tool };
}

function validateBackupExport(
	value: Record<string, unknown>,
): Validation<FancifyBackupExport> {
	if (!isRecord(value.settings)) {
		return { valid: false, message: "Backup settings are missing." };
	}

	const settings = createDefaultSettings();
	if (!Array.isArray(value.settings.tools)) {
		return { valid: false, message: "Backup tools are missing." };
	}

	for (const tool of value.settings.tools) {
		const validatedTool = validateTool(tool);
		if (!validatedTool.valid) {
			return validatedTool;
		}
		settings.tools.push(validatedTool.value);
	}

	if (!Array.isArray(value.settings.tokens)) {
		return { valid: false, message: "Backup tokens are missing." };
	}

	for (const token of value.settings.tokens) {
		if (!isRecord(token)) {
			return { valid: false, message: "Backup token entry is invalid." };
		}
		const id = getString(token, "id");
		const property = getString(token, "property");
		const tokenValue = getString(token, "value");
		if (!id || !property || tokenValue === null) {
			return { valid: false, message: "Backup token is missing required data." };
		}
		settings.tokens.push({ id, property, value: tokenValue });
	}

	cleanTokens(settings);

	return {
		valid: true,
		value: {
			format: backupFormat,
			formatVersion: importExportFormatVersion,
			pluginVersion: getString(value, "pluginVersion") ?? "",
			exportedAt: getString(value, "exportedAt") ?? "",
			settings,
		},
	};
}

export function parseFancifyImport(
	text: string,
): Validation<FancifyImportExport> {
	const parsed = parseJson(text);
	if (!parsed.valid) {
		return parsed;
	}

	if (!isRecord(parsed.value)) {
		return { valid: false, message: "Import file has an invalid structure." };
	}

	const format = getString(parsed.value, "format");
	const formatVersion = parsed.value.formatVersion;
	if (formatVersion !== importExportFormatVersion) {
		return {
			valid: false,
			message: "Import file uses an unsupported format version.",
		};
	}

	if (format === presetFormat) {
		return validatePresetExport(parsed.value);
	}

	if (format === backupFormat) {
		return validateBackupExport(parsed.value);
	}

	return { valid: false, message: "Import file is not a Fancify export." };
}

export function appendPresetImport(
	settings: FancifySettings,
	preset: FancifyPresetExport,
): Validation<number> {
	const nextSettings = cloneSettings(settings);
	let importedTools = 0;

	try {
		for (const presetTool of preset.tools) {
			const tool = createTool(
				nextSettings.tools,
				presetTool.name,
				presetTool.type,
				presetTool.styleFields.map((field) => ({ ...field })),
				presetTool.icon,
			);

			for (const presetVariant of presetTool.variants) {
				const tokenMap = buildTokenMap({
					tool,
					tokens: nextSettings.tokens,
					values: presetVariant.values,
				});
				if (!tokenMap.valid) {
					return { valid: false, message: tokenMap.message };
				}

				const variant = createVariant(
					tool,
					presetVariant.name,
					tokenMap.value,
					presetVariant.icon,
				);
				if (presetVariant.commandName) {
					variant.commandName = presetVariant.commandName;
				}
			}

			importedTools += 1;
		}
	} catch (error) {
		return {
			valid: false,
			message:
				error instanceof Error
					? error.message
					: "Failed to import preset.",
		};
	}

	cleanTokens(nextSettings);
	settings.tools.splice(0, settings.tools.length, ...nextSettings.tools);
	settings.tokens.splice(0, settings.tokens.length, ...nextSettings.tokens);
	return { valid: true, value: importedTools };
}
