import { TextComponent } from "obsidian";
import {
	createValidationErrorEl,
	showValidationError,
	updateFieldValidation,
} from "../../../validation";
import type { DraftVariant } from "../drafts";
import { getValueSuggestions } from "../tokens";
import type { SettingsTabRenderContext } from "../types";
import { PropertyValueSuggest } from "../value-suggest";
import {
	CustomColorPicker,
	getInitialColorFormat,
	type ColorOutputFormat,
} from "./custom-color-picker";

export function renderColorValueField(params: {
	tab: SettingsTabRenderContext;
	container: HTMLElement;
	draft: DraftVariant;
	property: string;
	placeholder: string;
}): void {
	const controlEl = params.container.createDiv("fancify-color-input");
	const pickerContainerEl = controlEl.createDiv("fancify-color-picker");
	const pickerButtonEl = pickerContainerEl.createEl("button", {
		attr: {
			"aria-label": "Choose color",
			type: "button",
		},
		cls: ["fancify-color-picker-trigger", "fancify-center-content"],
	});
	const pickerSwatchEl = pickerButtonEl.createSpan({
		cls: "fancify-color-picker-swatch",
		attr: { "aria-hidden": "true" },
	});

	const textContainerEl = controlEl.createDiv("fancify-color-text");
	const textComponent = new TextComponent(textContainerEl);
	textComponent.setPlaceholder(params.placeholder);

	const initialValue = params.draft.values[params.property] ?? "";
	textComponent.setValue(initialValue);

	const errorEl = createValidationErrorEl(params.container);
	const existingError = params.draft.fieldErrors[params.property];
	if (existingError) {
		showValidationError(errorEl, textComponent.inputEl, existingError);
	}

	let isSyncing = false;
	let outputFormat: ColorOutputFormat = getInitialColorFormat(initialValue);
	let colorPicker: CustomColorPicker;

	const syncPicker = (value: string): void => {
		colorPicker.updateFromText(value);
	};

	const applyValue = (
		value: string,
		source: "picker" | "text" | "suggest",
		format?: ColorOutputFormat,
	): void => {
		if (isSyncing) {
			return;
		}

		isSyncing = true;
		try {
			if (format) {
				outputFormat = format;
			}
			params.draft.values[params.property] = value;
			params.draft.dirty = true;
			params.draft.error = null;

			if (source === "picker" || source === "suggest") {
				textComponent.inputEl.value = value;
			}
			if (source !== "picker") {
				syncPicker(value);
			}

			updateFieldValidation({
				fieldErrors: params.draft.fieldErrors,
				errorEl,
				inputEl: textComponent.inputEl,
				property: params.property,
				value,
			});
		} finally {
			isSyncing = false;
		}
	};

	colorPicker = new CustomColorPicker({
		anchorEl: pickerButtonEl,
		anchorPreviewEl: pickerSwatchEl,
		initialFormat: outputFormat,
		initialValue,
		onChange: (value, format) => {
			applyValue(value, "picker", format);
		},
	});
	params.tab.activeSuggests.push(colorPicker);

	textComponent.onChange((value) => {
		applyValue(value, "text");
	});

	const suggest = new PropertyValueSuggest(
		params.tab.app,
		textComponent.inputEl,
		(query) =>
			getValueSuggestions(
				params.tab.plugin.settings.tokens,
				params.property,
				query,
			),
		(token) => {
			applyValue(token.value, "suggest");
		},
	);
	params.tab.activeSuggests.push(suggest);
}
