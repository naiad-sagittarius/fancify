import { Text as CodeMirrorText } from "@codemirror/state";
import type { Tree } from "@lezer/common";
import {
	MarkdownView,
	type MarkdownPostProcessor,
	type Plugin,
} from "obsidian";
import { createLineElement } from "../line/render";
import {
	isBlockRangeStyleType,
	isHorizontalLineStyleType,
} from "../styles/types";
import { FancifyScanEngine } from "../editor/decorations/scan-engine";
import { getHiddenTagRanges } from "../editor/decorations/pair-builder";
import {
	compareRanges,
	rangesOverlap,
	subtractRanges,
} from "../editor/decorations/scan-range-utils";
import type { ScanRange, StyledRange } from "../editor/decorations/types";

interface TextNodeRange extends ScanRange {
	readonly node: Text;
	readonly ignored: boolean;
}

const ignoredTextSelector = [
	"code",
	"pre",
	"script",
	"style",
	"table",
	"textarea",
	"mjx-container",
	".math",
	".math-block",
	".math-inline",
	".mermaid",
].join(",");

const blockElementSelector = [
	"p",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"figcaption",
	"summary",
	".callout",
	".markdown-embed",
	".internal-embed",
].join(",");

const blockListClass = "fancify-block-list";
const previewScanEngine = new FancifyScanEngine();
const emptySyntaxTree = {
	iterate() {
		return undefined;
	},
} as unknown as Tree;

export function registerFancifyMarkdownPostProcessor(plugin: Plugin): void {
	plugin.registerMarkdownPostProcessor(processFancifyMarkdownPreview);
}

export function rerenderMarkdownPreviews(plugin: Plugin): void {
	for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;

		if (!(view instanceof MarkdownView) || view.getMode() !== "preview") {
			continue;
		}

		view.previewMode.rerender(true);
	}
}

const processFancifyMarkdownPreview: MarkdownPostProcessor = (el) => {
	if (!el.textContent?.includes("{{")) {
		return;
	}

	const textNodes = collectTextNodeRanges(el);
	if (textNodes.length === 0) {
		return;
	}

	const source = textNodes.map((range) => range.node.data).join("");
	if (!source.includes("{{")) {
		return;
	}

	const doc = CodeMirrorText.of([source]);
	const ignoredRanges = textNodes
		.filter((range) => range.ignored)
		.map(toScanRange);
	const result = previewScanEngine.build(
		emptySyntaxTree,
		doc,
		[{ from: 0, to: doc.length }],
		ignoredRanges,
	);
	if (result.tagPairs.length === 0 && result.nodes.length === 0) {
		return;
	}

	const hiddenTagRanges = [...getHiddenTagRanges(result.tagPairs)].sort(
		compareRanges,
	);
	const styledRanges = [...result.nodes].sort(compareRanges);

	applyBlockStyles(el, textNodes, styledRanges);
	replaceInlineTextNodes(textNodes, styledRanges, hiddenTagRanges);
	removeEmptyHiddenTagParagraphs(el);
};

export function getPreviewScanRanges(
	docLength: number,
	ignoredRanges: readonly ScanRange[],
): ScanRange[] {
	return subtractRanges([{ from: 0, to: docLength }], ignoredRanges);
}

function collectTextNodeRanges(root: HTMLElement): TextNodeRange[] {
	const textNodes: TextNodeRange[] = [];
	const walker = root.ownerDocument.createTreeWalker(
		root,
		NodeFilter.SHOW_TEXT,
	);
	let offset = 0;
	let currentNode = walker.nextNode();

	while (currentNode) {
		const node = currentNode as Text;
		const length = node.data.length;

		if (length > 0) {
			textNodes.push({
				node,
				from: offset,
				to: offset + length,
				ignored: isIgnoredTextNode(node, root),
			});
			offset += length;
		}

		currentNode = walker.nextNode();
	}

	return textNodes;
}

function isIgnoredTextNode(node: Text, root: HTMLElement): boolean {
	const parentEl = node.parentElement;
	if (!parentEl) {
		return true;
	}

	const ignoredEl = parentEl.closest(ignoredTextSelector);
	return (
		ignoredEl !== null && (ignoredEl === root || root.contains(ignoredEl))
	);
}

