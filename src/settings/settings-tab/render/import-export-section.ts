import { ButtonComponent } from "obsidian";
import { showNotice } from "../../../commands/notices";
import type { SettingsTabRenderContext } from "../types";

function getDateStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function downloadTextFile(
	doc: Document,
	fileName: string,
	text: string,
): void {
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const linkEl = doc.createElement("a");

	linkEl.href = url;
	linkEl.download = fileName;
	linkEl.style.display = "none";
	linkEl.rel = "noopener";

	doc.body.appendChild(linkEl);
	linkEl.click();
	linkEl.remove();

	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function createActionButton(
	container: HTMLElement,
	label: string,
	onClick: () => void | Promise<void>,
): void {
	new ButtonComponent(container).setButtonText(label).onClick(async () => {
		try {
			await onClick();
		} catch (error) {
			console.error(`Failed to run Fancify action "${label}".`, error);
			showNotice(`Failed to ${label.toLowerCase()}`);
		}
	});
}

function openImportPicker(
	tab: SettingsTabRenderContext,
	container: HTMLElement,
): void {
	const doc = container.ownerDocument ?? activeDocument;
	const inputEl = doc.createElement("input");

	inputEl.type = "file";
	inputEl.accept = ".json,application/json";
	inputEl.style.display = "none";

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
				} finally {
					inputEl.remove();
				}
			})();
		},
		{ once: true },
	);

	doc.body.appendChild(inputEl);
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

	createActionButton(exportActionsEl, "Export", async () => {
		const text = await tab.controller.createPresetExportText();
		if (!text) {
			return;
		}

		const fileName = `fancify-preset-${getDateStamp()}.json`;
		downloadTextFile(container.ownerDocument ?? activeDocument, fileName, text);
		showNotice("Fancify preset export started");
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
		openImportPicker(tab, container);
	});
}
