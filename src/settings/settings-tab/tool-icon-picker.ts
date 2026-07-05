import { Modal, TextComponent, type App } from "obsidian";
import { setSafeIcon } from "../../tools/icon-rendering";
import {
	getFeaturedToolIconIds,
	searchToolIconIds,
} from "../../tools/icons";
import type { Tool } from "../../tools/types";
import { renderToolIconPlaceholder } from "./render/tool-icon";

const defaultIconSuggestionCount = 63;

export class ToolIconPickerModal extends Modal {
	private readonly selectedIcon: Tool["icon"] | null;
	private readonly onChoose: (icon: Tool["icon"] | null) => void;
	private searchComponent: TextComponent | null = null;
	private resultsEl: HTMLElement | null = null;
	private query = "";

	constructor(
		app: App,
		selectedIcon: Tool["icon"] | null | undefined,
		onChoose: (icon: Tool["icon"] | null) => void,
	) {
		super(app);
		this.selectedIcon = selectedIcon ?? null;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		this.modalEl.addClass("fancify-icon-picker-modal");
		this.titleEl.empty();
		this.contentEl.empty();

		const searchEl = this.contentEl.createDiv("fancify-icon-picker-search");
		this.searchComponent = new TextComponent(searchEl);
		this.searchComponent.setPlaceholder("Search icons");
		this.searchComponent.onChange((value) => {
			this.query = value;
			this.renderResults();
		});

		this.resultsEl = this.contentEl.createDiv("fancify-icon-picker-results");
		this.renderResults();

		window.setTimeout(() => {
			this.searchComponent?.inputEl.focus();
		}, 0);
	}

	onClose(): void {
		this.query = "";
		this.searchComponent = null;
		this.resultsEl = null;
		this.contentEl.empty();
		this.modalEl.removeClass("fancify-icon-picker-modal");
	}

	private getInitialIconIds(): NonNullable<Tool["icon"]>[] {
		const iconIds = getFeaturedToolIconIds(defaultIconSuggestionCount);
		if (!this.selectedIcon) {
			return iconIds;
		}

		return [
			this.selectedIcon,
			...iconIds.filter((iconId) => iconId !== this.selectedIcon),
		].slice(0, defaultIconSuggestionCount);
	}

	private renderResults(): void {
		if (!this.resultsEl) {
			return;
		}

		const trimmedQuery = this.query.trim();
		const iconIds =
			trimmedQuery === ""
				? this.getInitialIconIds()
				: searchToolIconIds(trimmedQuery);

		this.resultsEl.empty();
		const gridEl = this.resultsEl.createDiv("fancify-icon-picker-grid");
		if (trimmedQuery === "") {
			this.renderResetCard(gridEl);
		}

		if (iconIds.length === 0) {
			this.resultsEl.createDiv({
				cls: "fancify-empty-state",
				text: `No icons found for "${trimmedQuery}".`,
			});
			return;
		}

		for (const iconId of iconIds) {
			this.renderIconCard(gridEl, iconId);
		}
	}

	private renderResetCard(container: HTMLElement): void {
		const isSelected = this.selectedIcon === null;
		const buttonEl = container.createEl("button", {
			attr: {
				"aria-label": "No icon",
				title: "No icon",
				type: "button",
			},
			cls: [
				"fancify-icon-picker-card",
				"fancify-center-content",
				"fancify-icon-picker-card-reset",
				isSelected ? "is-selected" : "",
			],
		});

		const previewEl = buttonEl.createDiv({
			cls: [
				"fancify-icon-picker-card-preview",
				"fancify-center-content",
				"fancify-icon-picker-card-preview-reset",
			],
		});
		renderToolIconPlaceholder(previewEl, "slash");

		buttonEl.addEventListener("click", () => {
			this.close();
			this.onChoose(null);
		});
	}

	private renderIconCard(
		container: HTMLElement,
		iconId: NonNullable<Tool["icon"]>,
	): void {
		const isSelected = this.selectedIcon === iconId;
		const buttonEl = container.createEl("button", {
			attr: {
				"aria-label": iconId,
				title: iconId,
				type: "button",
			},
			cls: [
				"fancify-icon-picker-card",
				"fancify-center-content",
				isSelected ? "is-selected" : "",
			],
		});

		const previewEl = buttonEl.createDiv({
			cls: ["fancify-icon-picker-card-preview", "fancify-center-content"],
		});
		setSafeIcon(previewEl, iconId, "circle");

		buttonEl.addEventListener("click", () => {
			this.close();
			this.onChoose(iconId);
		});
	}
}
