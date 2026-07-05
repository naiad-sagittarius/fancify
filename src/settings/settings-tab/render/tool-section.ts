import {
	elementStyleTypes,
	getToolTypeLabel,
	getStyleTypeLabel,
	isLineStyleType,
	type LineStyleType,
	type StyleType,
} from "../../../styles/types";
import type { Tool, Variant } from "../../../tools/types";
import { ToolIconPickerModal } from "../tool-icon-picker";
import type { SettingsTabRenderContext } from "../types";
import {
	renderIconButton,
	renderTextField,
} from "./fields";
import {
	renderToolIconSlot,
	updateToolIconSlot,
} from "./tool-icon";
import { renderListItemContent } from "./list-item-content";
import {
	type ListDragState,
	renderListItemActions,
} from "./list-item-actions";
import { renderPropertyEditor } from "./property-editor";
import { renderSectionListPanel } from "./section-list";
import { renderVariantListItem } from "./variant-section";

export function renderToolListItem(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	tool: Tool,
	index: number,
	dragState: ListDragState<Tool>,
): void {
	const itemEl = container.createDiv("fancify-list-item");
	itemEl.addClass("is-clickable");
	itemEl.addEventListener("click", () => {
		void tab.controller.openToolPage(tool.id);
	});
	const rowEl = itemEl.createDiv({
		cls: ["fancify-row", "fancify-row-with-icon"],
	});

	const mainEl = rowEl.createDiv("fancify-row-main");
	const iconFrameEl = mainEl.createDiv({
		cls: ["fancify-tool-icon-frame", "fancify-center-content"],
	});
	if (tool.icon) {
		renderToolIconSlot(iconFrameEl, {
			compact: true,
			icon: tool.icon,
			label: "Tool icon",
		});
	} else {
		iconFrameEl.addClass("is-empty");
	}

	renderListItemContent(
		mainEl,
		tool.name,
		"Untitled tool",
	);

	const actionsEl = rowEl.createDiv("fancify-row-actions");
	renderListItemActions({
		actionsEl,
		itemEl,
		item: tool,
		index,
		dragState,
		duplicateLabel: "Duplicate tool",
		deleteLabel: "Delete tool",
		dragLabel: "Move tool",
		onDuplicate: async () => {
			await tab.controller.duplicateTool(tool);
		},
		onDelete: async () => {
			await tab.controller.deleteTool(tool);
		},
		onMove: async (draggedTool, targetIndex) => {
			await tab.controller.moveTool(draggedTool, targetIndex);
		},
	});
}

export function renderToolDetailPage(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	tool: Tool,
): void {
	const draft = tab.controller.toolDraft(tool);
	const headerEl = container.createDiv("fancify-page-header");
	const actionsEl = headerEl.createDiv("fancify-page-header-actions");

	renderIconButton(actionsEl, "Back to tools", "arrow-left", async () => {
		await tab.controller.openMainPage();
	});

	const titleAreaEl = headerEl.createDiv("fancify-tool-title-area");
	const titleRowEl = titleAreaEl.createDiv("fancify-tool-title-row");
	const titleMainEl = titleRowEl.createDiv("fancify-tool-title-main");
	const iconSlotEl = renderToolIconSlot(titleMainEl, {
		icon: draft.icon,
		label: "Change tool icon",
		placeholderStyle: "slash",
		onClick: () => {
			new ToolIconPickerModal(tab.app, draft.icon, (nextIcon) => {
				if (draft.icon === nextIcon) {
					return;
				}

				draft.icon = nextIcon;
				draft.dirty = true;
				updateToolIconSlot(iconSlotEl, nextIcon, "slash");
			}).open();
		},
	});

	renderTextField(titleMainEl, {
		fieldClass: "fancify-tool-title-field",
		inputClass: "fancify-tool-title-input",
		value: draft.name,
		placeholder: "Tool name",
		onChange: (value) => {
			draft.name = value;
			draft.dirty = true;
		},
	});
	renderToolTypeLabel(titleRowEl, draft.type);
	if (isLineStyleType(draft.type)) {
		renderToolElementTypePicker(tab, titleAreaEl, tool, draft.type);
	}

	const editorEl = container.createDiv("fancify-tool-editor");

	renderPropertyEditor(tab, editorEl, tool, draft);

	renderSectionListPanel(editorEl, {
		title: "Variants",
		emptyText: "No variants exist yet.",
		createButtonLabel: "Create variant",
		hasItems: tool.variants.length > 0,
		onCreate: async () => {
			await tab.controller.createVariant(tool);
		},
		renderItems: (listEl) => {
			const dragState: ListDragState<Variant> = { draggedItem: null };
			for (const [index, variant] of tool.variants.entries()) {
				renderVariantListItem(tab, listEl, variant, index, dragState);
			}
		},
	});
}

function renderToolTypeLabel(container: HTMLElement, type: StyleType): void {
	const label = getToolTypeLabel(type);
	container.createDiv({
		attr: {
			title: `Tool type: ${label}`,
		},
		cls: ["fancify-tool-type-label", "fancify-center-content"],
		text: label,
	});
}

function renderToolElementTypePicker(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	tool: Tool,
	selectedType: LineStyleType,
): void {
	const pickerEl = container.createDiv("fancify-tool-element-picker");
	pickerEl.createDiv({
		cls: ["fancify-tool-element-picker-label", "fancify-center-content"],
		text: "Type",
	});

	const optionsEl = pickerEl.createDiv("fancify-tool-element-options");
	optionsEl.setAttribute("role", "radiogroup");
	optionsEl.setAttribute("aria-label", "Type");

	for (const type of elementStyleTypes) {
		const isSelected = type === selectedType;
		const label = getStyleTypeLabel(type);
		const buttonEl = optionsEl.createEl("button", {
			attr: {
				type: "button",
				role: "radio",
				"aria-checked": String(isSelected),
			},
			cls: [
				"fancify-tool-element-option",
				isSelected ? "is-active" : "",
			],
			text: label,
		});
		buttonEl.addEventListener("click", () => {
			tab.controller.setToolType(tool, type);
		});
	}
}
