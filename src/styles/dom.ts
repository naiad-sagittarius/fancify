import type { Variant } from "../tools/types";
import { getCssStyleValue, getNumberStyleValue } from "../validation";
import {
	lineColorProperty,
	lineStyleOptions,
	lineStyleProperty,
	lineThicknessProperty,
} from "../line/constants";
import { isLineStyleType, type StyleToken, type StyleType } from "./types";
import { buildStyleTokenClass, buildStyleTokenVariableName } from "./tokens";
import { isStyleTokenVariableName } from "./helpers";

const tokenStyleElementId = "fancify-token-rules";

function getDocument(target: HTMLElement): Document {
	return target.ownerDocument ?? activeDocument;
}

export function applyStyleTokens(
	target: HTMLElement,
	tokens: StyleToken[],
): void {
	const doc = getDocument(target);

	clearStyleTokens(target);

	if (tokens.length === 0) {
		return;
	}

	for (const token of tokens) {
		target.style.setProperty(
			buildStyleTokenVariableName(token.id),
			getCssStyleValue(token.property, token.value),
		);
	}

	const existing = doc.getElementById(tokenStyleElementId);
	const styleEl =
		existing instanceof HTMLStyleElement
			? existing
			: doc.createElement("style");

	if (!(existing instanceof HTMLStyleElement)) {
		styleEl.id = tokenStyleElementId;
		doc.head.appendChild(styleEl);
	}

	styleEl.textContent = buildStyleTokenCssText(tokens);
}

export function clearStyleTokens(target: HTMLElement): void {
	const doc = getDocument(target);

	for (let index = target.style.length - 1; index >= 0; index--) {
		const propertyName = target.style.item(index);
		if (isStyleTokenVariableName(propertyName)) {
			target.style.removeProperty(propertyName);
		}
	}

	doc.getElementById(tokenStyleElementId)?.remove();
}

function buildStyleTokenCssText(tokens: readonly StyleToken[]): string {
	return tokens.flatMap(buildStyleTokenCssRules).join("\n");
}

function buildStyleTokenCssRules(token: StyleToken): string[] {
	const className = buildStyleTokenClass(token.id);
	const variableName = buildStyleTokenVariableName(token.id);
	const value = `var(${variableName})`;
	const baseDeclarations = [
		`${token.property}: ${value};`,
		...buildLineMarginOffsetCssDeclarations(token.property, token.value),
	];

	return [
		`.${className} { ${baseDeclarations.join(" ")} }`,
		...buildLineStyleCssRules(className, token.property, token.value),
		...buildEditorBlockCssRules(className, token.property, value),
	];
}

function buildLineMarginOffsetCssDeclarations(
	property: string,
	rawValue: string,
): string[] {
	if (property !== "margin" && property !== "margin-left") {
		return [];
	}

	const marginLeft = getNumberStyleValue(property, rawValue);
	if (marginLeft === null) {
		return [];
	}

	return [`--fancify-line-margin-left-offset: ${-marginLeft}px;`];
}

function buildLineStyleCssRules(
	className: string,
	property: string,
	value: string,
): string[] {
	if (property !== lineStyleProperty) {
		return [];
	}

	const normalisedValue = value.trim().toLowerCase();
	if (!lineStyleOptions.some((option) => option === normalisedValue)) {
		return [];
	}

	const color = `var(${lineColorProperty}, currentColor)`;
	const thickness = `var(${lineThicknessProperty}, 2px)`;
	const solidRule =
		`--fancify-line-horizontal-image: linear-gradient(to right, ${color}, ${color}); ` +
		`--fancify-line-vertical-image: linear-gradient(to bottom, ${color}, ${color}); ` +
		"--fancify-line-horizontal-background-size: 100% 100%; " +
		"--fancify-line-vertical-background-size: 100% 100%;";

	if (normalisedValue === "none") {
		return [
			`.${className} { ` +
				"--fancify-line-horizontal-image: none; " +
				"--fancify-line-vertical-image: none;" +
				"}",
		];
	}

	if (normalisedValue === "solid") {
		return [`.${className} { ${solidRule} }`];
	}

	if (normalisedValue === "dashed") {
		return [
			`.${className} { ` +
				`--fancify-line-horizontal-image: repeating-linear-gradient(to right, ${color} 0 calc(${thickness} * 4), transparent calc(${thickness} * 4) calc(${thickness} * 6)); ` +
				`--fancify-line-vertical-image: repeating-linear-gradient(to bottom, ${color} 0 calc(${thickness} * 4), transparent calc(${thickness} * 4) calc(${thickness} * 6)); ` +
				"--fancify-line-horizontal-background-size: 100% 100%; " +
				"--fancify-line-vertical-background-size: 100% 100%;" +
				"}",
		];
	}

	return [
		`.${className} { ` +
			`--fancify-line-horizontal-image: radial-gradient(circle closest-side, ${color} 98%, transparent 100%); ` +
			`--fancify-line-vertical-image: radial-gradient(circle closest-side, ${color} 98%, transparent 100%); ` +
			`--fancify-line-horizontal-background-size: calc(${thickness} * 3) ${thickness}; ` +
			`--fancify-line-vertical-background-size: ${thickness} calc(${thickness} * 3);` +
			"}",
	];
}

