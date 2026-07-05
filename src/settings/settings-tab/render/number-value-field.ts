import { SliderComponent, TextComponent } from "obsidian";
import type { StyleNumberRange } from "../../../styles/types";
import { setSafeIcon } from "../../../tools/icon-rendering";
import {
	createValidationErrorEl,
	getNumberStyleValue,
	showValidationError,
	updateFieldValidation,
} from "../../../validation";
import type { DraftVariant } from "../drafts";

export function renderNumberValueField(params: {
	container: HTMLElement;
	draft: DraftVariant;
	property: string;
	range: StyleNumberRange;
}): void {
	const currentValue = params.draft.values[params.property] ?? "";
	const currentNumber = getNumberStyleValue(
		params.property,
		currentValue,
	);
	const controlEl = params.container.createDiv("fancify-number-input");
	const sliderStep = params.range.sliderStep ?? 2;
	const inputStep = params.range.step ?? 1;
	const initialNumber = currentNumber ?? params.range.min;
	const sliderGroupEl = controlEl.createDiv("fancify-number-slider-group");
	const decrementButtonEl = createSliderButton(
		sliderGroupEl,
		"Decrease value",
		"minus",
	);
	const sliderContainerEl = sliderGroupEl.createDiv("fancify-number-slider");
	const sliderComponent = new SliderComponent(sliderContainerEl);
	renderSliderMarks(sliderContainerEl);
	sliderComponent
		.setLimits(
			params.range.min,
			params.range.max,
			sliderStep,
		)
		.setInstant(true)
		.setValue(initialNumber)
		.setDynamicTooltip();
	const incrementButtonEl = createSliderButton(
		sliderGroupEl,
		"Increase value",
		"plus",
	);

	const textContainerEl = controlEl.createDiv("fancify-number-text");
	const textComponent = new TextComponent(textContainerEl);
	textComponent.inputEl.type = "number";
	textComponent.inputEl.min = String(params.range.min);
	textComponent.inputEl.max = String(params.range.max);
	textComponent.inputEl.step = String(inputStep);
	textComponent.inputEl.inputMode = "decimal";
	textComponent.setValue(
		currentNumber === null && currentValue
			? currentValue
			: String(initialNumber),
	);

	if (params.range.unit) {
		controlEl.createSpan({
			cls: "fancify-number-unit",
			text: params.range.unit,
		});
	}

	const errorEl = createValidationErrorEl(params.container);
	const existingError = params.draft.fieldErrors[params.property];
	if (existingError) {
		showValidationError(errorEl, textComponent.inputEl, existingError);
	}

	let isSyncingControl = false;

	const clampNumber = (value: number): number =>
		Math.max(params.range.min, Math.min(params.range.max, value));

	const snapSliderValue = (value: number): number => {
		if (sliderStep <= 0) {
			return clampNumber(value);
		}

		const stepOffset = Math.round(
			(value - params.range.min) / sliderStep,
		);
		const snappedValue = params.range.min + stepOffset * sliderStep;
		const clampedValue = clampNumber(snappedValue);

		if (params.range.max - value < sliderStep / 2) {
			return params.range.max;
		}

		return clampedValue;
	};

	const getActiveNumber = (): number => {
		const textNumber = getNumberStyleValue(
			params.property,
			textComponent.inputEl.value,
		);
		if (textNumber !== null) {
			return textNumber;
		}

		return sliderComponent.getValue();
	};

	const syncButtonState = (): void => {
		const activeNumber = getActiveNumber();
		decrementButtonEl.disabled = activeNumber <= params.range.min;
		incrementButtonEl.disabled = activeNumber >= params.range.max;
	};

	const applyValue = (
		value: string,
		options: { syncSlider: boolean },
	): void => {
		params.draft.values[params.property] = value;
		params.draft.dirty = true;
		params.draft.error = null;
		updateFieldValidation({
			fieldErrors: params.draft.fieldErrors,
			errorEl,
			inputEl: textComponent.inputEl,
			property: params.property,
			value,
		});

		if (!options.syncSlider) {
			syncButtonState();
			return;
		}

		const nextNumber = getNumberStyleValue(params.property, value);
		if (nextNumber === null) {
			syncButtonState();
			return;
		}

		isSyncingControl = true;
		sliderComponent.setValue(nextNumber);
		isSyncingControl = false;
		syncButtonState();
	};

	sliderComponent.onChange((value) => {
		if (isSyncingControl) {
			return;
		}

		const nextNumber = snapSliderValue(value);
		const nextValue = String(nextNumber);
		isSyncingControl = true;
		sliderComponent.setValue(nextNumber);
		isSyncingControl = false;
		textComponent.inputEl.value = nextValue;
		applyValue(nextValue, { syncSlider: false });
	});

	textComponent.onChange((value) => {
		applyValue(value, { syncSlider: true });
	});

	decrementButtonEl.addEventListener("click", () => {
		const nextNumber = clampNumber(getActiveNumber() - sliderStep);
		const nextValue = String(nextNumber);
		textComponent.inputEl.value = nextValue;
		applyValue(nextValue, { syncSlider: true });
	});

	incrementButtonEl.addEventListener("click", () => {
		const nextNumber = clampNumber(getActiveNumber() + sliderStep);
		const nextValue = String(nextNumber);
		textComponent.inputEl.value = nextValue;
		applyValue(nextValue, { syncSlider: true });
	});

	syncButtonState();
}

function createSliderButton(
	container: HTMLElement,
	label: string,
	icon: string,
): HTMLButtonElement {
	const buttonEl = container.createEl("button", {
		cls: ["fancify-number-slider-button", "fancify-center-content"],
		attr: {
			"aria-label": label,
			type: "button",
		},
	});
	const iconEl = buttonEl.createSpan({
		cls: "fancify-number-slider-button-icon",
		attr: { "aria-hidden": "true" },
	});
	setSafeIcon(iconEl, icon);
	return buttonEl;
}

function renderSliderMarks(container: HTMLElement): void {
	const marksEl = container.createDiv("fancify-number-slider-marks");
	marksEl.createSpan({
		cls: [
			"fancify-number-slider-mark",
			"fancify-number-slider-mark-quarter",
			"is-left",
		],
	});
	marksEl.createSpan({
		cls: [
			"fancify-number-slider-mark",
			"fancify-number-slider-mark-center",
		],
	});
	marksEl.createSpan({
		cls: [
			"fancify-number-slider-mark",
			"fancify-number-slider-mark-quarter",
			"is-right",
		],
	});
}
