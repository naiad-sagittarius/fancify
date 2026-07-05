import {
	Decoration,
	DecorationSet,
	type EditorView,
	WidgetType,
} from "@codemirror/view";
import type { Text } from "@codemirror/state";
import { Menu } from "obsidian";
import { removeHorizontalLineFromView } from "../../commands/remove-horizontal-line";
import { createLineElement } from "../../line/render";
import {
	isBlockRangeStyleType,
	isHorizontalLineStyleType,
} from "../../styles/types";
import {
	isBlankParagraphLine,
	isStandaloneFancifyTagLine,
	isThematicBreakLine,
} from "../paragraph-ranges";
import {
	intersectRanges,
	normaliseRanges,
	rangesOverlap,
} from "./scan-range-utils";
import type { ScanRange, StyledRange } from "./types";

interface DecorationRange {
	readonly from: number;
	readonly to: number;
	readonly decoration: Decoration;
}

const hiddenTagDecoration = Decoration.replace({});
const blockLineClass = "fancify-block-line";
const blockStartClass = "fancify-block-start";
const blockEndClass = "fancify-block-end";
const blockGapClass = "fancify-block-gap";
const blockListClass = "fancify-block-list";
const hiddenTagLineClass = "fancify-hidden-tag-line";
const lineLongPressDelay = 600;
const lineLongPressMoveTolerance = 8;

class FancifyLineWidget extends WidgetType {
	constructor(
		private readonly cssClass: string,
		private readonly markerRange: ScanRange,
	) {
		super();
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof FancifyLineWidget &&
			other.cssClass === this.cssClass &&
			other.markerRange.from === this.markerRange.from &&
			other.markerRange.to === this.markerRange.to
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const lineEl = createLineElement(view.dom.ownerDocument, this.cssClass, {
			interactive: true,
		});
		let longPressTimer: number | null = null;
		let longPressStart: { x: number; y: number } | null = null;

		const clearLongPress = (): void => {
			if (longPressTimer !== null) {
				window.clearTimeout(longPressTimer);
				longPressTimer = null;
			}
			longPressStart = null;
		};

		const showMenuAtPosition = (x: number, y: number): void => {
			const menu = createHorizontalLineMenu(view, this.markerRange);
			menu.showAtPosition({ x, y }, lineEl.ownerDocument);
		};

		lineEl.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			clearLongPress();
			createHorizontalLineMenu(view, this.markerRange).showAtMouseEvent(event);
		});
		lineEl.addEventListener("pointerdown", (event) => {
			if (event.pointerType === "mouse") {
				return;
			}

			longPressStart = { x: event.clientX, y: event.clientY };
			longPressTimer = window.setTimeout(() => {
				longPressTimer = null;
				showMenuAtPosition(event.clientX, event.clientY);
			}, lineLongPressDelay);
		});
		lineEl.addEventListener("pointermove", (event) => {
			if (!longPressStart) {
				return;
			}

			const distance = Math.hypot(
				event.clientX - longPressStart.x,
				event.clientY - longPressStart.y,
			);
			if (distance > lineLongPressMoveTolerance) {
				clearLongPress();
			}
		});
		lineEl.addEventListener("pointerup", clearLongPress);
		lineEl.addEventListener("pointercancel", clearLongPress);
		lineEl.addEventListener("pointerleave", clearLongPress);
		lineEl.addEventListener("keydown", (event) => {
			if (event.key !== "Backspace" && event.key !== "Delete") {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			removeHorizontalLineFromView(view, this.markerRange);
		});

		return lineEl;
	}
}

function createHorizontalLineMenu(
	view: EditorView,
	markerRange: ScanRange,
): Menu {
	const menu = new Menu();
	menu.addItem((item) => {
		item
			.setTitle("Remove line")
			.setIcon("trash")
			.setSection("fancify-horizontal-line")
			.onClick(() => {
				removeHorizontalLineFromView(view, markerRange);
			});
	});
	return menu;
}

export function buildFancifyDecorations(
	nodes: StyledRange[],
	doc: Text,
	hiddenTagRanges: readonly ScanRange[] = [],
	visibleRanges: readonly ScanRange[] = [{ from: 0, to: doc.length }],
): DecorationSet {
	const decorationRanges: DecorationRange[] = [];
	const visibleScanRanges = normaliseRanges(visibleRanges, doc.length);

	for (const node of nodes) {
		if (isHorizontalLineStyleType(node.styleType)) {
			if (node.from > node.to) continue;

			decorationRanges.push(
				...buildLineWidgetDecorations(node, visibleScanRanges),
			);
			continue;
		}

		if (node.from >= node.to) continue;

		if (isBlockRangeStyleType(node.styleType)) {
			decorationRanges.push(
				...buildLineDecorations(node, doc, visibleScanRanges),
			);
			continue;
		}

		for (const visibleNode of intersectRanges([node], visibleScanRanges)) {
			decorationRanges.push({
				from: visibleNode.from,
				to: visibleNode.to,
				decoration: Decoration.mark({ class: node.cssClass }),
			});
		}
	}

	for (const tagRange of intersectRanges(hiddenTagRanges, visibleScanRanges)) {
		if (tagRange.from >= tagRange.to) continue;

		decorationRanges.push({
			from: tagRange.from,
			to: tagRange.to,
			decoration: hiddenTagDecoration,
		});

		const line = doc.lineAt(tagRange.from);
		if (
			tagRange.to <= line.to &&
			isStandaloneFancifyTagLine(line.text)
		) {
			decorationRanges.push({
				from: line.from,
				to: line.from,
				decoration: Decoration.line({ class: hiddenTagLineClass }),
			});
		}
	}

	return Decoration.set(
		decorationRanges.map((range) =>
			range.decoration.range(range.from, range.to),
		),
		true,
	);
}