function buildEditorBlockCssRules(
	className: string,
	property: string,
	value: string,
): string[] {
	const selector = `.markdown-source-view.mod-cm6 .cm-line.fancify-block.${className}`;
	const startSelector = `${selector}.fancify-block-start`;
	const endSelector = `${selector}.fancify-block-end`;

	switch (property) {
		case "padding":
			return [
				`${selector} { padding-top: 0 !important; padding-right: ${value} !important; padding-bottom: 0 !important; padding-left: ${value} !important; }`,
				`${startSelector} { padding-top: ${value} !important; }`,
				`${endSelector} { padding-bottom: ${value} !important; }`,
			];
		case "padding-top":
			return [
				`${selector} { padding-top: 0 !important; }`,
				`${startSelector} { padding-top: ${value} !important; }`,
			];
		case "padding-bottom":
			return [
				`${selector} { padding-bottom: 0 !important; }`,
				`${endSelector} { padding-bottom: ${value} !important; }`,
			];
		case "padding-left":
		case "padding-right":
			return [`${selector} { ${property}: ${value} !important; }`];
		case "margin":
			return [
				`${selector} { margin-top: 0 !important; margin-right: ${value} !important; margin-bottom: 0 !important; margin-left: ${value} !important; }`,
				`${startSelector} { margin-top: ${value} !important; }`,
				`${endSelector} { margin-bottom: ${value} !important; }`,
			];
		case "margin-top":
			return [
				`${selector} { margin-top: 0 !important; }`,
				`${startSelector} { margin-top: ${value} !important; }`,
			];
		case "margin-bottom":
			return [
				`${selector} { margin-bottom: 0 !important; }`,
				`${endSelector} { margin-bottom: ${value} !important; }`,
			];
		case "margin-left":
		case "margin-right":
			return [`${selector} { ${property}: ${value} !important; }`];
		case "border-radius":
			return [
				`${selector} { border-radius: 0 !important; }`,
				`${startSelector} { border-top-left-radius: ${value} !important; border-top-right-radius: ${value} !important; }`,
				`${endSelector} { border-bottom-right-radius: ${value} !important; border-bottom-left-radius: ${value} !important; }`,
			];
		case "border-color":
			return buildEditorBoxCssRules({
				selector,
				startSelector,
				endSelector,
				sidePrefix: "border",
				sideSuffix: "color",
				value,
				resetValue: "transparent",
			});
		case "border-style":
			return buildEditorBoxCssRules({
				selector,
				startSelector,
				endSelector,
				sidePrefix: "border",
				sideSuffix: "style",
				value,
				resetValue: "none",
			});
		case "border-width":
			return buildEditorBoxCssRules({
				selector,
				startSelector,
				endSelector,
				sidePrefix: "border",
				sideSuffix: "width",
				value,
				resetValue: "0",
			});
		case "border-top-color":
		case "border-top-style":
		case "border-top-width":
			return buildEditorEdgeCssRules({
				selector,
				edgeSelector: startSelector,
				property,
				value,
			});
		case "border-bottom-color":
		case "border-bottom-style":
		case "border-bottom-width":
			return buildEditorEdgeCssRules({
				selector,
				edgeSelector: endSelector,
				property,
				value,
			});
		case "border-left-color":
		case "border-left-style":
		case "border-left-width":
		case "border-right-color":
		case "border-right-style":
		case "border-right-width":
			return [`${selector} { ${property}: ${value} !important; }`];
		default:
			return [];
	}
}

function buildEditorBoxCssRules(params: {
	readonly selector: string;
	readonly startSelector: string;
	readonly endSelector: string;
	readonly sidePrefix: string;
	readonly sideSuffix: string;
	readonly value: string;
	readonly resetValue: string;
}): string[] {
	const topProperty = `${params.sidePrefix}-top-${params.sideSuffix}`;
	const rightProperty = `${params.sidePrefix}-right-${params.sideSuffix}`;
	const bottomProperty = `${params.sidePrefix}-bottom-${params.sideSuffix}`;
	const leftProperty = `${params.sidePrefix}-left-${params.sideSuffix}`;

	return [
		`${params.selector} { ${topProperty}: ${params.resetValue} !important; ${rightProperty}: ${params.value} !important; ${bottomProperty}: ${params.resetValue} !important; ${leftProperty}: ${params.value} !important; }`,
		`${params.startSelector} { ${topProperty}: ${params.value} !important; }`,
		`${params.endSelector} { ${bottomProperty}: ${params.value} !important; }`,
	];
}

function buildEditorEdgeCssRules(params: {
	readonly selector: string;
	readonly edgeSelector: string;
	readonly property: string;
	readonly value: string;
}): string[] {
	return [
		`${params.selector} { ${params.property}: ${getEdgeResetValue(params.property)} !important; }`,
		`${params.edgeSelector} { ${params.property}: ${params.value} !important; }`,
	];
}

function getEdgeResetValue(property: string): string {
	if (property.endsWith("-style")) {
		return "none";
	}

	if (property.endsWith("-width")) {
		return "0";
	}

	return "transparent";
}

export function getVariantDecorationClassName(
	variant: Variant,
	styleType: StyleType = "inline",
): string {
	const classNames = [getBaseDecorationClassName(styleType)];

	for (const tokenId of Object.values(variant.variantTokens)) {
		if (!tokenId) continue;
		classNames.push(buildStyleTokenClass(tokenId));
	}

	return classNames.join(" ");
}

function getBaseDecorationClassName(styleType: StyleType): string {
	if (styleType === "block") {
		return "fancify-block";
	}

	if (styleType === "horizontal-line") {
		return "fancify-line fancify-line-horizontal";
	}

	if (isLineStyleType(styleType)) {
		return "fancify-line fancify-line-vertical";
	}

	return "fancify-mark";
}