function applyBlockStyles(
	root: HTMLElement,
	textNodes: readonly TextNodeRange[],
	styledRanges: readonly StyledRange[],
): void {
	const blockRanges = styledRanges
		.filter((range) => isBlockRangeStyleType(range.styleType))
		.sort(compareRanges);
	if (blockRanges.length === 0) {
		return;
	}

	const classNamesByElement = new Map<HTMLElement, Set<string>>();
	let rangeStartIndex = 0;

	for (const textNode of textNodes) {
		if (textNode.ignored) {
			continue;
		}

		rangeStartIndex = getActiveRangeStartIndex(
			blockRanges,
			textNode.from,
			rangeStartIndex,
		);
		const matchingRanges = getOverlappingSortedRanges(
			textNode,
			blockRanges,
			rangeStartIndex,
		);
		if (matchingRanges.length === 0) {
			continue;
		}

		for (const range of matchingRanges) {
			const blockEl = getBlockStyleElement(
				textNode.node,
				root,
				range,
				textNodes,
			);
			if (!blockEl) {
				continue;
			}

			const classNames = getOrCreateClassSet(
				classNamesByElement,
				blockEl,
			);
			addCssClassNames(classNames, range.cssClass);
			if (isListElement(blockEl)) {
				classNames.add(blockListClass);
			}
		}
	}

	for (const [element, classNames] of classNamesByElement) {
		element.classList.add(...classNames);
	}
}

function getBlockStyleElement(
	node: Text,
	root: HTMLElement,
	range: ScanRange,
	textNodes: readonly TextNodeRange[],
): HTMLElement | null {
	const parentEl = node.parentElement;
	if (!parentEl) {
		return null;
	}

	const cellEl = parentEl.closest("td, th");
	if (cellEl instanceof HTMLElement && root.contains(cellEl)) {
		return cellEl;
	}

	const listEl = getCoveredListElement(parentEl, root, range, textNodes);
	if (listEl) {
		return listEl;
	}

	let element: HTMLElement | null = parentEl;

	while (element && element !== root) {
		if (element.matches(blockElementSelector)) {
			return element;
		}

		element = element.parentElement;
	}

	return null;
}

function getCoveredListElement(
	element: HTMLElement,
	root: HTMLElement,
	range: ScanRange,
	textNodes: readonly TextNodeRange[],
): HTMLElement | null {
	const itemEl = element.closest("li");
	if (!(itemEl instanceof HTMLElement) || !root.contains(itemEl)) {
		return null;
	}

	let coveredListEl: HTMLElement | null = null;
	let currentEl: HTMLElement | null = itemEl.parentElement;

	while (currentEl && root.contains(currentEl)) {
		if (
			isListElement(currentEl) &&
			rangeOverlapsAllElementText(currentEl, range, textNodes)
		) {
			coveredListEl = currentEl;
		}

		if (currentEl === root) {
			break;
		}

		currentEl = currentEl.parentElement;
	}

	return coveredListEl;
}

function isListElement(element: HTMLElement): boolean {
	return element.matches("ul, ol");
}

function rangeOverlapsAllElementText(
	element: HTMLElement,
	range: ScanRange,
	textNodes: readonly TextNodeRange[],
): boolean {
	let hasText = false;

	for (const textNode of textNodes) {
		if (
			textNode.ignored ||
			textNode.node.data.trim().length === 0 ||
			!element.contains(textNode.node)
		) {
			continue;
		}

		hasText = true;
		if (!rangesOverlap(textNode, range)) {
			return false;
		}
	}

	return hasText;
}

function replaceInlineTextNodes(
	textNodes: readonly TextNodeRange[],
	styledRanges: readonly StyledRange[],
	hiddenTagRanges: readonly ScanRange[],
): void {
	const inlineRanges = styledRanges
		.filter((range) => range.styleType === "inline")
		.sort(compareRanges);
	const lineRanges = styledRanges
		.filter((range) => isHorizontalLineStyleType(range.styleType))
		.sort(compareRanges);
	let inlineRangeStartIndex = 0;
	let lineRangeStartIndex = 0;
	let hiddenRangeStartIndex = 0;

	for (const textNode of textNodes) {
		if (textNode.ignored) {
			continue;
		}

		inlineRangeStartIndex = getActiveRangeStartIndex(
			inlineRanges,
			textNode.from,
			inlineRangeStartIndex,
		);
		hiddenRangeStartIndex = getActiveRangeStartIndex(
			hiddenTagRanges,
			textNode.from,
			hiddenRangeStartIndex,
		);
		lineRangeStartIndex = getActiveRangeStartIndex(
			lineRanges,
			textNode.from,
			lineRangeStartIndex,
		);
		const overlappingInlineRanges = getOverlappingSortedRanges(
			textNode,
			inlineRanges,
			inlineRangeStartIndex,
		);
		const overlappingLineRanges = getOverlappingSortedRanges(
			textNode,
			lineRanges,
			lineRangeStartIndex,
		);
		const overlappingHiddenRanges = getOverlappingSortedRanges(
			textNode,
			hiddenTagRanges,
			hiddenRangeStartIndex,
		);
		const relevantRanges = [
			...overlappingHiddenRanges,
			...overlappingInlineRanges,
			...overlappingLineRanges,
		].sort(compareRanges);
		if (relevantRanges.length === 0) {
			continue;
		}

		replaceTextNode(
			textNode,
			relevantRanges,
			overlappingInlineRanges,
			overlappingHiddenRanges,
			overlappingLineRanges,
		);
	}
}

