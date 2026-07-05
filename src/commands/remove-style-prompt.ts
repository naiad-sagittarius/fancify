import {
	App,
	Notice,
	SuggestModal,
	type Editor,
} from "obsidian";
import type { Tool } from "../tools/types";
import { setSafeIcon } from "../tools/icon-rendering";
import {
	getRemovableVariantsForSelection,
	removeSelectedTagPairs,
	removeVariantStylesFromSelection,
	type RemovableVariantStyle,
} from "./remove-tags";

type RemovalChoice =
	| {
			readonly icon: string;
			readonly title: string;
			readonly type: "all";
	  }
	| {
			readonly icon: string;
			readonly title: string;
			readonly type: "variant";
			readonly variant: RemovableVariantStyle;
	  };

export function removeStyleFromSelectionWithPrompt(
	app: App,
	editor: Editor,
	tools: readonly Tool[],
): boolean {
	const removableVariants = getRemovableVariantsForSelection(editor, tools);
	if (removableVariants.length === 0) {
		new Notice("Fancify: no style found in the current selection.");
		return false;
	}

	if (removableVariants.length === 1) {
		const [variant] = removableVariants;
		if (!variant) {
			return false;
		}

		return removeVariantStylesFromSelection(editor, variant) === "removed";
	}

	new RemoveStyleModal(app, editor, removableVariants).open();
	return true;
}

class RemoveStyleModal extends SuggestModal<RemovalChoice> {
	private readonly choices: RemovalChoice[];
	private readonly editor: Editor;

	constructor(
		app: App,
		editor: Editor,
		removableVariants: readonly RemovableVariantStyle[],
	) {
		super(app);
		this.editor = editor;
		this.choices = [
			{
				icon: "tag",
				title: "All styles",
				type: "all",
			},
			...removableVariants.map((variant) => ({
				icon: variant.icon ?? "tag",
				title: variant.menuTitle,
				type: "variant" as const,
				variant,
			})),
		];
		this.setPlaceholder("Remove style");
		this.emptyStateText = "No matching style";
	}

	getSuggestions(query: string): RemovalChoice[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return this.choices;
		}

		return this.choices.filter((choice) =>
			choice.title.toLowerCase().includes(normalizedQuery),
		);
	}

	renderSuggestion(choice: RemovalChoice, el: HTMLElement): void {
		const rowEl = el.createDiv("fancify-remove-style-choice");
		const iconEl = rowEl.createSpan({
			cls: ["fancify-remove-style-choice-icon", "fancify-center-content"],
			attr: { "aria-hidden": "true" },
		});
		setSafeIcon(iconEl, choice.icon, "tag");
		rowEl.createSpan({
			cls: "fancify-remove-style-choice-label",
			text: choice.title,
		});
	}

	onChooseSuggestion(choice: RemovalChoice): void {
		if (choice.type === "all") {
			removeSelectedTagPairs(this.editor);
			return;
		}

		const result = removeVariantStylesFromSelection(this.editor, choice.variant);
		if (result === "failed") {
			new Notice(`Fancify: could not remove "${choice.variant.variantName}".`);
		}
	}
}
