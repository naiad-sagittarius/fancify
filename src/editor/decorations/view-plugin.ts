import { Prec, type Extension, type Text } from "@codemirror/state";
import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	DecorationSet,
	Decoration,
	keymap,
} from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { buildFancifyDecorations } from "./decoration-builder";
import { detectFrontmatter } from "./frontmatter";
import { getHiddenTagRanges } from "./pair-builder";
import {
	createTagDeleteTransaction,
	getTagDeleteRanges,
	type DeleteDirection,
	type TagDeleteRange,
} from "./tag-delete";
import { FancifyScanEngine } from "./scan-engine";
import { createInvalidTagCleanupTransaction } from "./invalid-tag-cleanup";
import { createTagRangeSplitTransaction } from "../tag-range-split";
import {
	expandRanges,
	intersectRanges,
	mergeRanges,
	rangesOverlap,
} from "./scan-range-utils";
import { collectTextBlockElementExclusions } from "./text-exclusion-collector";
import {
	isBlankParagraphLine,
	isStandaloneFancifyTagLine,
	isThematicBreakLine,
} from "../paragraph-ranges";
import type { InvalidTag, ScanRange, StyledRange, TagPair } from "./types";

const viewportBuffer = 2000;

interface VerticalLineOverlayRange {
	readonly fromLineFrom: number;
	readonly toLineFrom: number;
	readonly patternFromLineFrom: number;
	readonly cssClass: string;
}

