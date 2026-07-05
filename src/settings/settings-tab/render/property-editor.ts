import { TextComponent } from "obsidian";
import {
	getStyleProperty,
	getStylePropertyLabel,
} from "../../../styles/properties";
import type { Property } from "../../../styles/types";
import { setSafeIcon } from "../../../tools/icon-rendering";
import type { Tool } from "../../../tools/types";
import type { DraftTool } from "../drafts";
import { getAvailableProperties } from "../helpers";
import type { SettingsTabRenderContext } from "../types";
import { renderIconButton } from "./fields";

export function renderPropertyEditor(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
	tool: Tool,
	draft: DraftTool,
): void {
	const wrapperEl = container.createDiv({
		cls: ["fancify-field-block", "fancify-property-editor"],
	});
	const availablePropertyIds = getAvailableProperties(
		draft.styleFields,
		draft.type,
	);

	if (availablePropertyIds.length > 0) {
		renderPropertySearch(
			tab,
			wrapperEl,
			tool,
			draft,
			availablePropertyIds,
		);
	} else {
		draft.propertyMenuOpen = false;
		draft.propertySearch = "";
	}

	if (draft.styleFields.length === 0) {
		return;
	}

	const chipsEl = wrapperEl.createDiv("fancify-chip-list");
	for (const field of draft.styleFields) {
		const label = getStylePropertyLabel(field.property);
		const chipEl = chipsEl.createDiv("fancify-chip");
		chipEl.createSpan({
			cls: "fancify-chip-label",
			text: label,
		});
		renderIconButton(
			chipEl,
			`Remove ${label}`,
			"trash",
			() => {
				tab.controller.removeToolProperty(tool, field.property);
			},
			true,
		);
	}
}

