import { App, PluginSettingTab, activeDocument } from "obsidian";
import Fancify from "../../main";
import {
	createSettingsController,
	type SettingsTabController,
} from "./controller";
import { locateTool, locateVariant } from "./lookup";
import { renderToolDetailPage } from "./render/tool-section";
import { renderPageError, renderMainPage } from "./render/pages";
import { renderVariantDetailPage } from "./render/variant-section";
import { createSettingsViewState, type SettingsViewState } from "./view-state";
import type { SettingsTabRenderContext } from "./types";

export class FancifySettingTab
	extends PluginSettingTab
	implements SettingsTabRenderContext
{
	plugin: Fancify;
	readonly state: SettingsViewState = createSettingsViewState();
	activeSuggests: SettingsTabRenderContext["activeSuggests"] = [];
	readonly controller: SettingsTabController;
	private settingsChromeSurfaceEl: HTMLElement | null = null;
	private settingsTitleVersionEl: HTMLElement | null = null;
	private outsideAutosaveAbortController: AbortController | null = null;
	private pendingCommit: Promise<void> | null = null;

	constructor(app: App, plugin: Fancify) {
		super(app, plugin);
		this.plugin = plugin;
		this.controller = createSettingsController(plugin, this.state, () =>
			this.display(),
		);
	}

	hide(): void {
		this.unregisterOutsideAutosave();
		this.closeActiveSuggests();
		this.clearSettingsChrome();
		void this.commitPendingChanges("close");
		super.hide();
	}

	display(): void {
		const { containerEl } = this;
		const { tools } = this.plugin.settings;
		this.closeActiveSuggests();
		containerEl.empty();
		containerEl.addClass("fancify-settings");
		this.syncSettingsChrome();
		this.registerOutsideAutosave();

		let selectedToolLocation =
			this.state.page === "tool" && this.state.selectedPageId
				? locateTool(tools, this.state.selectedPageId)
				: undefined;
		let selectedVariantLocation =
			this.state.page === "variant" && this.state.selectedPageId
				? locateVariant(tools, this.state.selectedPageId)
				: undefined;

		if (this.state.page === "tool") {
			if (!selectedToolLocation) {
				this.state.page = "main";
				this.state.selectedPageId = null;
			}
		}

		if (this.state.page === "variant") {
			if (!selectedVariantLocation) {
				this.state.page = "main";
				this.state.selectedPageId = null;
			}
		}

		const pageEl = containerEl.createDiv("fancify-page");
		renderPageError(pageEl, this.state.pageError);

		if (this.state.page === "variant" && selectedVariantLocation) {
			renderVariantDetailPage(
				this,
				pageEl,
				selectedVariantLocation.tool,
				selectedVariantLocation.variant,
			);
			return;
		}

		if (this.state.page === "tool" && selectedToolLocation) {
			renderToolDetailPage(this, pageEl, selectedToolLocation.tool);
			return;
		}

		renderMainPage(this, pageEl);
	}

	private closeActiveSuggests(): void {
		for (const suggest of this.activeSuggests) {
			suggest.close();
		}

		this.activeSuggests = [];
	}

	private registerOutsideAutosave(): void {
		this.unregisterOutsideAutosave();
		const doc = this.containerEl.ownerDocument ?? activeDocument;
		this.outsideAutosaveAbortController = new AbortController();

		doc.addEventListener(
			"pointerdown",
			(event) => {
				if (this.shouldIgnoreOutsideAutosave(event.target)) {
					return;
				}

				void this.commitPendingChanges("outside click");
			},
			{
				capture: true,
				signal: this.outsideAutosaveAbortController.signal,
			},
		);
	}

	private unregisterOutsideAutosave(): void {
		this.outsideAutosaveAbortController?.abort();
		this.outsideAutosaveAbortController = null;
	}

	private syncSettingsChrome(): void {
		const surfaceEl = this.getSettingsSurfaceEl();
		if (
			this.settingsChromeSurfaceEl &&
			this.settingsChromeSurfaceEl !== surfaceEl
		) {
			this.settingsTitleVersionEl?.remove();
			this.settingsTitleVersionEl = null;
			this.settingsChromeSurfaceEl.removeClass("fancify-settings-host");
		}

		this.settingsChromeSurfaceEl = surfaceEl;
		surfaceEl.addClass("fancify-settings-host");

		const titleEl = surfaceEl.querySelector<HTMLElement>(".modal-title");
		if (!titleEl) {
			this.settingsTitleVersionEl?.remove();
			this.settingsTitleVersionEl = null;
			return;
		}

		titleEl
			.querySelectorAll(".fancify-mobile-title-version")
			.forEach((versionEl) => {
				versionEl.remove();
			});

		this.settingsTitleVersionEl = titleEl.createSpan({
			cls: "fancify-mobile-title-version",
			text: `Version ${this.plugin.manifest.version}`,
		});
	}

	private clearSettingsChrome(): void {
		this.settingsTitleVersionEl?.remove();
		this.settingsTitleVersionEl = null;

		this.settingsChromeSurfaceEl?.removeClass("fancify-settings-host");
		this.settingsChromeSurfaceEl = null;
	}

	private shouldIgnoreOutsideAutosave(target: EventTarget | null): boolean {
		if (!(target instanceof Node)) {
			return false;
		}

		const settingsSurfaceEl = this.getSettingsSurfaceEl();
		if (settingsSurfaceEl.contains(target)) {
			return true;
		}

		const targetEl = target.instanceOf(Element)
			? target
			: target.parentElement;
		if (!targetEl) {
			return false;
		}

		return Boolean(
			targetEl.closest(
				[
					".fancify-custom-color-popover",
					".fancify-tool-type-modal",
					".fancify-icon-picker-modal",
					".suggestion-container",
					".menu",
					".modal",
				].join(","),
			),
		);
	}

	private getSettingsSurfaceEl(): HTMLElement {
		return (
			this.containerEl.closest<HTMLElement>(".modal") ??
			this.containerEl.closest<HTMLElement>(".workspace-leaf") ??
			this.containerEl
		);
	}

	private commitPendingChanges(reason: string): Promise<void> {
		if (this.pendingCommit) {
			return this.pendingCommit;
		}

		const commit = (async () => {
			try {
				await this.controller.commitCurrentPage({
					refreshOnError: false,
				});
			} catch (error) {
				console.error(
					`Failed to save Fancify settings on ${reason}.`,
					error,
				);
			}
		})();

		this.pendingCommit = commit;
		void commit.finally(() => {
			if (this.pendingCommit === commit) {
				this.pendingCommit = null;
			}
		});

		return commit;
	}
}
