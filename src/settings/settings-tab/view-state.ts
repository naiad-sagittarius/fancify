import type { DraftTool, DraftVariant } from "./drafts";

export interface SettingsViewState {
	page: "main" | "tool" | "variant";
	selectedPageId: string | null;
	toolDrafts: Map<string, DraftTool>;
	variantDrafts: Map<string, DraftVariant>;
	pageError: string | null;
}

export function createSettingsViewState(): SettingsViewState {
	return {
		page: "main",
		selectedPageId: null,
		toolDrafts: new Map<string, DraftTool>(),
		variantDrafts: new Map<string, DraftVariant>(),
		pageError: null,
	};
}
