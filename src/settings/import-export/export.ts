import type { FancifySettings } from "../settings";
import { getTokens } from "../../styles/helpers";
import type { StyleToken } from "../../styles/types";
import {
	backupFormat,
	importExportFormatVersion,
	presetFormat,
	type FancifyBackupExport,
	type FancifyPresetExport,
	type PresetVariant,
} from "./types";

function cloneSettings(settings: FancifySettings): FancifySettings {
	return JSON.parse(JSON.stringify(settings)) as FancifySettings;
}

function findTokenValue(
	tokensByProperty: Map<string, StyleToken[]>,
	property: string,
	tokenId: string | undefined,
): string | undefined {
	if (!tokenId) {
		return undefined;
	}

	return tokensByProperty
		.get(property)
		?.find((token) => token.id === tokenId)
		?.value;
}

function buildTokensByProperty(
	settings: FancifySettings,
): Map<string, StyleToken[]> {
	const tokensByProperty = new Map<string, StyleToken[]>();
	const properties = new Set(settings.tokens.map((token) => token.property));

	for (const property of properties) {
		tokensByProperty.set(property, getTokens(settings.tokens, property));
	}

	return tokensByProperty;
}

export function createBackupExport(
	settings: FancifySettings,
	pluginVersion: string,
	now = new Date(),
): FancifyBackupExport {
	return {
		format: backupFormat,
		formatVersion: importExportFormatVersion,
		pluginVersion,
		exportedAt: now.toISOString(),
		settings: cloneSettings(settings),
	};
}

export function createPresetExport(
	settings: FancifySettings,
	pluginVersion: string,
	now = new Date(),
): FancifyPresetExport {
	const tokensByProperty = buildTokensByProperty(settings);

	return {
		format: presetFormat,
		formatVersion: importExportFormatVersion,
		pluginVersion,
		exportedAt: now.toISOString(),
		tools: settings.tools.map((tool) => ({
			name: tool.name,
			type: tool.type,
			icon: tool.icon,
			styleFields: tool.styleFields.map((field) => ({
				property: field.property,
			})),
			variants: tool.variants.map<PresetVariant>((variant) => {
				const values: Partial<Record<string, string>> = {};

				for (const field of tool.styleFields) {
					const value = findTokenValue(
						tokensByProperty,
						field.property,
						variant.variantTokens[field.property],
					);
					if (value) {
						values[field.property] = value;
					}
				}

				return {
					name: variant.name,
					commandName: variant.commandName,
					icon: variant.icon,
					values,
				};
			}),
		})),
	};
}

export function stringifyExport(data: unknown): string {
	return `${JSON.stringify(data, null, 2)}\n`;
}
