import type { App } from "obsidian";
import type Fancify from "../../main";
import type { SettingsTabController } from "./controller";
import type { SettingsViewState } from "./view-state";

export interface SettingsTabRenderContext {
	app: App;
	plugin: Fancify;
	state: SettingsViewState;
	controller: SettingsTabController;
	activeSuggests: Array<{ close(): void }>;
}
