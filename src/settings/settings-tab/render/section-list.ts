import { setSafeIcon } from "../../../tools/icon-rendering";

interface RenderSectionListPanelOptions {
	title: string;
	emptyText: string;
	createButtonLabel: string;
	hasItems: boolean;
	onCreate: () => void | Promise<void>;
	renderItems: (listEl: HTMLElement) => void;
}

export function renderSectionListPanel(
	container: HTMLElement,
	options: RenderSectionListPanelOptions,
): HTMLElement {
	const panelEl = container.createDiv("fancify-section-list-panel");
	const headerEl = panelEl.createDiv("fancify-section-list-header");
	headerEl.createSpan({
		cls: "fancify-section-list-title",
		text: options.title,
	});

	const addButtonEl = headerEl.createEl("button", {
		attr: {
			"aria-label": options.createButtonLabel,
			type: "button",
		},
		cls: ["fancify-section-list-add", "fancify-center-content"],
	});
	const addIconEl = addButtonEl.createSpan({
		cls: ["fancify-section-list-add-icon", "fancify-center-content"],
		attr: { "aria-hidden": "true" },
	});
	setSafeIcon(addIconEl, "plus");

	addButtonEl.addEventListener("click", () => {
		void options.onCreate();
	});

	const listEl = panelEl.createDiv("fancify-section-list");
	if (options.hasItems) {
		options.renderItems(listEl);
	} else {
		listEl.createDiv({
			cls: "fancify-empty-state",
			text: options.emptyText,
		});
	}

	return listEl;
}