function renderPropertySearch(
	tab: SettingsTabRenderContext,
	wrapperEl: HTMLElement,
	tool: Tool,
	draft: DraftTool,
	availablePropertyIds: string[],
): void {
	const pickerEl = wrapperEl.createDiv("fancify-picker");
	const searchEl = pickerEl.createDiv({
		cls: ["fancify-picker-search", "fancify-property-search"],
	});
	const searchComponent = new TextComponent(searchEl);
	const searchIconEl = searchEl.createSpan({
		attr: { "aria-hidden": "true" },
		cls: ["fancify-property-search-icon", "fancify-center-content"],
	});
	setSafeIcon(searchIconEl, "plus", "circle-plus");
	searchComponent.setPlaceholder("Add properties");
	if (!draft.propertyMenuOpen) {
		draft.propertySearch = "";
	}
	searchComponent.setValue(draft.propertySearch);
	const menuEl = pickerEl.createDiv("fancify-property-menu");
	menuEl.addClass("is-hidden");
	let isMenuOpen = false;
	let menuAbortController: AbortController | null = null;

	const getMatchingProperties = (query: string): Property[] => {
		const normalizedQuery = query.trim().toLowerCase();
		return availablePropertyIds
			.map((propertyId) => getStyleProperty(propertyId))
			.filter((property) => {
				const label = property.label ?? property.property;
				if (!normalizedQuery) {
					return true;
				}

				return (
					label.toLowerCase().includes(normalizedQuery) ||
					property.property.toLowerCase().includes(normalizedQuery) ||
					property.description.toLowerCase().includes(normalizedQuery)
				);
			});
	};

	let highlightedIndex = 0;

	const chooseProperty = (property: Property): void => {
		tab.controller.addToolProperty(tool, property.property);
	};

	const syncHighlightedItem = (): void => {
		for (const [index, child] of Array.from(menuEl.children).entries()) {
			child.classList.toggle("is-active", index === highlightedIndex);
		}
	};

	const renderMenu = (): void => {
		const matchingProperties = getMatchingProperties(draft.propertySearch);
		menuEl.empty();

		if (matchingProperties.length === 0) {
			const emptyMessage =
				draft.propertySearch.trim() === ""
					? "All properties have already been added"
					: "No matching properties";
			menuEl.createDiv({
				cls: "fancify-property-menu-empty",
				text: emptyMessage,
			});
			return;
		}

		highlightedIndex = Math.max(
			0,
			Math.min(highlightedIndex, matchingProperties.length - 1),
		);

		for (const [index, property] of matchingProperties.entries()) {
			const label = property.label ?? property.property;
			const itemEl = menuEl.createDiv({
				cls: [
					"fancify-property-menu-item",
					index === highlightedIndex ? "is-active" : "",
				],
			});
			itemEl.createDiv({
				cls: "fancify-suggest-value",
				text: label,
			});
			itemEl.createDiv({
				cls: "fancify-suggest-meta",
				text: property.description,
			});

			itemEl.addEventListener("mouseenter", () => {
				if (highlightedIndex === index) {
					return;
				}

				highlightedIndex = index;
				syncHighlightedItem();
			});
			itemEl.addEventListener("click", () => {
				chooseProperty(property);
			});
		}
	};

	const fitMenuToViewport = (): void => {
		const pickerRect = pickerEl.getBoundingClientRect();
		const viewportPadding = 12;
		const viewport = window.visualViewport;
		const viewportTop = viewport?.offsetTop ?? 0;
		const viewportBottom = viewport
			? viewport.offsetTop + viewport.height
			: window.innerHeight;
		const availableBelow = Math.max(
			0,
			viewportBottom - pickerRect.bottom - viewportPadding,
		);
		const availableAbove = Math.max(
			0,
			pickerRect.top - viewportTop - viewportPadding,
		);
		const shouldOpenAbove =
			availableBelow < 160 && availableAbove > availableBelow;
		const availableHeight = shouldOpenAbove
			? availableAbove
			: availableBelow;

		menuEl.toggleClass("is-above", shouldOpenAbove);
		menuEl.style.maxHeight = `${Math.min(280, availableHeight)}px`;
	};

	const closeMenu = (): void => {
		setMenuOpen(false);
		draft.propertySearch = "";
		searchComponent.setValue("");
		highlightedIndex = 0;
	};

	const registerMenuListeners = (): void => {
		if (menuAbortController) {
			return;
		}

		menuAbortController = new AbortController();
		const { signal } = menuAbortController;
		document.addEventListener(
			"pointerdown",
			(event) => {
				const target = event.target;
				if (!(target instanceof Node)) {
					return;
				}

				if (pickerEl.contains(target)) {
					return;
				}

				closeMenu();
			},
			{ capture: true, signal },
		);
		window.addEventListener("resize", fitMenuToViewport, { signal });
		window.addEventListener("scroll", fitMenuToViewport, {
			capture: true,
			signal,
		});
		window.visualViewport?.addEventListener("resize", fitMenuToViewport, {
			signal,
		});
		window.visualViewport?.addEventListener("scroll", fitMenuToViewport, {
			signal,
		});
	};

	const unregisterMenuListeners = (): void => {
		menuAbortController?.abort();
		menuAbortController = null;
	};

	const setMenuOpen = (
		isOpen: boolean,
		options: { persistState?: boolean } = {},
	): void => {
		const { persistState = true } = options;
		isMenuOpen = isOpen;
		if (persistState) {
			draft.propertyMenuOpen = isOpen;
		}
		menuEl.toggleClass("is-hidden", !isMenuOpen);
		if (isMenuOpen) {
			renderMenu();
			fitMenuToViewport();
			registerMenuListeners();
			return;
		}

		unregisterMenuListeners();
	};

	searchComponent.onChange((value) => {
		draft.propertySearch = value;
		highlightedIndex = 0;
		if (isMenuOpen) {
			renderMenu();
			fitMenuToViewport();
		}
	});

	searchComponent.inputEl.addEventListener("focus", () => {
		if (!isMenuOpen && draft.propertySearch !== "") {
			draft.propertySearch = "";
			searchComponent.setValue("");
			highlightedIndex = 0;
		}
		setMenuOpen(true);
	});

	searchComponent.inputEl.addEventListener("keydown", (event) => {
		const matchingProperties = getMatchingProperties(draft.propertySearch);

		if (event.key === "ArrowDown") {
			if (matchingProperties.length === 0) {
				return;
			}

			event.preventDefault();
			highlightedIndex = Math.min(
				highlightedIndex + 1,
				matchingProperties.length - 1,
			);
			renderMenu();
			return;
		}

		if (event.key === "ArrowUp") {
			if (matchingProperties.length === 0) {
				return;
			}

			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			renderMenu();
			return;
		}

		if (event.key === "Enter") {
			const property = matchingProperties[highlightedIndex];
			if (!property) {
				return;
			}

			event.preventDefault();
			chooseProperty(property);
			return;
		}

		if (event.key !== "Escape") {
			return;
		}

		event.preventDefault();
		if (draft.propertySearch.trim() !== "") {
			draft.propertySearch = "";
			searchComponent.setValue("");
			highlightedIndex = 0;
			if (isMenuOpen) {
				renderMenu();
			}
		}

		setMenuOpen(false);
	});

	tab.activeSuggests.push({
		close: () => {
			setMenuOpen(false, { persistState: false });
		},
	});
	setMenuOpen(draft.propertyMenuOpen);
}
