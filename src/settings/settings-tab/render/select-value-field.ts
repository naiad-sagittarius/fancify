import { activeDocument } from "obsidian";
import {
	createValidationErrorEl,
	showValidationError,
	updateFieldValidation,
} from "../../../validation";
import type { DraftVariant } from "../drafts";

const menuMaxHeight = 280;
const menuViewportPadding = 12;
const menuGap = 8;
const minimumFlipHeight = 160;

interface SelectOption {
	value: string;
	label: string;
}

function getOptionValues(
	options: readonly string[],
	currentValue: string,
	defaultValue: string,
	getOptionLabel: (value: string) => string,
): SelectOption[] {
	const optionValues: SelectOption[] = [];
	const usedValues = new Set<string>();
	const usedLabels = new Set<string>();

	const addOption = (value: string): void => {
		if (!value) {
			return;
		}

		const label = getOptionLabel(value);
		const normalisedLabel = label.trim().toLowerCase();
		if (usedValues.has(value) || usedLabels.has(normalisedLabel)) {
			return;
		}

		usedValues.add(value);
		usedLabels.add(normalisedLabel);
		optionValues.push({ value, label });
	};

	addOption(defaultValue);

	if (currentValue) {
		addOption(currentValue);
	}

	for (const option of options) {
		addOption(option);
	}

	return optionValues;
}

function getHighlightedIndex(
	options: SelectOption[],
	selectedValue: string,
): number {
	const optionIndex = options.findIndex(
		(option) => option.value === selectedValue,
	);
	return optionIndex >= 0 ? optionIndex : 0;
}

function getSettingsBounds(controlEl: HTMLElement): {
	top: number;
	bottom: number;
} {
	const settingsEl = controlEl.closest(".fancify-settings");
	const settingsRect = settingsEl?.getBoundingClientRect();

	return {
		top: Math.max(settingsRect?.top ?? 0, menuViewportPadding),
		bottom: Math.min(
			settingsRect?.bottom ?? window.innerHeight,
			window.innerHeight - menuViewportPadding,
		),
	};
}

