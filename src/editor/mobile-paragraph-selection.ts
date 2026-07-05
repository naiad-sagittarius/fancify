import {
	EditorSelection,
	type Extension,
	type Line,
	type Text as CodeMirrorText,
} from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { expandLineRangeToParagraphs } from "./paragraph-ranges";

interface SelectionRange {
	readonly from: number;
	readonly to: number;
}

interface PendingLongPress {
	readonly inputId: number;
	readonly inputType: "pointer" | "touch";
	readonly startX: number;
	readonly startY: number;
	readonly selectionRange: SelectionRange;
}

const mobileParagraphLongPressDelay = 600;
const mobileParagraphMoveTolerance = 10;
const rightEdgeMinWidth = 36;
const rightEdgeMaxWidth = 96;
const rightEdgeWidthRatio = 0.14;
const textEdgeGap = 6;
const lineVerticalTolerance = 4;

export function createMobileParagraphSelectionExtension(): Extension {
	return ViewPlugin.fromClass(
		class {
			private longPressTimer: number | null = null;
			private timerWindow: Window | null = null;
			private pendingLongPress: PendingLongPress | null = null;
			private readonly abortController = new AbortController();

			constructor(private readonly view: EditorView) {
				this.registerScrollDomListeners();
			}

			handlePointerDown(event: PointerEvent): void {
				if (!isTouchLikePrimaryPointer(event)) {
					return;
				}

				const selectionRange = getRightEdgeParagraphSelection(
					this.view,
					event.clientX,
					event.clientY,
					event.target,
				);
				if (!selectionRange) {
					return;
				}

				this.startLongPress(
					event,
					{
						inputId: event.pointerId,
						inputType: "pointer",
						startX: event.clientX,
						startY: event.clientY,
						selectionRange,
					},
				);

				trySetPointerCapture(this.view.scrollDOM, event.pointerId);
			}

			handlePointerMove(event: PointerEvent): void {
				const pending = this.pendingLongPress;
				if (
					!pending ||
					pending.inputType !== "pointer" ||
					pending.inputId !== event.pointerId
				) {
					return;
				}

				this.handleLongPressMove(event.clientX, event.clientY);
			}

			handlePointerEnd(event: PointerEvent): void {
				const pending = this.pendingLongPress;
				if (
					pending?.inputType === "pointer" &&
					pending.inputId === event.pointerId
				) {
					this.clearLongPress();
					tryReleasePointerCapture(this.view.scrollDOM, event.pointerId);
				}
			}

			handleTouchStart(event: TouchEvent): void {
				if (this.pendingLongPress) {
					return;
				}

				const touch = event.changedTouches.item(0);
				if (!touch) {
					return;
				}

				const selectionRange = getRightEdgeParagraphSelection(
					this.view,
					touch.clientX,
					touch.clientY,
					event.target,
				);
				if (!selectionRange) {
					return;
				}

				this.startLongPress(
					event,
					{
						inputId: touch.identifier,
						inputType: "touch",
						startX: touch.clientX,
						startY: touch.clientY,
						selectionRange,
					},
				);
			}

			handleTouchMove(event: TouchEvent): void {
				const pending = this.pendingLongPress;
				if (!pending || pending.inputType !== "touch") {
					return;
				}

				const touch = findTouchById(event.changedTouches, pending.inputId);
				if (!touch) {
					return;
				}

				this.handleLongPressMove(touch.clientX, touch.clientY);
			}

			handleTouchEnd(event: TouchEvent): void {
				const pending = this.pendingLongPress;
				if (
					pending?.inputType === "touch" &&
					findTouchById(event.changedTouches, pending.inputId)
				) {
					this.clearLongPress();
				}
			}

			handleContextMenu(event: MouseEvent): void {
				if (this.pendingLongPress) {
					event.preventDefault();
					event.stopPropagation();
					this.commitPendingSelection(event);
				}
			}

			destroy(): void {
				this.abortController.abort();
				this.clearLongPress();
			}

			private registerScrollDomListeners(): void {
				const { signal } = this.abortController;
				this.view.scrollDOM.addEventListener("pointerdown", this.onPointerDown, {
					capture: true,
					passive: false,
					signal,
				});
				this.view.scrollDOM.addEventListener("pointermove", this.onPointerMove, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("pointerup", this.onPointerEnd, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("pointercancel", this.onPointerEnd, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("touchstart", this.onTouchStart, {
					capture: true,
					passive: false,
					signal,
				});
				this.view.scrollDOM.addEventListener("touchmove", this.onTouchMove, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("touchend", this.onTouchEnd, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("touchcancel", this.onTouchEnd, {
					capture: true,
					signal,
				});
				this.view.scrollDOM.addEventListener("contextmenu", this.onContextMenu, {
					capture: true,
					passive: false,
					signal,
				});
			}

			private readonly onPointerDown = (event: PointerEvent): void => {
				this.handlePointerDown(event);
			};

			private readonly onPointerMove = (event: PointerEvent): void => {
				this.handlePointerMove(event);
			};

			private readonly onPointerEnd = (event: PointerEvent): void => {
				this.handlePointerEnd(event);
			};

			private readonly onTouchStart = (event: TouchEvent): void => {
				this.handleTouchStart(event);
			};

			private readonly onTouchMove = (event: TouchEvent): void => {
				this.handleTouchMove(event);
			};

			private readonly onTouchEnd = (event: TouchEvent): void => {
				this.handleTouchEnd(event);
			};

			private readonly onContextMenu = (event: MouseEvent): void => {
				this.handleContextMenu(event);
			};

			private startLongPress(event: Event, pending: PendingLongPress): void {
				this.clearLongPress();
				this.pendingLongPress = pending;
				preventNativeSelection(event);

				this.timerWindow = this.view.dom.ownerDocument.defaultView ?? window;
				this.longPressTimer = this.timerWindow.setTimeout(() => {
					this.commitPendingSelection(event);
				}, mobileParagraphLongPressDelay);
			}

			private handleLongPressMove(clientX: number, clientY: number): void {
				const pending = this.pendingLongPress;
				if (!pending) {
					return;
				}

				const distance = Math.hypot(
					clientX - pending.startX,
					clientY - pending.startY,
				);
				if (distance > mobileParagraphMoveTolerance) {
					this.clearLongPress();
				}
			}

			private commitPendingSelection(event: Event): boolean {
				const pending = this.pendingLongPress;
				if (!pending) {
					return false;
				}

				this.clearTimer();
				this.pendingLongPress = null;
				this.selectRange(event, pending.selectionRange);
				return true;
			}

			private selectRange(event: Event, selectionRange: SelectionRange): void {
				preventNativeSelection(event);
				this.view.focus();
				this.view.dispatch({
					selection: EditorSelection.range(selectionRange.from, selectionRange.to),
					scrollIntoView: true,
					userEvent: "select.pointer",
				});
			}

			private clearLongPress(): void {
				this.clearTimer();
				this.pendingLongPress = null;
			}

			private clearTimer(): void {
				if (this.longPressTimer !== null) {
					this.timerWindow?.clearTimeout(this.longPressTimer);
					this.longPressTimer = null;
				}
				this.timerWindow = null;
			}
		},
	);
}

export function getParagraphSelectionForLine(
	doc: CodeMirrorText,
	lineNumber: number,
): SelectionRange | null {
	const paragraphRange = expandLineRangeToParagraphs({
		fromLine: lineNumber,
		toLine: lineNumber,
		firstLine: 1,
		lastLine: doc.lines,
		getLineText: (currentLineNumber) => doc.line(currentLineNumber).text,
	});

	if (!paragraphRange) {
		return null;
	}

	return {
		from: doc.line(paragraphRange.fromLine).from,
		to: doc.line(paragraphRange.toLine).to,
	};
}

function isTouchLikePrimaryPointer(event: PointerEvent): boolean {
	return (
		event.pointerType !== "mouse" &&
		event.isPrimary !== false &&
		event.button === 0
	);
}

function getRightEdgeParagraphSelection(
	view: EditorView,
	clientX: number,
	clientY: number,
	eventTarget: EventTarget | null,
): SelectionRange | null {
	const line = getDocumentLineAtClientY(view, clientY);
	if (!line) {
		return null;
	}

	const lineEl = getLineElementFromTarget(eventTarget) ?? getLineElement(view, line);
	if (!lineEl || !isRightEdgeOutsideText(view, lineEl, clientX, clientY)) {
		return null;
	}

	return getParagraphSelectionForLine(view.state.doc, line.number);
}

function getDocumentLineAtClientY(
	view: EditorView,
	clientY: number,
): Line | null {
	const relativeHeight = (clientY - view.documentTop) / view.scaleY;
	if (!Number.isFinite(relativeHeight)) {
		return null;
	}

	const block = view.lineBlockAtHeight(relativeHeight);
	const blockTop = view.documentTop + block.top * view.scaleY;
	const blockBottom = view.documentTop + (block.top + block.height) * view.scaleY;
	if (
		clientY < blockTop - lineVerticalTolerance ||
		clientY > blockBottom + lineVerticalTolerance
	) {
		return null;
	}

	return view.state.doc.lineAt(block.from);
}

function getLineElementFromTarget(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof Node)) {
		return null;
	}

	const element = nodeToElement(target);
	return getClosestLineElement(element);
}

function getLineElement(view: EditorView, line: Line): HTMLElement | null {
	for (const position of [line.from, line.to]) {
		const domPosition = view.domAtPos(position);
		const lineEl = getClosestLineElement(nodeToElement(domPosition.node));
		if (lineEl) {
			return lineEl;
		}
	}

	return null;
}

function nodeToElement(node: Node): Element | null {
	return node.nodeType === Node.ELEMENT_NODE
		? (node as Element)
		: node.parentElement;
}

function getClosestLineElement(element: Element | null): HTMLElement | null {
	const lineEl = element?.closest(".cm-line");
	return lineEl instanceof HTMLElement ? lineEl : null;
}

function isRightEdgeOutsideText(
	view: EditorView,
	lineEl: HTMLElement,
	clientX: number,
	clientY: number,
): boolean {
	const editorRect = view.scrollDOM.getBoundingClientRect();
	const edgeWidth = clamp(
		editorRect.width * rightEdgeWidthRatio,
		rightEdgeMinWidth,
		rightEdgeMaxWidth,
	);
	const isAtRightEdge =
		clientX >= editorRect.right - edgeWidth &&
		clientX <= editorRect.right + edgeWidth;
	if (!isAtRightEdge) {
		return false;
	}

	const textRight = getVisibleLineTextRight(lineEl, clientY);
	return textRight !== null && clientX > textRight + textEdgeGap;
}

function getVisibleLineTextRight(
	lineEl: HTMLElement,
	clientY: number,
): number | null {
	const textRights: number[] = [];
	const walker = lineEl.ownerDocument.createTreeWalker(
		lineEl,
		NodeFilter.SHOW_TEXT,
	);
	let currentNode = walker.nextNode();

	while (currentNode) {
		collectTextNodeRights(currentNode as Text, clientY, textRights);
		currentNode = walker.nextNode();
	}

	if (textRights.length === 0) {
		return null;
	}

	return Math.max(...textRights);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function collectTextNodeRights(
	textNode: Text,
	clientY: number,
	textRights: number[],
): void {
	if (textNode.data.length === 0 || !textNode.data.trim()) {
		return;
	}

	const range = textNode.ownerDocument.createRange();
	range.selectNodeContents(textNode);
	try {
		for (const rect of Array.from(range.getClientRects())) {
			if (
				rect.width > 0 &&
				clientY >= rect.top - lineVerticalTolerance &&
				clientY <= rect.bottom + lineVerticalTolerance
			) {
				textRights.push(rect.right);
			}
		}
	} finally {
		range.detach();
	}
}

function preventNativeSelection(event: Event): void {
	if (event.cancelable) {
		event.preventDefault();
	}
	event.stopPropagation();
}

function findTouchById(touches: TouchList, identifier: number): Touch | null {
	for (let index = 0; index < touches.length; index += 1) {
		const touch = touches.item(index);
		if (touch?.identifier === identifier) {
			return touch;
		}
	}

	return null;
}

function trySetPointerCapture(element: HTMLElement, pointerId: number): void {
	try {
		element.setPointerCapture(pointerId);
	} catch {
		// Some mobile webviews reject pointer capture during touch selection.
	}
}

function tryReleasePointerCapture(element: HTMLElement, pointerId: number): void {
	try {
		if (element.hasPointerCapture(pointerId)) {
			element.releasePointerCapture(pointerId);
		}
	} catch {
		// Pointer capture can already be gone after a native cancellation.
	}
}
