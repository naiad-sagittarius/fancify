import { getDisplayName } from "../helpers";

export function renderListItemContent(
	container: HTMLElement,
	value: string,
	fallback: string,
): void {
	const contentEl = container.createDiv("fancify-row-content");
	contentEl.createDiv({
		cls: "fancify-row-label",
		text: getDisplayName(value, fallback),
	});
}
