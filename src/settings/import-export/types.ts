import type { FancifySettings } from "../settings";
import type { StyleType } from "../../styles/types";

export const backupFormat = "fancify-settings";
export const presetFormat = "fancify-preset";
export const importExportFormatVersion = 1;

export interface FancifyBackupExport {
	format: typeof backupFormat;
	formatVersion: typeof importExportFormatVersion;
	pluginVersion: string;
	exportedAt: string;
	settings: FancifySettings;
}

export interface FancifyPresetExport {
	format: typeof presetFormat;
	formatVersion: typeof importExportFormatVersion;
	pluginVersion: string;
	exportedAt: string;
	tools: PresetTool[];
}

export interface PresetTool {
	name: string;
	type: StyleType;
	icon?: string;
	styleFields: PresetStyleField[];
	variants: PresetVariant[];
}

export interface PresetStyleField {
	property: string;
}

export interface PresetVariant {
	name: string;
	commandName?: string;
	icon?: string;
	values: Partial<Record<string, string>>;
}

export type FancifyImportExport = FancifyBackupExport | FancifyPresetExport;
