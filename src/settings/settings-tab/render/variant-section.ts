import { TextComponent } from "obsidian";
import { setSafeIcon } from "../../../tools/icon-rendering";
import {
	getStyleProperty,
	getStylePropertyDefaultValue,
	getStylePropertyLabel,
	getStylePropertyOptionLabel,
} from "../../../styles/properties";
import type { Tool, Variant } from "../../../tools/types";
import { ToolIconPickerModal } from "../tool-icon-picker";
import { getDisplayName } from "../helpers";
import type { DraftVariant } from "../drafts";
import type { SettingsTabRenderContext } from "../types";
import { renderColorValueField } from "./color-value-field";
import { renderIconButton, renderTextField } from "./fields";
import { type ListDragState, renderListItemActions } from "./list-item-actions";
import { renderToolIconSlot, updateToolIconSlot } from "./tool-icon";
import { renderNumberValueField } from "./number-value-field";
import { renderSelectValueField } from "./select-value-field";

export function renderVariantListItem(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	variant: Variant,
	index: number,
	dragState: ListDragState<Variant>,
): void {
	const itemEl = container.createDiv("fancify-list-item");
	itemEl.addClass("is-clickable");
	itemEl.addEventListener("click", () => {
		void tab.controller.openVariantPage(variant.id);
	});
	const rowEl = itemEl.createDiv({
		cls: ["fancify-row", "fancify-row-with-icon", "fancify-variant-row"],
	});

	const mainEl = rowEl.createDiv("fancify-row-main");
	const iconFrameEl = mainEl.createDiv({
		cls: ["fancify-tool-icon-frame", "fancify-center-content"],
	});
	if (variant.icon) {
		renderToolIconSlot(iconFrameEl, {
			compact: true,
			icon: variant.icon,
			label: "Variant icon",
		});
	} else {
		iconFrameEl.addClass("is-empty");
	}

	mainEl.createDiv({
		cls: "fancify-row-label",
		text: getDisplayName(variant.name, "Untitled variant"),
	});

	const actionsEl = rowEl.createDiv("fancify-row-actions");
	renderListItemActions({
		actionsEl,
		itemEl,
		item: variant,
		index,
		dragState,
		duplicateLabel: "Duplicate variant",
		deleteLabel: "Delete variant",
		dragLabel: "Move variant",
		onDuplicate: async () => {
			await tab.controller.duplicateVariant(variant);
		},
		onDelete: async () => {
			await tab.controller.deleteVariant(variant);
		},
		onMove: async (draggedVariant, targetIndex) => {
			await tab.controller.moveVariant(draggedVariant, targetIndex);
		},
	});
	if (actionsEl.children.length === 1) {
		const singleChild = actionsEl.firstElementChild;
		if (
			singleChild &&
			singleChild.matches("button.fancify-icon-button.is-danger")
		) {
			actionsEl.addClass("has-single-danger-button");
		}
	}
}

export function renderVariantDetailPage(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	tool: Tool,
	variant: Variant,
): void {
	const draft = tab.controller.variantDraft(tool, variant);
	const headerEl = container.createDiv("fancify-page-header");
	const actionsEl = headerEl.createDiv("fancify-page-header-actions");

	renderIconButton(actionsEl, "Back to tool", "arrow-left", async () => {
		await tab.controller.openToolPage(tool.id);
	});

	const titleAreaEl = headerEl.createDiv("fancify-tool-title-area");
	const titleRowEl = titleAreaEl.createDiv("fancify-tool-title-row");
	const titleMainEl = titleRowEl.createDiv("fancify-tool-title-main");
	const iconSlotEl = renderToolIconSlot(titleMainEl, {
		icon: draft.icon,
		label: "Change variant icon",
		placeholderStyle: "slash",
		onClick: () => {
			new ToolIconPickerModal(tab.app, draft.icon, (nextIcon) => {
				if (draft.icon === nextIcon) {
					return;
				}

				draft.icon = nextIcon;
				draft.dirty = true;
				draft.error = null;
				updateToolIconSlot(iconSlotEl, nextIcon, "slash");
			}).open();
		},
	});

	renderTextField(titleMainEl, {
		fieldClass: "fancify-variant-title-field",
		inputClass: "fancify-variant-title-input",
		value: draft.name,
		placeholder: "Variant name",
		onChange: (value) => {
			draft.name = value;
			draft.dirty = true;
			draft.error = null;
		},
	});

	const editorEl = container.createDiv("fancify-variant-editor");
	renderCommandNameField(editorEl, draft);

	if (tool.styleFields.length === 0) {
		editorEl.createDiv({
			cls: "fancify-empty-state",
			text: "Add properties to the tool before editing variant values.",
		});
	} else {
		const valuesEl = editorEl.createDiv({
			cls: ["fancify-value-grid", "fancify-value-list"],
		});
		for (const field of tool.styleFields) {
			renderVariantValueRow(tab, valuesEl, field.property, draft);
		}
	}

	if (draft.error) {
		editorEl.createDiv({
			cls: "fancify-inline-error",
			text: draft.error,
		});
	}
}

function renderCommandNameField(
	container: HTMLElement,
	draft: DraftVariant,
): void {
	const fieldEl = container.createDiv("fancify-command-field");
	const iconEl = fieldEl.createSpan({
		cls: ["fancify-command-field-icon", "fancify-center-content"],
		attr: { "aria-hidden": "true" },
	});
	setSafeIcon(iconEl, "terminal", "square-terminal");

	const textComponent = new TextComponent(
		fieldEl.createDiv("fancify-command-field-control"),
	);
	textComponent.setPlaceholder("Set custom command name");
	textComponent.setValue(draft.commandName);
	textComponent.inputEl.addClass("fancify-command-input");
	textComponent.onChange((value) => {
		draft.commandName = value;
		draft.dirty = true;
		draft.error = null;
	});
}

function renderVariantValueRow(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	property: string,
	draft: DraftVariant,
): void {
	const definition = getStyleProperty(property);
	const rowEl = container.createDiv("fancify-value-row");
	rowEl.createDiv({
		cls: "fancify-value-label",
		text: getStylePropertyLabel(property),
	});

	const inputContainerEl = rowEl.createDiv("fancify-value-input");

	if (definition.valueType === "select" && definition.options) {
		renderSelectValueField({
			container: inputContainerEl,
			draft,
			property,
			options: definition.options,
			defaultValue: getStylePropertyDefaultValue(property),
			getOptionLabel: (value) =>
				getStylePropertyOptionLabel(property, value),
		});
		return;
	}

	if (definition.valueType === "color") {
		renderColorValueField({
			tab,
			container: inputContainerEl,
			draft,
			property,
			placeholder: definition.placeholder || "Set color",
		});
		return;
	}

	if (definition.valueType === "number" && definition.range) {
		renderNumberValueField({
			container: inputContainerEl,
			draft,
			property,
			range: definition.range,
		});
	}
}