export function createFancifyViewPlugin(): Extension[] {
	const plugin = ViewPlugin.fromClass(
		class {
			private decorationSet: DecorationSet = Decoration.none;
			private readonly scanEngine = new FancifyScanEngine();
			private readonly verticalLineOverlayLayer: HTMLElement;
			private overlayUpdateFrame: number | null = null;
			private documentBlockExclusions: ScanRange[] = [];
			private styledRanges: StyledRange[] = [];
			private tagPairs: TagPair[] = [];
			private tagDeleteRanges: TagDeleteRange[] = [];
			private tagCleanupInvalidTags: InvalidTag[] = [];
			private tagCleanupTimeout: number | null = null;
			private tagRangeSplitRanges: ScanRange[] = [];
			private tagRangeSplitTimeout: number | null = null;
			private readonly handleScroll = () => {
				this.scheduleVerticalLineOverlayUpdate();
			};

			constructor(private readonly view: EditorView) {
				this.verticalLineOverlayLayer =
					view.dom.ownerDocument.createElement("div");
				this.verticalLineOverlayLayer.className =
					"fancify-line-vertical-overlay-layer";
				this.view.dom.appendChild(this.verticalLineOverlayLayer);
				this.view.scrollDOM.addEventListener(
					"scroll",
					this.handleScroll,
					{
						passive: true,
					},
				);
				this.rebuildDocumentBlockExclusions();
				this.buildDecorations(true);
			}

			update(update: ViewUpdate) {
				if (update.docChanged) {
					const previousBlockExclusions =
						this.documentBlockExclusions;
					const documentBlockExclusions = getDocumentBlockExclusions(
						update.state.doc,
					);
					const splitRanges = getChangedNewBlockExclusions(
						update,
						previousBlockExclusions,
						documentBlockExclusions,
					);
					this.documentBlockExclusions = documentBlockExclusions;
					this.buildDecorations(true);
					this.scheduleTagRangeSplit(splitRanges);
					return;
				}

				if (update.viewportChanged) {
					this.buildDecorations();
					return;
				}

				if (update.geometryChanged || update.heightChanged) {
					this.scheduleVerticalLineOverlayUpdate();
				}
			}

			destroy() {
				this.view.scrollDOM.removeEventListener(
					"scroll",
					this.handleScroll,
				);
				if (this.overlayUpdateFrame !== null) {
					getViewWindow(this.view).cancelAnimationFrame(
						this.overlayUpdateFrame,
					);
					this.overlayUpdateFrame = null;
				}
				if (this.tagCleanupTimeout !== null) {
					getViewWindow(this.view).clearTimeout(
						this.tagCleanupTimeout,
					);
					this.tagCleanupTimeout = null;
				}
				if (this.tagRangeSplitTimeout !== null) {
					getViewWindow(this.view).clearTimeout(
						this.tagRangeSplitTimeout,
					);
					this.tagRangeSplitTimeout = null;
				}
				this.verticalLineOverlayLayer.remove();
			}

			handleDeleteKey(direction: DeleteDirection): boolean {
				const transaction = createTagDeleteTransaction(
					this.view.state,
					this.tagDeleteRanges,
					direction,
				);
				if (!transaction) {
					return false;
				}

				this.view.dispatch({
					...transaction,
					scrollIntoView: true,
				});
				return true;
			}

			private buildDecorations(forceFullCleanupScan = false) {
				const doc = this.view.state.doc;
				const visibleRanges = this.getVisibleScanRanges(0);
				let usedFullScan = false;

				let result = this.scanEngine.build(
					this.getTreeForRanges(visibleRanges),
					doc,
					visibleRanges,
					this.documentBlockExclusions,
				);

				if (result.needsWiderScan) {
					const bufferedRanges =
						this.getVisibleScanRanges(viewportBuffer);

					result = this.scanEngine.build(
						this.getTreeForRanges(bufferedRanges),
						doc,
						bufferedRanges,
						this.documentBlockExclusions,
					);
				}

				if (result.needsWiderScan) {
					const fullDocumentRanges = [{ from: 0, to: doc.length }];
					usedFullScan = true;

					result = this.scanEngine.build(
						this.getTreeForRanges(fullDocumentRanges),
						doc,
						fullDocumentRanges,
						this.documentBlockExclusions,
					);
				}

				this.styledRanges = result.nodes;
				this.tagPairs = result.tagPairs;
				this.tagDeleteRanges = getTagDeleteRanges(result.tagPairs);
				this.updateVisibleDecorations();

				const cleanupResult =
					forceFullCleanupScan && !usedFullScan
						? this.scanEngine.build(
								this.getTreeForRanges([
									{ from: 0, to: doc.length },
								]),
								doc,
								[{ from: 0, to: doc.length }],
								this.documentBlockExclusions,
							)
						: result;

				this.scheduleTagCleanup(cleanupResult.invalidTags);
			}

			private updateVisibleDecorations() {
				const visibleRanges = this.getVisibleScanRanges(0);
				const tagRanges = getHiddenTagRanges(this.tagPairs);

				this.decorationSet = buildFancifyDecorations(
					this.styledRanges,
					this.view.state.doc,
					intersectRanges(tagRanges, visibleRanges),
					visibleRanges,
				);
				this.scheduleVerticalLineOverlayUpdate();
			}

			private scheduleTagCleanup(invalidTags: readonly InvalidTag[]) {
				this.tagCleanupInvalidTags = [...invalidTags];
				if (
					this.tagCleanupInvalidTags.length === 0 ||
					this.tagCleanupTimeout !== null
				) {
					return;
				}

				this.tagCleanupTimeout = getViewWindow(this.view).setTimeout(
					() => {
						this.tagCleanupTimeout = null;
						this.removeInvalidTags();
					},
					0,
				);
			}

			private removeInvalidTags() {
				const transaction = createInvalidTagCleanupTransaction(
					this.view.state,
					this.tagCleanupInvalidTags,
				);
				this.tagCleanupInvalidTags = [];
				if (!transaction) {
					return;
				}

				this.view.dispatch(transaction);
			}

			private scheduleTagRangeSplit(splitRanges: readonly ScanRange[]) {
				if (splitRanges.length === 0) {
					return;
				}

				this.tagRangeSplitRanges = mergeRanges([
					...this.tagRangeSplitRanges,
					...splitRanges,
				]);
				if (this.tagRangeSplitTimeout !== null) {
					return;
				}

				this.tagRangeSplitTimeout = getViewWindow(this.view).setTimeout(
					() => {
						this.tagRangeSplitTimeout = null;
						this.splitTagRangesAroundExclusions();
					},
					0,
				);
			}

			private splitTagRangesAroundExclusions() {
				const splitRanges = this.tagRangeSplitRanges;
				this.tagRangeSplitRanges = [];
				if (splitRanges.length === 0) {
					return;
				}

				const doc = this.view.state.doc;
				const fullDocumentRanges = [{ from: 0, to: doc.length }];
				const result = this.scanEngine.build(
					this.getTreeForRanges(fullDocumentRanges),
					doc,
					fullDocumentRanges,
					this.documentBlockExclusions,
				);
				const transaction = createTagRangeSplitTransaction(
					doc,
					result.tagPairs,
					splitRanges,
				);
				if (!transaction) {
					return;
				}

				this.view.dispatch(transaction);
			}

			private scheduleVerticalLineOverlayUpdate() {
				if (this.overlayUpdateFrame !== null) {
					return;
				}

				this.overlayUpdateFrame = getViewWindow(
					this.view,
				).requestAnimationFrame(() => {
					this.overlayUpdateFrame = null;
					this.renderVerticalLineOverlays();
				});
			}

			private renderVerticalLineOverlays() {
				const doc = this.view.state.doc;
				const visibleRanges = this.getVisibleScanRanges(0);
				const overlayRanges = getVerticalLineOverlayRanges(
					this.styledRanges,
					doc,
					visibleRanges,
				);

				this.verticalLineOverlayLayer.replaceChildren();
				if (overlayRanges.length === 0) {
					return;
				}

				const editorRect = this.view.dom.getBoundingClientRect();
				const contentRect =
					this.view.contentDOM.getBoundingClientRect();
				const left = contentRect.left - editorRect.left;

				for (const overlayRange of overlayRanges) {
					const fromBlock = this.view.lineBlockAt(
						overlayRange.fromLineFrom,
					);
					const toBlock = this.view.lineBlockAt(
						overlayRange.toLineFrom,
					);
					const patternBlock = this.view.lineBlockAt(
						overlayRange.patternFromLineFrom,
					);
					const top =
						this.view.documentTop +
						fromBlock.top * this.view.scaleY -
						editorRect.top;
					const bottom =
						this.view.documentTop +
						toBlock.bottom * this.view.scaleY -
						editorRect.top;
					const patternTop =
						this.view.documentTop +
						patternBlock.top * this.view.scaleY -
						editorRect.top;
					const height = bottom - top;
					if (
						!Number.isFinite(top) ||
						!Number.isFinite(height) ||
						height <= 0
					) {
						continue;
					}

					const lineEl =
						this.view.dom.ownerDocument.createElement("div");
					lineEl.className = `${overlayRange.cssClass} fancify-line-vertical-overlay`;
					lineEl.style.setProperty(
						"--fancify-line-overlay-left",
						`${left}px`,
					);
					lineEl.style.setProperty(
						"--fancify-line-overlay-pattern-offset-y",
						formatOverlayPixelValue(patternTop - top),
					);
					lineEl.style.top = `${top}px`;
					lineEl.style.height = `${height}px`;
					this.verticalLineOverlayLayer.appendChild(lineEl);
				}
			}

			private getVisibleScanRanges(buffer: number): ScanRange[] {
				const docLength = this.view.state.doc.length;
				const baseRanges =
					this.view.visibleRanges.length > 0
						? this.view.visibleRanges
						: [{ from: 0, to: docLength }];

				return expandRanges(baseRanges, docLength, buffer);
			}

			private rebuildDocumentBlockExclusions() {
				this.documentBlockExclusions = getDocumentBlockExclusions(
					this.view.state.doc,
				);
			}

			private getTreeForRanges(ranges: readonly ScanRange[]) {
				const lastRange = ranges[ranges.length - 1];
				const upto = lastRange?.to ?? this.view.state.doc.length;
				return (
					ensureSyntaxTree(this.view.state, upto, 50) ??
					syntaxTree(this.view.state)
				);
			}

			get decorations(): DecorationSet {
				return this.decorationSet;
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);

	return [
		plugin,
		Prec.highest(
			keymap.of([
				{
					key: "Backspace",
					run: (view) =>
						view.plugin(plugin)?.handleDeleteKey(-1) ?? false,
				},
				{
					key: "Delete",
					run: (view) =>
						view.plugin(plugin)?.handleDeleteKey(1) ?? false,
				},
			]),
		),
	];
}

function getVerticalLineOverlayRanges(
	nodes: readonly StyledRange[],
	doc: Text,
	visibleRanges: readonly ScanRange[],
): VerticalLineOverlayRange[] {
	const overlayRanges: VerticalLineOverlayRange[] = [];

	for (const node of nodes) {
		if (node.styleType !== "vertical-line" || node.from >= node.to) {
			continue;
		}

		for (const visibleNode of intersectRanges([node], visibleRanges)) {
			const fromLine = doc.lineAt(visibleNode.from);
			const toLine = doc.lineAt(
				Math.max(visibleNode.from, visibleNode.to - 1),
			);
			let activeRange: VerticalLineOverlayRange | null = null;

			for (
				let lineNumber = fromLine.number;
				lineNumber <= toLine.number;
				lineNumber += 1
			) {
				const line = doc.line(lineNumber);
				if (
					isVerticalLineOverlayBoundary(line.text) ||
					!rangesOverlap(getLineRange(line), node)
				) {
					if (activeRange) {
						overlayRanges.push(activeRange);
						activeRange = null;
					}
					continue;
				}

				if (!activeRange) {
					activeRange = {
						fromLineFrom: line.from,
						toLineFrom: line.from,
						patternFromLineFrom: doc.line(
							getVisualBlockStartLineNumber(
								lineNumber,
								doc.lineAt(node.from).number,
								doc,
							),
						).from,
						cssClass: node.cssClass,
					};
					continue;
				}

				const currentRange: VerticalLineOverlayRange = activeRange;
				activeRange = {
					...currentRange,
					toLineFrom: line.from,
				};
			}

			if (activeRange) {
				overlayRanges.push(activeRange);
			}
		}
	}

	return overlayRanges;
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

function isVerticalLineOverlayBoundary(text: string): boolean {
	return (
		isBlankParagraphLine(text) ||
		isStandaloneFancifyTagLine(text) ||
		isThematicBreakLine(text)
	);
}

function getVisualBlockStartLineNumber(
	lineNumber: number,
	fromLineNumber: number,
	doc: Text,
): number {
	let blockStartLineNumber = lineNumber;

	while (
		blockStartLineNumber > fromLineNumber &&
		!isVerticalLineOverlayBoundary(doc.line(blockStartLineNumber - 1).text)
	) {
		blockStartLineNumber -= 1;
	}

	return blockStartLineNumber;
}

function formatOverlayPixelValue(value: number): string {
	const roundedValue = Math.round(value * 1000) / 1000;
	return `${Object.is(roundedValue, -0) ? 0 : roundedValue}px`;
}

function getDocumentBlockExclusions(doc: Text): ScanRange[] {
	const frontmatter = detectFrontmatter(doc);

	return mergeRanges([
		...collectTextBlockElementExclusions(doc),
		...(frontmatter ? [frontmatter] : []),
	]);
}

function getChangedNewBlockExclusions(
	update: ViewUpdate,
	previousBlockExclusions: readonly ScanRange[],
	documentBlockExclusions: readonly ScanRange[],
): ScanRange[] {
	const changedRanges = getChangedRanges(update);
	if (changedRanges.length === 0 || documentBlockExclusions.length === 0) {
		return [];
	}

	const previousExclusionsInCurrentDoc = mapRangesThroughChanges(
		previousBlockExclusions,
		update,
	);

	return documentBlockExclusions.filter(
		(exclusion) =>
			changedRanges.some((range) => rangesOverlap(range, exclusion)) &&
			!previousExclusionsInCurrentDoc.some((previousExclusion) =>
				rangesOverlap(previousExclusion, exclusion),
			),
	);
}

function getChangedRanges(update: ViewUpdate): ScanRange[] {
	const ranges: ScanRange[] = [];

	update.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
		if (fromB < toB) {
			ranges.push({ from: fromB, to: toB });
		}
	});

	return mergeRanges(ranges);
}

function mapRangesThroughChanges(
	ranges: readonly ScanRange[],
	update: ViewUpdate,
): ScanRange[] {
	const docLength = update.state.doc.length;

	return ranges.flatMap((range) => {
		const from = clampOffset(
			update.changes.mapPos(range.from, 1),
			docLength,
		);
		const to = clampOffset(update.changes.mapPos(range.to, -1), docLength);

		return from < to ? [{ from, to }] : [];
	});
}

function clampOffset(offset: number, docLength: number): number {
	return Math.max(0, Math.min(offset, docLength));
}

function getViewWindow(view: EditorView): Window {
	return view.dom.ownerDocument.defaultView ?? window;
}