function removeEmptyHiddenTagParagraphs(root: HTMLElement): void {
	for (const paragraph of Array.from(root.querySelectorAll("p"))) {
		if (
			paragraph.textContent?.trim().length === 0 &&
			paragraph.children.length === 0
		) {
			paragraph.remove();
		}
	}
}

function replaceTextNode(
	textNode: TextNodeRange,
	relevantRanges: readonly ScanRange[],
	inlineRanges: readonly StyledRange[],
	hiddenTagRanges: readonly ScanRange[],
	lineRanges: readonly StyledRange[],
): void {
	const parent = textNode.node.parentNode;
	if (!parent) {
		return;
	}

	const boundaries = collectBoundaries(textNode, relevantRanges);
	const fragment = window.createFragment();
	let didChange = false;

	for (let index = 0; index < boundaries.length - 1; index++) {
		const localFrom = boundaries[index];
		const localTo = boundaries[index + 1];
		if (
			localFrom === undefined ||
			localTo === undefined ||
			localFrom >= localTo
		) {
			continue;
		}

		const segment = {
			from: textNode.from + localFrom,
			to: textNode.from + localTo,
		};
		const text = textNode.node.data.slice(localFrom, localTo);
		const lineRange = lineRanges.find((range) =>
			rangesOverlap(segment, range),
		);
		if (lineRange) {
			fragment.appendChild(
				createLineElement(
					textNode.node.ownerDocument,
					lineRange.cssClass,
				),
			);
			didChange = true;
			continue;
		}

		if (rangeOverlapsAny(segment, hiddenTagRanges)) {
			didChange = true;
			continue;
		}

		const classNames = getInlineClassNames(segment, inlineRanges);
		if (classNames.length === 0) {
			fragment.appendChild(
				textNode.node.ownerDocument.createTextNode(text),
			);
			continue;
		}

		fragment.createEl("span", {
			cls: classNames,
			text: text,
		});
		didChange = true;
	}

	if (didChange) {
		parent.replaceChild(fragment, textNode.node);
	}
}

function collectBoundaries(
	textNode: TextNodeRange,
	ranges: readonly ScanRange[],
): number[] {
	const boundaries = new Set([0, textNode.node.data.length]);

	for (const range of ranges) {
		if (!rangesOverlap(textNode, range)) {
			continue;
		}

		boundaries.add(Math.max(range.from, textNode.from) - textNode.from);
		boundaries.add(Math.min(range.to, textNode.to) - textNode.from);
	}

	return [...boundaries].sort((left, right) => left - right);
}

function getInlineClassNames(
	segment: ScanRange,
	inlineRanges: readonly StyledRange[],
): string[] {
	const classNames = new Set<string>();

	for (const range of inlineRanges) {
		if (rangesOverlap(segment, range)) {
			addCssClassNames(classNames, range.cssClass);
		}
	}

	return [...classNames];
}

function getOrCreateClassSet(
	map: Map<HTMLElement, Set<string>>,
	element: HTMLElement,
): Set<string> {
	const existing = map.get(element);
	if (existing) {
		return existing;
	}

	const classNames = new Set<string>();
	map.set(element, classNames);
	return classNames;
}

function addCssClassNames(target: Set<string>, cssClass: string): void {
	for (const className of cssClass.split(/\s+/)) {
		if (className.length > 0) {
			target.add(className);
		}
	}
}

function getActiveRangeStartIndex(
	ranges: readonly ScanRange[],
	from: number,
	startIndex: number,
): number {
	let index = startIndex;
	while (index < ranges.length && ranges[index]!.to <= from) {
		index += 1;
	}

	return index;
}

function getOverlappingSortedRanges<T extends ScanRange>(
	range: ScanRange,
	ranges: readonly T[],
	startIndex: number,
): T[] {
	const overlappingRanges: T[] = [];

	for (let index = startIndex; index < ranges.length; index += 1) {
		const candidate = ranges[index]!;
		if (candidate.from >= range.to) {
			break;
		}

		if (rangesOverlap(range, candidate)) {
			overlappingRanges.push(candidate);
		}
	}

	return overlappingRanges;
}

function toScanRange(range: ScanRange): ScanRange {
	return {
		from: range.from,
		to: range.to,
	};
}

function rangeOverlapsAny(
	range: ScanRange,
	ranges: readonly ScanRange[],
): boolean {
	return ranges.some((candidate) => rangesOverlap(range, candidate));
}
