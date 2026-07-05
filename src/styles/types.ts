export type LineStyleType = "horizontal-line" | "vertical-line";
export type StyleType = "inline" | "block" | LineStyleType;
export type BlockRangeStyleType = "block" | "vertical-line";

export const elementStyleTypes = [
	"horizontal-line",
	"vertical-line",
] as const satisfies readonly LineStyleType[];

const styleTypeLabels = new Map<StyleType, string>([
	["inline", "inline"],
	["block", "block"],
	["horizontal-line", "horizontal line"],
	["vertical-line", "vertical line"],
]);

export function isLineStyleType(
	styleType: StyleType,
): styleType is LineStyleType {
	return styleType === "horizontal-line" || styleType === "vertical-line";
}

export function isHorizontalLineStyleType(
	styleType: StyleType,
): styleType is "horizontal-line" {
	return styleType === "horizontal-line";
}

export function isBlockRangeStyleType(
	styleType: StyleType,
): styleType is BlockRangeStyleType {
	return styleType === "block" || styleType === "vertical-line";
}

export function getStyleTypeLabel(styleType: StyleType): string {
	return styleTypeLabels.get(styleType) ?? styleType;
}

export function getToolTypeLabel(styleType: StyleType): string {
	return isLineStyleType(styleType) ? "element" : getStyleTypeLabel(styleType);
}

// css property that can be chosen in the UI
export interface Property {
	property: string;
	label?: string;
	styleType: readonly StyleType[];
	valueType: StyleValueType;
	description: string;
	options?: readonly string[];
	placeholder?: string;
	range?: StyleNumberRange;
	defaultValue?: string;
}

export interface StyleNumberRange {
	min: number;
	max: number;
	step?: number;
	sliderStep?: number;
	unit?: string;
	cssUnit?: string;
	cssMultiplier?: number;
}

// allowed values for a style property: color (hex, rgb, ...), number (bounded range), select (predefined options)
export type StyleValueType = "color" | "number" | "select";

// style properties a tool supports
export interface StyleField {
	property: string;
}

export type StyleTokenId = string;

// each Token represents a property with a specific value
export interface StyleToken {
	id: StyleTokenId;
	property: string;
	value: string;
}

// token ids for a property
export type PropertyTokenMap = Partial<Record<string, StyleTokenId>>;
