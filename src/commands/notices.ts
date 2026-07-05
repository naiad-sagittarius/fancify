import { Notice } from "obsidian";

export function showNotice(message: string): void {
	if (typeof Notice === "function") {
		new Notice(message);
	}
}
