import { AbstractInputSuggest, App } from "obsidian";
import type { StyleToken } from "../../styles/types";

export class PropertyValueSuggest extends AbstractInputSuggest<StyleToken> {
	private readonly getItems: (query: string) => StyleToken[];
	private readonly onChoose: (token: StyleToken) => void;
	private readonly inputEl: HTMLInputElement;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		getItems: (query: string) => StyleToken[],
		onChoose: (token: StyleToken) => void,
	) {
		super(app, inputEl);
		this.getItems = getItems;
		this.onChoose = onChoose;
		this.inputEl = inputEl;
		this.limit = 10;

		this.inputEl.addEventListener("focus", () => {
			if (this.getValue().trim() !== "") {
				return;
			}

			window.setTimeout(() => {
				if (this.getValue().trim() === "") {
					this.close();
				}
			}, 0);
		});

		this.inputEl.addEventListener("input", () => {
			if (this.getValue().trim() === "") {
				this.close();
			}
		});

		this.inputEl.addEventListener("blur", () => {
			this.close();
		});
	}

	getSuggestions(query: string): StyleToken[] {
		const trimmedQuery = query.trim();
		if (trimmedQuery === "") {
			return [];
		}

		return this.getItems(trimmedQuery);
	}

	renderSuggestion(token: StyleToken, el: HTMLElement): void {
		el.addClass("fancify-suggest-item");

		el.createDiv({
			cls: "fancify-suggest-value",
			text: token.value,
		});
	}

	onNoSuggestion(): void {
		this.close();
	}

	selectSuggestion(token: StyleToken): void {
		this.setValue(token.value);
		this.onChoose(token);
		this.close();
	}
}
