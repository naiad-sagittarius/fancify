import { findStyleProperty } from "./styles/properties";
import type { Property, StyleNumberRange } from "./styles/types";

export type Validation<T> =
	| { valid: true; value: T }
	| { valid: false; message: string; property?: string };

type ValidationInputElement = HTMLElement;

type ValidationFieldErrors = Partial<Record<string, string>>;

const numberValuePattern = /^-?(?:\d+|\d*\.\d+)$/;

function isCssSupported(property: string, value: string): boolean {
	if (property.startsWith("--")) {
		return true;
	}

	return typeof CSS === "undefined" || CSS.supports(property, value);
}

function parseNumberValue(
	value: string,
	range: StyleNumberRange,
): Validation<number> {
	let numberText = value.trim();

	if (range.unit && numberText.endsWith(range.unit)) {
		numberText = numberText.slice(0, -range.unit.length).trim();
	}

	if (!numberValuePattern.test(numberText)) {
		return { valid: false, message: "must be a number" };
	}

	const numberValue = Number(numberText);
	if (!Number.isFinite(numberValue)) {
		return { valid: false, message: "must be a number" };
	}

	if (numberValue < range.min || numberValue > range.max) {
		return {
			valid: false,
			message: `must be between ${range.min} and ${range.max}`,
		};
	}

	if (range.step !== undefined && range.step > 0) {
		const stepOffset = (numberValue - range.min) / range.step;
		if (Math.abs(stepOffset - Math.round(stepOffset)) > 1e-8) {
			return {
				valid: false,
				message: `must use steps of ${range.step}`,
			};
		}
	}

	return { valid: true, value: numberValue };
}

function validateNumberStyleValue(
	property: string,
	value: string,
	definition: Property,
): Validation<string> {
	if (!definition.range) {
		return {
			valid: false,
			message: `number range missing for ${property}`,
		};
	}

	const parsed = parseNumberValue(value, definition.range);
	if (!parsed.valid) {
		return parsed;
	}

	const storageValue = `${parsed.value}${definition.range.unit ?? ""}`;
	const cssValue = getCssNumberStyleValue(parsed.value, definition.range);
	if (!isCssSupported(property, cssValue)) {
		return {
			valid: false,
			message: `invalid CSS value ("${cssValue}")`,
		};
	}

	return { valid: true, value: storageValue };
}

function getCssNumberStyleValue(
	value: number,
	range: StyleNumberRange,
): string {
	const cssValue = value * (range.cssMultiplier ?? 1);
	return `${cssValue}${range.cssUnit ?? range.unit ?? ""}`;
}

export function getCssStyleValue(property: string, value: string): string {
	const definition = findStyleProperty(property);
	if (definition?.valueType !== "number" || !definition.range) {
		return value;
	}

	const parsed = parseNumberValue(value, definition.range);
	return parsed.valid
		? getCssNumberStyleValue(parsed.value, definition.range)
		: value;
}

export function getNumberStyleValue(
	property: string,
	value: string,
): number | null {
	const definition = findStyleProperty(property);
	if (definition?.valueType !== "number" || !definition.range) {
		return null;
	}

	const parsed = parseNumberValue(value, definition.range);
	return parsed.valid ? parsed.value : null;
}

export function validateStyleValue(
	property: string,
	value: string,
): Validation<string> {
	const trimmed = value.trim();

	if (!trimmed) {
		return { valid: true, value: "" };
	}

	const definition = findStyleProperty(property);
	if (definition?.valueType === "number") {
		return validateNumberStyleValue(property, trimmed, definition);
	}

	if (!isCssSupported(property, trimmed)) {
		return {
			valid: false,
			message: `invalid CSS value ("${trimmed}")`,
		};
	}

	return { valid: true, value: trimmed };
}

export function createValidationErrorEl(container: HTMLElement): HTMLElement {
	const errorEl = container.createDiv({ cls: "fancify-setting-error" });
	errorEl.setCssProps({
		color: "var(--text-error)",
		marginTop: "6px",
	});
	return errorEl;
}

export function showValidationError(
	errorEl: HTMLElement,
	inputEl: ValidationInputElement,
	message: string,
): void {
	errorEl.setText(message);
	inputEl.setCssProps({
		borderColor: "var(--text-error)",
	});
}

function clearValidationError(
	errorEl: HTMLElement,
	inputEl: ValidationInputElement,
): void {
	errorEl.empty();
	inputEl.style.removeProperty("border-color");
}

export function updateFieldValidation(params: {
	fieldErrors: ValidationFieldErrors;
	errorEl: HTMLElement;
	inputEl: ValidationInputElement;
	property: string;
	value: string;
}): void {
	const validation = validateStyleValue(params.property, params.value);
	if (!validation.valid) {
		params.fieldErrors[params.property] = validation.message;
		showValidationError(params.errorEl, params.inputEl, validation.message);
		return;
	}

	delete params.fieldErrors[params.property];
	clearValidationError(params.errorEl, params.inputEl);
}
