import type Fancify from "../main";
import { getAvailableIconName } from "../tools/icon-rendering";
import {
	hasHorizontalLines,
	removeNextHorizontalLine,
} from "./remove-horizontal-line";
import {
	getRemovableVariantsForSelection,
	removeSelectedTagPairs,
	removeVariantStylesFromSelection,
} from "./remove-tags";
import { removeStyleFromSelectionWithPrompt } from "./remove-style-prompt";

export function registerStaticCommands(plugin: Fancify): void {
	registerTagRemovalCommand(plugin);
	registerStyleRemovalPromptCommand(plugin);
	registerHorizontalLineRemovalCommand(plugin);
	registerTagRemovalMenu(plugin);
}

function registerTagRemovalCommand(plugin: Fancify): void {
	plugin.addCommand({
		id: "remove-selected-tag-pairs",
		name: "Remove all styles",
		icon: "tag",
		editorCheckCallback: (checking, editor) => {
			const hasSelection = editor.somethingSelected();
			if (!checking && hasSelection) {
				removeSelectedTagPairs(editor);
			}

			return hasSelection;
		},
	});
}

function registerStyleRemovalPromptCommand(plugin: Fancify): void {
	plugin.addCommand({
		id: "remove-selected-style",
		name: "Remove selected style...",
		icon: "tag",
		editorCheckCallback: (checking, editor) => {
			const hasSelection = editor.somethingSelected();
			if (!checking && hasSelection) {
				removeStyleFromSelectionWithPrompt(
					plugin.app,
					editor,
					plugin.settings.tools,
				);
			}

			return hasSelection;
		},
	});
}

function registerHorizontalLineRemovalCommand(plugin: Fancify): void {
	plugin.addCommand({
		id: "remove-next-horizontal-line",
		name: "Remove next horizontal line",
		icon: "minus",
		editorCheckCallback: (checking, editor) => {
			const canRemove = hasHorizontalLines(editor);
			if (!checking && canRemove) {
				removeNextHorizontalLine(editor);
			}

			return canRemove;
		},
	});
}

function registerTagRemovalMenu(plugin: Fancify): void {
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, editor) => {
			if (!editor.somethingSelected()) {
				return;
			}

			const removableVariants = getRemovableVariantsForSelection(
				editor,
				plugin.settings.tools,
			);
			if (removableVariants.length === 0) {
				return;
			}

			menu.addSeparator();
			menu.addItem((item) => {
				const icon = getAvailableIconName("tag");
				item
					.setTitle("Remove all styles")
					.setIcon(icon)
					.setSection("fancify-remove-tags")
					.onClick(() => {
						removeSelectedTagPairs(editor);
					});
			});

			for (const removableVariant of removableVariants) {
				menu.addItem((item) => {
					const icon = getAvailableIconName(
						removableVariant.icon ?? "tag",
						"tag",
					);
					item
						.setTitle(`Remove ${removableVariant.menuTitle}`)
						.setIcon(icon)
						.setSection("fancify-remove-tags")
						.onClick(() => {
							removeVariantStylesFromSelection(editor, removableVariant);
						});
				});
			}
		}),
	);
}