export function renderSelectValueField(params: {
	container: HTMLElement;
	draft: DraftVariant;
	property: string;
	options: readonly string[];
	defaultValue?: string;
	getOptionLabel?: (value: string) => string;
}): void {
	const getLabel = (value: string): string =>
		params.getOptionLabel?.(value) ?? value;
	const defaultValue = params.defaultValue ?? params.options[0] ?? "";
	const getEffectiveValue = (): string =>
		params.draft.values[params.property] || defaultValue;
	const controlEl = params.container.createDiv("fancify-select");
	const triggerEl = controlEl.createEl("button", {
		cls: "fancify-select-trigger",
	});
	triggerEl.type = "button";
	triggerEl.setAttribute("aria-haspopup", "listbox");

	const triggerValueEl = triggerEl.createSpan("fancify-select-trigger-value");
	const menuEl = controlEl.createDiv({
		cls: ["fancify-property-menu", "is-hidden"],
	});
	menuEl.setAttribute("role", "listbox");

	const errorEl = createValidationErrorEl(params.container);
	const existingError = params.draft.fieldErrors[params.property];
	if (existingError) {
		showValidationError(errorEl, triggerEl, existingError);
	}

	let isMenuOpen = false;
	let highlightedIndex = 0;

	const syncTriggerValue = (): void => {
		const value = getEffectiveValue();
		const label = getLabel(value);
		triggerValueEl.setText(label);
		triggerEl.classList.toggle("is-placeholder", !value);
		triggerEl.setAttribute("title", label);
	};

	const syncHighlightedItem = (): void => {
		for (const [index, child] of Array.from(menuEl.children).entries()) {
			child.classList.toggle("is-active", index === highlightedIndex);
		}
	};

	const setMenuOpen = (isOpen: boolean): void => {
		isMenuOpen = isOpen;
		triggerEl.classList.toggle("is-open", isOpen);
		triggerEl.setAttribute("aria-expanded", String(isOpen));
		menuEl.toggleClass("is-hidden", !isOpen);
	};

	const fitMenuToSettings = (): void => {
		const bounds = getSettingsBounds(controlEl);
		const controlRect = controlEl.getBoundingClientRect();
		const availableBelow = Math.max(
			0,
			bounds.bottom - controlRect.bottom - menuGap,
		);
		const availableAbove = Math.max(
			0,
			controlRect.top - bounds.top - menuGap,
		);
		const shouldOpenAbove =
			availableBelow < minimumFlipHeight &&
			availableAbove > availableBelow;
		const availableHeight = shouldOpenAbove
			? availableAbove
			: availableBelow;

		menuEl.toggleClass("is-above", shouldOpenAbove);
		menuEl.style.maxHeight = `${Math.min(menuMaxHeight, availableHeight)}px`;
	};

	const openMenu = (): void => {
		renderMenu();
		fitMenuToSettings();
		setMenuOpen(true);
	};

	const chooseOption = (value: string): void => {
		params.draft.values[params.property] = value;
		params.draft.dirty = true;
		params.draft.error = null;
		syncTriggerValue();
		updateFieldValidation({
			fieldErrors: params.draft.fieldErrors,
			errorEl,
			inputEl: triggerEl,
			property: params.property,
			value,
		});
		setMenuOpen(false);
		triggerEl.focus();
	};

	const renderMenu = (): void => {
		const currentValue = getEffectiveValue();
		const optionValues = getOptionValues(
			params.options,
			currentValue,
			defaultValue,
			getLabel,
		);
		highlightedIndex = getHighlightedIndex(optionValues, currentValue);
		menuEl.empty();

		for (const [index, option] of optionValues.entries()) {
			const itemEl = menuEl.createDiv({
				cls: [
					"fancify-property-menu-item",
					"fancify-value-menu-item",
					index === highlightedIndex ? "is-active" : "",
					option.value === currentValue ? "is-selected" : "",
				],
			});
			itemEl.setAttribute("role", "option");
			itemEl.setAttribute(
				"aria-selected",
				String(option.value === currentValue),
			);
			itemEl.createDiv({
				cls: "fancify-suggest-value",
				text: option.label,
			});

			itemEl.addEventListener("mouseenter", () => {
				if (highlightedIndex === index) {
					return;
				}

				highlightedIndex = index;
				syncHighlightedItem();
			});

			itemEl.addEventListener("pointerdown", (event) => {
				event.preventDefault();
				chooseOption(option.value);
			});
		}
	};

	triggerEl.addEventListener("click", () => {
		if (isMenuOpen) {
			setMenuOpen(false);
			return;
		}

		openMenu();
	});

	triggerEl.addEventListener("keydown", (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (!isMenuOpen) {
				openMenu();
				return;
			}

			const optionValues = getOptionValues(
				params.options,
				getEffectiveValue(),
				defaultValue,
				getLabel,
			);
			highlightedIndex = Math.min(
				highlightedIndex + 1,
				optionValues.length - 1,
			);
			syncHighlightedItem();
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (!isMenuOpen) {
				openMenu();
				return;
			}

			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			syncHighlightedItem();
			return;
		}

		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (!isMenuOpen) {
				openMenu();
				return;
			}

			const optionValues = getOptionValues(
				params.options,
				getEffectiveValue(),
				defaultValue,
				getLabel,
			);
			const selectedOption = optionValues[highlightedIndex];
			if (selectedOption) {
				chooseOption(selectedOption.value);
			}
			return;
		}

		if (event.key !== "Escape") {
			return;
		}

		event.preventDefault();
		setMenuOpen(false);
	});

	controlEl.addEventListener("focusout", () => {
		window.setTimeout(() => {
			if (controlEl.contains(activeDocument.activeElement)) {
				return;
			}

			setMenuOpen(false);
		}, 0);
	});

	syncTriggerValue();
	setMenuOpen(false);
}
