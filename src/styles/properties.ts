import {
	elementStyleTypes,
	type Property,
	type StyleType,
} from "./types";
import {
	lineColorProperty,
	lineLengthProperty,
	lineRadiusProperty,
	lineStyleOptions,
	lineStyleProperty,
	lineThicknessProperty,
} from "../line/constants";

const fontFamilyOptions = [
	"var(--font-text)",
	"var(--font-interface)",
	"var(--font-monospace)",
	"system-ui",
	"serif",
	"sans-serif",
	"monospace",
	'"Georgia", serif',
	'"Times New Roman", Times, serif',
	'"Arial", sans-serif',
	'"Verdana", sans-serif',
	'"Courier New", Courier, monospace',
] as const;

const fontWeightOptions = [
	"400",
	"100",
	"200",
	"300",
	"500",
	"600",
	"700",
	"800",
	"900",
] as const;

const fontWeightLabelByValue = new Map<string, string>([
	["100", "Thin (100)"],
	["200", "ExtraLight (200)"],
	["300", "Light (300)"],
	["400", "Regular (400)"],
	["500", "Medium (500)"],
	["600", "SemiBold (600)"],
	["700", "Bold (700)"],
	["800", "ExtraBold (800)"],
	["900", "Black (900)"],
]);

const fontFamilyOptionLabelByValue = new Map<string, string>([
	["var(--font-text)", "Text font"],
	["var(--font-interface)", "Interface font"],
	["var(--font-monospace)", "Monospace font"],
	["system-ui", "System UI"],
	['"Times New Roman", Times, serif', "Times New Roman"],
	['"Courier New", Courier, monospace', "Courier New"],
]);

const borderStyleOptions = [
	"none",
	"solid",
	"dashed",
	"dotted",
	"double",
] as const;

const paddingRange = {
	min: 0,
	max: 100,
	step: 1,
	unit: "px",
} as const;

const marginRange = {
	min: -100,
	max: 100,
	step: 1,
	unit: "px",
} as const;

const outlineWidthRange = {
	min: 0,
	max: 20,
	step: 1,
	unit: "px",
} as const;

const outlineOffsetRange = {
	min: -40,
	max: 40,
	step: 1,
	unit: "px",
} as const;

