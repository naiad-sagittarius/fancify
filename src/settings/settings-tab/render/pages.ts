import type { SettingsTabRenderContext } from "../types";
import { ToolTypePickerModal } from "../tool-type-picker-modal";
import { renderToolListItem } from "./tool-section";
import { renderSectionListPanel } from "./section-list";
import type { ListDragState } from "./list-item-actions";
import type { Tool } from "../../../tools/types";

export function renderPageError(
	container: HTMLElement,
	pageError: string | null,
): void {
	if (!pageError) {
		return;
	}

	container.createDiv({
		cls: "fancify-page-error",
		text: pageError,
	});
}

export function renderMainPage(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
): void {
	const homeHeaderEl = container.createDiv("fancify-home-header");
	homeHeaderEl.createDiv({
		cls: "fancify-home-header-title",
		text: "Fancify",
	});
	homeHeaderEl.createDiv({
		cls: "fancify-home-header-version",
		text: `Version ${tab.plugin.manifest.version}`,
	});

	renderSectionListPanel(container, {
		title: "Tools",
		emptyText: "No tools exist yet.",
		createButtonLabel: "Create tool",
		hasItems: tab.plugin.settings.tools.length > 0,
		onCreate: () => {
			new ToolTypePickerModal(tab.app, (type) => {
				void tab.controller.createTool(type);
			}).open();
		},
		renderItems: (listEl) => {
			const dragState: ListDragState<Tool> = { draggedItem: null };
			for (const [index, tool] of tab.plugin.settings.tools.entries()) {
				renderToolListItem(tab, listEl, tool, index, dragState);
			}
		},
	});
}
