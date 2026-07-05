import { renderIconButton } from "./fields";

export interface ListDragState<T> {
	draggedItem: T | null;
}

export function renderListItemActions<T>(params: {
	actionsEl: HTMLElement;
	itemEl: HTMLElement;
	item: T;
	index: number;
	dragState: ListDragState<T>;
	duplicateLabel: string;
	deleteLabel: string;
	dragLabel: string;
	onDuplicate: () => void | Promise<void>;
	onDelete: () => void | Promise<void>;
	onMove: (item: T, targetIndex: number) => void | Promise<void>;
}): void {
	const duplicateButton = renderIconButton(
		params.actionsEl,
		params.duplicateLabel,
		"copy",
		params.onDuplicate,
	);
	bindListItemActionState(params.itemEl, duplicateButton.buttonEl);

	const deleteButton = renderIconButton(
		params.actionsEl,
		params.deleteLabel,
		"trash",
		params.onDelete,
		true,
	);
	bindListItemActionState(params.itemEl, deleteButton.buttonEl);

	const dragButton = renderIconButton(
		params.actionsEl,
		params.dragLabel,
		"grip-vertical",
		() => {},
	);
	dragButton.buttonEl.addClass("fancify-row-drag-handle");
	dragButton.buttonEl.draggable = true;
	bindListItemActionState(params.itemEl, dragButton.buttonEl);
	bindListItemDragState(params);
}

function bindListItemDragState<T>(params: {
	itemEl: HTMLElement;
	item: T;
	index: number;
	dragState: ListDragState<T>;
	onMove: (item: T, targetIndex: number) => void | Promise<void>;
}): void {
	const dragHandleEl = params.itemEl.querySelector(
		".fancify-row-drag-handle",
	);
	if (!(dragHandleEl instanceof HTMLElement)) {
		return;
	}

	dragHandleEl.addEventListener("dragstart", (event) => {
		params.dragState.draggedItem = params.item;
		params.itemEl.addClass("is-dragging");
		event.dataTransfer?.setData("text/plain", "");
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
		}
	});

	dragHandleEl.addEventListener("dragend", () => {
		params.dragState.draggedItem = null;
		params.itemEl.removeClass("is-dragging");
	});

	params.itemEl.addEventListener("dragover", (event) => {
		if (!params.dragState.draggedItem) {
			return;
		}

		event.preventDefault();
		params.itemEl.addClass("is-drag-over");
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "move";
		}
	});

	params.itemEl.addEventListener("dragleave", () => {
		params.itemEl.removeClass("is-drag-over");
	});

	params.itemEl.addEventListener("drop", (event) => {
		const draggedItem = params.dragState.draggedItem;
		params.itemEl.removeClass("is-drag-over");
		if (!draggedItem || draggedItem === params.item) {
			return;
		}

		event.preventDefault();
		const rect = params.itemEl.getBoundingClientRect();
		const isAfterMidpoint = event.clientY > rect.top + rect.height / 2;
		const targetIndex = params.index + (isAfterMidpoint ? 1 : 0);
		void params.onMove(draggedItem, targetIndex);
	});
}

function bindListItemActionState(
	itemEl: HTMLElement,
	buttonEl: HTMLElement,
): void {
	buttonEl.addEventListener("click", (event) => {
		event.stopPropagation();
	});
	buttonEl.addEventListener("pointerenter", () => {
		itemEl.addClass("is-action-hovered");
	});
	buttonEl.addEventListener("pointerleave", () => {
		itemEl.removeClass("is-action-hovered");
	});
	buttonEl.addEventListener("focus", () => {
		itemEl.addClass("is-action-hovered");
	});
	buttonEl.addEventListener("blur", () => {
		itemEl.removeClass("is-action-hovered");
	});
}
