import { Plugin } from "obsidian";
import type { Extension } from "@codemirror/state";

import { createFancifyViewPlugin } from "./editor/decorations/view-plugin";
import { createMobileParagraphSelectionExtension } from "./editor/mobile-paragraph-selection";
import {
	clearTagPrefixLookup,
	rebuildTagPrefixLookup,
} from "./editor/decorations/tag-scanner";

import {
	applyStyleTokens,
	clearStyleTokens,
} from "./styles/dom";
import { registerDynamicCommands } from "./commands/register-dynamic-commands";
import { registerStaticCommands } from "./commands/register-static-commands";
import {
	registerFancifyMarkdownPostProcessor,
	rerenderMarkdownPreviews,
} from "./preview/post-processor";

import {
	createDefaultSettings,
	type FancifySettings,
} from "./settings/settings";
import { FancifySettingTab } from "./settings/settings-tab/settings-tab";
import {
	allRuntimeSyncOptions,
	createRuntimeSyncOptions,
	type RuntimeSyncOptions,
	type SettingsChange,
} from "./runtime-sync";

export type { SettingsChange } from "./runtime-sync";

export default class Fancify extends Plugin {
	settings!: FancifySettings;
	private dynamicCommandIds = new Set<string>();
	private readonly editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		this.rebuildRegistry();
		this.rebuildEditorExtensions();

		this.addSettingTab(new FancifySettingTab(this.app, this));
		this.applyTokens();
		registerFancifyMarkdownPostProcessor(this);
		this.registerEditorExtension(this.editorExtensions);

		registerStaticCommands(this);
		this.syncDynamicCommands();
		this.refreshMarkdownPreviews();
	}

	async loadSettings() {
		this.settings =
			((await this.loadData()) as FancifySettings | null) ??
			createDefaultSettings();
	}

	async saveSettings(changes?: Iterable<SettingsChange>) {
		await this.saveData(this.settings);
		await this.syncRuntime(
			changes
				? createRuntimeSyncOptions(changes)
				: allRuntimeSyncOptions,
		);
	}

	private async syncRuntime(options: RuntimeSyncOptions) {
		if (options.tokens) {
			this.applyTokens();
		}

		if (options.registry) {
			this.rebuildRegistry();
		}

		if (options.editor) {
			this.refreshEditorExtensions();
		}

		if (options.commands) {
			this.syncDynamicCommands();
		}

		if (options.previews) {
			this.refreshMarkdownPreviews();
		}
	}

	private rebuildRegistry() {
		rebuildTagPrefixLookup(this.settings.tools);
	}

	private syncDynamicCommands() {
		for (const commandId of this.dynamicCommandIds) {
			this.removeCommand(commandId);
		}

		this.dynamicCommandIds = new Set(
			registerDynamicCommands(this, this.settings),
		);
	}

	private applyTokens() {
		applyStyleTokens(document.documentElement, this.settings.tokens);
	}

	private rebuildEditorExtensions() {
		this.editorExtensions.splice(
			0,
			this.editorExtensions.length,
			createFancifyViewPlugin(),
			createMobileParagraphSelectionExtension(),
		);
	}

	private refreshEditorExtensions() {
		this.rebuildEditorExtensions();
		this.app.workspace.updateOptions();
	}

	private refreshMarkdownPreviews() {
		rerenderMarkdownPreviews(this);
	}

	onunload() {
		clearTagPrefixLookup();
		clearStyleTokens(document.documentElement);
	}
}