function buildLineDecorations(
	node: StyledRange,
	doc: Text,
	visibleRanges: readonly ScanRange[],
): DecorationRange[] {
	const ranges: DecorationRange[] = [];
	const fromLine = doc.lineAt(node.from);
	const toLine = doc.lineAt(Math.max(node.from, node.to - 1));
	const visibleLineNumbers = getVisibleLineNumbers(node, doc, visibleRanges);

	for (const lineNumber of visibleLineNumbers) {
		const line = doc.line(lineNumber);
		if (isStandaloneFancifyTagLine(line.text)) {
			continue;
		}

		if (isThematicBreakLine(line.text)) {
			continue;
		}

		const listLineRange = getListLineRange(lineNumber, line, doc);
		if (listLineRange) {
			if (rangesOverlap(listLineRange, node)) {
				const className = getBlockLineClassName(
					node.cssClass,
					isBlockStartLine(lineNumber, fromLine.number, doc),
					isBlockEndLine(lineNumber, toLine.number, doc),
					[blockListClass],
				);

				ranges.push({
					from: line.from,
					to: line.from,
					decoration: Decoration.line({ class: className }),
				});
			}
			continue;
		}

		if (isBlankParagraphLine(line.text)) {
			ranges.push({
				from: line.from,
				to: line.from,
				decoration: Decoration.line({ class: blockGapClass }),
			});
			continue;
		}

		const className = getBlockLineClassName(
			node.cssClass,
			isBlockStartLine(lineNumber, fromLine.number, doc),
			isBlockEndLine(lineNumber, toLine.number, doc),
		);

		ranges.push({
			from: line.from,
			to: line.from,
			decoration: Decoration.line({ class: className }),
		});
	}

	return ranges;
}

function buildLineWidgetDecorations(
	node: StyledRange,
	visibleRanges: readonly ScanRange[],
): DecorationRange[] {
	if (intersectRanges([node], visibleRanges).length === 0) {
		return [];
	}

	return [
		{
			from: node.from,
			to: node.to,
			decoration: Decoration.replace({
				widget: new FancifyLineWidget(node.cssClass, {
					from: node.from,
					to: node.to,
				}),
			}),
		},
	];
}

function getVisibleLineNumbers(
	node: StyledRange,
	doc: Text,
	visibleRanges: readonly ScanRange[],
): number[] {
	const lineNumbers = new Set<number>();

	for (const visibleRange of intersectRanges([node], visibleRanges)) {
		const fromLine = doc.lineAt(visibleRange.from);
		const toLine = doc.lineAt(Math.max(visibleRange.from, visibleRange.to - 1));

		for (
			let lineNumber = fromLine.number;
			lineNumber <= toLine.number;
			lineNumber += 1
		) {
			lineNumbers.add(lineNumber);
		}
	}

	return [...lineNumbers].sort((left, right) => left - right);
}

function getBlockLineClassName(
	cssClass: string,
	isStart: boolean,
	isEnd: boolean,
	extraClassNames: readonly string[] = [],
): string {
	const classNames = [cssClass, blockLineClass, ...extraClassNames];

	if (isStart) {
		classNames.push(blockStartClass);
	}

	if (isEnd) {
		classNames.push(blockEndClass);
	}

	return classNames.join(" ");
}

function getLineRange(line: {
	readonly from: number;
	readonly to: number;
}): ScanRange {
	return {
		from: line.from,
		to: line.to,
	};
}

function getListLineRange(
	lineNumber: number,
	line: {
	readonly from: number;
	readonly to: number;
	readonly text: string;
	},
	doc: Text,
): ScanRange | null {
	if (!isListMarkerLine(line.text) && !isListContinuationLine(lineNumber, doc)) {
		return null;
	}

	return getLineRange(line);
}

function isListMarkerLine(text: string): boolean {
	return /^\s{0,3}(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.test(text);
}

function isListContinuationLine(lineNumber: number, doc: Text): boolean {
	if (!/^\s{2,}\S/.test(doc.line(lineNumber).text)) {
		return false;
	}

	return (
		(lineNumber > 1 && isListMarkerLine(doc.line(lineNumber - 1).text)) ||
		(lineNumber < doc.lines && isListMarkerLine(doc.line(lineNumber + 1).text))
	);
}

function isBlockStartLine(
	lineNumber: number,
	fromLineNumber: number,
	doc: Text,
): boolean {
	if (lineNumber <= fromLineNumber) {
		return true;
	}

	return isBlockBoundaryLine(doc.line(lineNumber - 1).text);
}

function isBlockEndLine(
	lineNumber: number,
	toLineNumber: number,
	doc: Text,
): boolean {
	if (lineNumber >= toLineNumber) {
		return true;
	}

	return isBlockBoundaryLine(doc.line(lineNumber + 1).text);
}

function isBlockBoundaryLine(text: string): boolean {
	return (
		isBlankParagraphLine(text) ||
		isStandaloneFancifyTagLine(text) ||
		isThematicBreakLine(text)
	);
}