function getFontFamilyOptionLabel(value: string): string {
	return fontFamilyOptionLabelByValue.get(value) ?? value.replace(/^["']|["']$/g, "");
}

function getFontWeightOptionLabel(value: string): string {
	return fontWeightLabelByValue.get(value) ?? value;
}

const stylePropertyLibrary = [
	{
		property: "color",
		styleType: ["inline", "block"],
		valueType: "color",
		description: "Set the text colour.",
		placeholder: "#949494, rgb(148, 148, 148), ...",
	},
	{
		property: "background-color",
		styleType: ["inline", "block"],
		valueType: "color",
		description: "Set the background colour.",
		placeholder: "#f8ff98, rgb(248, 255, 152), ...",
	},
	{
		property: "font-family",
		styleType: ["inline", "block"],
		valueType: "select",
		description: "Choose the font type.",
		options: fontFamilyOptions,
		defaultValue: "var(--font-text)",
	},
	{
		property: "font-size",
		styleType: ["inline", "block"],
		valueType: "number",
		description: "Set the font size.",
		placeholder: "16",
		range: { min: 8, max: 70, step: 1, sliderStep: 2, unit: "px" },
	},
	{
		property: "font-weight",
		styleType: ["inline", "block"],
		valueType: "select",
		description: "Control the font weight.",
		options: fontWeightOptions,
		defaultValue: "400",
	},
	{
		property: "font-style",
		styleType: ["inline", "block"],
		valueType: "select",
		description: "Control the font style.",
		options: ["normal", "italic", "oblique"],
		defaultValue: "normal",
	},
	{
		property: "vertical-align",
		styleType: ["inline"],
		valueType: "select",
		description: "Choose the vertical alignment.",
		options: ["baseline", "sub", "super", "middle", "top", "bottom"],
		defaultValue: "baseline",
	},
	{
		property: "text-align",
		styleType: ["block"],
		valueType: "select",
		description: "Select the text alignment.",
		options: ["left", "center", "right"],
		defaultValue: "left",
	},
	{
		property: "text-decoration",
		styleType: ["inline", "block"],
		valueType: "select",
		description: "Underline, strike-through, overline",
		options: ["none", "underline", "line-through", "overline"],
		defaultValue: "none",
	},
	{
		property: lineColorProperty,
		label: "line color",
		styleType: elementStyleTypes,
		valueType: "color",
		description: "Set the line color.",
		placeholder: "#949494, rgb(148, 148, 148), ...",
	},
	{
		property: lineThicknessProperty,
		label: "line thickness",
		styleType: elementStyleTypes,
		valueType: "number",
		description: "Set the line thickness.",
		placeholder: "2",
		range: { min: 1, max: 20, step: 1, sliderStep: 2, unit: "px" },
	},
	{
		property: lineStyleProperty,
		label: "line style",
		styleType: elementStyleTypes,
		valueType: "select",
		description: "Choose the line pattern.",
		options: lineStyleOptions,
		defaultValue: "none",
	},
	{
		property: lineRadiusProperty,
		label: "line radius",
		styleType: elementStyleTypes,
		valueType: "number",
		description: "Round the line ends.",
		placeholder: "2",
		range: { min: 0, max: 100, step: 1, sliderStep: 2, unit: "px" },
	},
	{
		property: lineLengthProperty,
		label: "line length",
		styleType: ["horizontal-line"],
		valueType: "number",
		description: "Set the horizontal line length.",
		placeholder: "100",
		range: { min: 0, max: 100, step: 1, sliderStep: 10, unit: "%" },
	},
	{
		property: "padding-left",
		styleType: ["block"],
		valueType: "number",
		description: "Indent the whole block text.",
		placeholder: "16",
		range: paddingRange,
	},
	{
		property: "padding-top",
		styleType: ["block"],
		valueType: "number",
		description: "Add space above the whole block text.",
		placeholder: "16",
		range: paddingRange,
	},
	{
		property: "padding-right",
		styleType: ["block"],
		valueType: "number",
		description: "Indent text from the right.",
		placeholder: "16",
		range: paddingRange,
	},
	{
		property: "padding-bottom",
		styleType: ["block"],
		valueType: "number",
		description: "Add space below the whole block text.",
		placeholder: "16",
		range: paddingRange,
	},
	{
		property: "padding",
		styleType: ["block"],
		valueType: "number",
		description: "Add space around the whole block text.",
		placeholder: "16",
		range: paddingRange,
	},
	{
		property: "margin-left",
		styleType: ["block"],
		valueType: "number",
		description: "Move the whole block box from the left.",
		placeholder: "16",
		range: marginRange,
	},
	{
		property: "margin-top",
		styleType: ["block"],
		valueType: "number",
		description: "Add space above the whole block box.",
		placeholder: "16",
		range: marginRange,
	},
	{
		property: "margin-right",
		styleType: ["block"],
		valueType: "number",
		description: "Move the whole block box from the right.",
		placeholder: "16",
		range: marginRange,
	},
	{
		property: "margin-bottom",
		styleType: ["block"],
		valueType: "number",
		description: "Add space below the whole block box.",
		placeholder: "16",
		range: marginRange,
	},
	{
		property: "margin",
		styleType: ["block"],
		valueType: "number",
		description: "Add outer space around the whole block box.",
		placeholder: "16",
		range: marginRange,
	},
	{
		property: "border-color",
		styleType: ["block"],
		valueType: "color",
		description: "Set the border color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "border-right-color",
		styleType: ["block"],
		valueType: "color",
		description: "Set the right line color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "border-left-color",
		styleType: ["block"],
		valueType: "color",
		description: "Set the left line color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "border-top-color",
		styleType: ["block"],
		valueType: "color",
		description: "Set the top line color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "border-bottom-color",
		styleType: ["block"],
		valueType: "color",
		description: "Set the bottom line color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "border-style",
		styleType: ["block"],
		valueType: "select",
		description: "Choose the border style.",
		options: borderStyleOptions,
		defaultValue: "none",
	},
	{
		property: "border-right-style",
		styleType: ["block"],
		valueType: "select",
		description: "Choose the right line style.",
		options: borderStyleOptions,
		defaultValue: "none",
	},
	{
		property: "border-left-style",
		styleType: ["block"],
		valueType: "select",
		description: "Choose the left line style.",
		options: borderStyleOptions,
		defaultValue: "none",
	},
	{
		property: "border-top-style",
		styleType: ["block"],
		valueType: "select",
		description: "Choose the top line style.",
		options: borderStyleOptions,
		defaultValue: "none",
	},
	{
		property: "border-bottom-style",
		styleType: ["block"],
		valueType: "select",
		description: "Choose the bottom line style.",
		options: borderStyleOptions,
		defaultValue: "none",
	},
	{
		property: "border-width",
		styleType: ["block"],
		valueType: "number",
		description: "Set the border width.",
		placeholder: "1",
		range: { min: 0, max: 20, step: 1, unit: "px" },
	},
	{
		property: "border-right-width",
		styleType: ["block"],
		valueType: "number",
		description: "Set the right line width.",
		placeholder: "1",
		range: { min: 0, max: 20, step: 1, unit: "px" },
	},
	{
		property: "border-left-width",
		styleType: ["block"],
		valueType: "number",
		description: "Set the left line width.",
		placeholder: "1",
		range: { min: 0, max: 20, step: 1, unit: "px" },
	},
	{
		property: "border-top-width",
		styleType: ["block"],
		valueType: "number",
		description: "Set the top line width.",
		placeholder: "1",
		range: { min: 0, max: 20, step: 1, unit: "px" },
	},
	{
		property: "border-bottom-width",
		styleType: ["block"],
		valueType: "number",
		description: "Set the bottom line width.",
		placeholder: "1",
		range: { min: 0, max: 20, step: 1, unit: "px" },
	},
	{
		property: "border-radius",
		styleType: ["inline", "block"],
		valueType: "number",
		description: "Round the corners.",
		placeholder: "2",
		range: { min: 0, max: 100, step: 1, unit: "px" },
	},
	{
		property: "outline-color",
		styleType: ["inline", "block"],
		valueType: "color",
		description: "Set the outline color.",
		placeholder: "#000000, rgb(0, 0, 0), ...",
	},
	{
		property: "outline-style",
		styleType: ["inline", "block"],
		valueType: "select",
		description: "Choose the outline style.",
		options: ["none", "solid", "dashed", "dotted", "double", "auto"],
		defaultValue: "none",
	},
	{
		property: "outline-width",
		styleType: ["inline", "block"],
		valueType: "number",
		description: "Set the outline width.",
		placeholder: "2",
		range: outlineWidthRange,
	},
	{
		property: "outline-offset",
		styleType: ["inline", "block"],
		valueType: "number",
		description: "Set the distance between border and outline.",
		placeholder: "2",
		range: outlineOffsetRange,
	},
] as const satisfies readonly Property[];

const stylePropertyMap = new Map<string, Property>(
	stylePropertyLibrary.map((definition) => [definition.property, definition]),
);

export function getAllProperties(): readonly Property[] {
	return stylePropertyLibrary;
}

export function findStyleProperty(property: string): Property | undefined {
	return stylePropertyMap.get(property);
}

export function getStyleProperty(property: string): Property {
	const definition = findStyleProperty(property);
	if (!definition) {
		throw new Error(`Unknown style property: ${property}`);
	}

	return definition;
}

export function getStylePropertyLabel(property: string): string {
	const definition = findStyleProperty(property);
	return definition?.label ?? property;
}

export function getStylePropertyOptionLabel(
	property: string,
	value: string,
): string {
	if (property === "font-family") {
		return getFontFamilyOptionLabel(value);
	}

	if (property === "font-weight") {
		return getFontWeightOptionLabel(value);
	}

	return value;
}

export function getStylePropertyDefaultValue(
	property: string,
): string | undefined {
	return findStyleProperty(property)?.defaultValue;
}

export function isPropertyStyleType(
	property: string,
	styleType: StyleType,
): boolean {
	return findStyleProperty(property)?.styleType.includes(styleType) ?? false;
}
