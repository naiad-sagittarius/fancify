import { ButtonComponent } from "obsidian";
import { showNotice } from "../../../commands/notices";
import type { SettingsTabRenderContext } from "../types";

function getDateStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function downloadTextFile(fileName: string, text: string): void {
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const linkEl = activeDocument.createEl("a");

	linkEl.href = url;
	linkEl.download = fileName;

	activeDocument.body.appendChild(linkEl);
	linkEl.click();
	linkEl.remove();

	activeWindow.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createActionButton(
	container: HTMLElement,
	label: string,
	onClick: () => void | Promise<void>,
): void {
	new ButtonComponent(container).setButtonText(label).onClick(() => {
		void onClick();
	});
}

function openImportPicker(tab: SettingsTabRenderContext): void {
	const inputEl = activeDocument.createEl("input", {
		attr: {
			type: "file",
			accept: ".json,application/json",
		},
	});

	inputEl.addEventListener(
		"change",
		() => {
			void (async () => {
				const file = inputEl.files?.[0];
				if (!file) {
					return;
				}

				try {
					await tab.controller.importExportText(await file.text());
				} catch (error) {
					console.error("Failed to import Fancify export.", error);
					showNotice("Failed to import Fancify export");
				}
			})();
		},
		{ once: true },
	);

	inputEl.click();
}

export function renderImportExportSection(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
): void {
	const panelEl = container.createDiv("fancify-import-export-panel");

	const exportRowEl = panelEl.createDiv("fancify-import-export-row");
	exportRowEl.createDiv({
		cls: "fancify-import-export-title",
		text: "Export",
	});

	const exportActionsEl = exportRowEl.createDiv(
		"fancify-import-export-actions",
	);

	createActionButton(exportActionsEl, "Export preset", async () => {
		const text = await tab.controller.createPresetExportText();
		if (!text) {
			return;
		}

		downloadTextFile(`fancify-preset-${getDateStamp()}.json`, text);
	});

	createActionButton(exportActionsEl, "Export backup", async () => {
		const text = await tab.controller.createBackupExportText();
		if (!text) {
			return;
		}

		downloadTextFile(`fancify-backup-${getDateStamp()}.json`, text);
	});

	const importRowEl = panelEl.createDiv("fancify-import-export-row");
	importRowEl.createDiv({
		cls: "fancify-import-export-title",
		text: "Import",
	});

	const importActionsEl = importRowEl.createDiv(
		"fancify-import-export-actions",
	);

	createActionButton(importActionsEl, "Import", () => {
		openImportPicker(tab);
	});
}
