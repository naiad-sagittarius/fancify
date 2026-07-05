import type { Validation } from "../../validation";
import type Fancify from "../../main";
import type { SettingsChange } from "../../main";
import { showNotice } from "../../commands/notices";
import { isPropertyStyleType } from "../../styles/properties";
import type { StyleField, StyleType } from "../../styles/types";
import {
	createTool as createToolEntity,
	createVariant as createVariantEntity,
} from "../../tools/factory";
import type { Tool, Variant } from "../../tools/types";
import type { DraftTool, DraftVariant } from "./drafts";
import {
	copyStyleFields,
	createDraftTool,
	createDraftVariant,
} from "./drafts";
import { getAffectedProperties } from "./helpers";
import { locateTool, locateVariant } from "./lookup";
import { buildTokenMap, cleanTokens } from "./tokens";
import type { SettingsViewState } from "./view-state";

interface CommitCurrentPageOptions {
	refreshOnError?: boolean;
	refreshOnSuccess?: boolean;
}

type PageTarget =
	| {
			tool: Tool;
			variants: Variant[];
	  }
	| null;

function addChanges(
	target: Set<SettingsChange>,
	source: Iterable<SettingsChange> | null,
): void {
	if (!source) {
		return;
	}

	for (const change of source) {
		target.add(change);
	}
}

function doTokenMapsMatch(
	left: Partial<Record<string, string>>,
	right: Partial<Record<string, string>>,
): boolean {
	for (const property of getAffectedProperties(left, right)) {
		if (left[property] !== right[property]) {
			return false;
		}
	}

	return true;
}

function createControllerApi(api: {
	toolDraft(tool: Tool): DraftTool;
	variantDraft(tool: Tool, variant: Variant): DraftVariant;
	commitCurrentPage(options?: CommitCurrentPageOptions): Promise<boolean>;
	openMainPage(): Promise<void>;
	openToolPage(toolId: string): Promise<void>;
	openVariantPage(variantId: string): Promise<void>;
	createTool(type: StyleType): Promise<void>;
	duplicateTool(tool: Tool): Promise<void>;
	deleteTool(tool: Tool): Promise<void>;
	moveTool(tool: Tool, targetIndex: number): Promise<void>;
	setToolType(tool: Tool, type: StyleType): void;
	createVariant(tool: Tool): Promise<void>;
	duplicateVariant(variant: Variant): Promise<void>;
	deleteVariant(variant: Variant): Promise<void>;
	moveVariant(variant: Variant, targetIndex: number): Promise<void>;
	addToolProperty(tool: Tool, property: string): void;
	removeToolProperty(tool: Tool, property: string): void;
}) {
	return api;
}

function showListLimitNotice(): void {
	showNotice("You have reached the maximum number of tools/variants");
}

function getNextDuplicateName(
	sourceName: string,
	existingNames: readonly string[],
): string {
	const usedNames = new Set(existingNames);
	let index = 1;

	while (usedNames.has(`${sourceName} ${index}`)) {
		index += 1;
	}

	return `${sourceName} ${index}`;
}

function isListLimitError(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.message === "You have reached the maximum number of tools/variants"
	);
}

function insertAtIndex<T>(items: T[], item: T, targetIndex: number): T[] {
	const currentIndex = items.indexOf(item);
	const nextItems = items.filter((candidate) => candidate !== item);
	const adjustedTargetIndex =
		currentIndex >= 0 && currentIndex < targetIndex
			? targetIndex - 1
			: targetIndex;
	const safeIndex = Math.max(0, Math.min(adjustedTargetIndex, nextItems.length));
	nextItems.splice(safeIndex, 0, item);
	return nextItems;
}

export function createSettingsController(
	plugin: Fancify,
	state: SettingsViewState,
	refreshView: () => void,
) {
	function toolDraft(tool: Tool): DraftTool {
		const existingDraft = state.toolDrafts.get(tool.id);
		if (existingDraft) {
			return existingDraft;
		}

		const draft = createDraftTool(tool);
		state.toolDrafts.set(tool.id, draft);
		return draft;
	}

	function variantDraft(tool: Tool, variant: Variant): DraftVariant {
		const existingDraft = state.variantDrafts.get(variant.id);
		if (existingDraft) {
			return existingDraft;
		}

		const draft = createDraftVariant(
			tool,
			variant,
			plugin.settings.tokens,
		);
		state.variantDrafts.set(variant.id, draft);
		return draft;
	}

	function clearErrors(): void {
		state.pageError = null;
		for (const draft of state.variantDrafts.values()) {
			draft.error = null;
			draft.fieldErrors = {};
		}
	}

	function syncVariantDraftsForTool(tool: Tool): void {
		for (const variant of tool.variants) {
			const currentDraft = state.variantDrafts.get(variant.id);
			const nextDraft = createDraftVariant(
				tool,
				variant,
				plugin.settings.tokens,
			);

			if (currentDraft?.dirty) {
				nextDraft.name = currentDraft.name;
				nextDraft.commandName = currentDraft.commandName;
				nextDraft.icon = currentDraft.icon;
				nextDraft.dirty = true;
				nextDraft.error = currentDraft.error;

				for (const field of tool.styleFields) {
					const draftValue = currentDraft.values[field.property];
					if (typeof draftValue === "string") {
						nextDraft.values[field.property] = draftValue;
					}

					const fieldError = currentDraft.fieldErrors[field.property];
					if (fieldError) {
						nextDraft.fieldErrors[field.property] = fieldError;
					}
				}
			}

			state.variantDrafts.set(variant.id, nextDraft);
		}
	}

	function removeToolState(tool: Tool): void {
		state.toolDrafts.delete(tool.id);

		for (const variant of tool.variants) {
			state.variantDrafts.delete(variant.id);
		}
	}

	function doStyleFieldsMatch(
		left: StyleField[],
		right: StyleField[],
	): boolean {
		if (left.length !== right.length) {
			return false;
		}

		for (let index = 0; index < left.length; index += 1) {
			if (left[index]?.property !== right[index]?.property) {
				return false;
			}
		}

		return true;
	}

	function filterStyleFieldsByType(
		styleFields: StyleField[],
		type: StyleType,
	): StyleField[] {
		return styleFields.filter((field) =>
			isPropertyStyleType(field.property, type),
		);
	}

	function syncToolStyleFields(
		tool: Tool,
		styleFields: StyleField[],
	): void {
		tool.styleFields = copyStyleFields(styleFields);
		syncVariantDraftsForTool(tool);
	}

	async function saveSettingsAndRefresh(
		changes?: Iterable<SettingsChange>,
	): Promise<void> {
		await plugin.saveSettings(changes);
		refreshView();
	}

	function applyToolDraft(tool: Tool): SettingsChange[] | null {
		const draft = toolDraft(tool);
		if (!draft.dirty) {
			return null;
		}

		const changes: SettingsChange[] = [];
		const nextType = draft.type;
		const nextStyleFields = filterStyleFieldsByType(
			draft.styleFields,
			nextType,
		);
		const shouldSyncType = tool.type !== nextType;
		const previousProperties = new Set(
			draft.persistedStyleFields.map((field) => field.property),
		);
		const nextProperties = new Set(
			nextStyleFields.map((field) => field.property),
		);
		const shouldSyncStyleFields = !doStyleFieldsMatch(
			tool.styleFields,
			nextStyleFields,
		);
		const nextIcon = draft.icon ?? undefined;
		const shouldSyncCommands =
			tool.name !== draft.name ||
			tool.icon !== nextIcon ||
			shouldSyncType;

		tool.name = draft.name;
		tool.type = nextType;
		tool.icon = nextIcon;
		if (shouldSyncType || shouldSyncStyleFields) {
			syncToolStyleFields(tool, nextStyleFields);
		}

		for (const variant of tool.variants) {
			for (const property of Object.keys(variant.variantTokens)) {
				if (nextProperties.has(property)) {
					continue;
				}

				delete variant.variantTokens[property];
			}
		}

		const removedProperties = [...previousProperties].filter(
			(property) => !nextProperties.has(property),
		);
		if (removedProperties.length > 0) {
			cleanTokens(plugin.settings, removedProperties);
		}
		if (removedProperties.length > 0 || shouldSyncType) {
			changes.push("tool-style-structure-changed");
		}

		if (shouldSyncCommands) {
			changes.push("command-metadata-changed");
		}

		draft.type = nextType;
		draft.styleFields = copyStyleFields(nextStyleFields);
		draft.persistedStyleFields = copyStyleFields(nextStyleFields);
		draft.dirty = false;
		return changes.length > 0 ? changes : ["data-only"];
	}

	function applyVariantDraft(
		tool: Tool,
		variant: Variant,
	): Validation<SettingsChange[] | null> {
		const draft = variantDraft(tool, variant);
		if (!draft.dirty) {
			return { valid: true, value: null };
		}

		draft.error = null;
		draft.fieldErrors = {};
		const result = buildTokenMap({
			tool,
			tokens: plugin.settings.tokens,
			values: draft.values,
		});
		if (!result.valid) {
			if (result.property) {
				draft.fieldErrors[result.property] = result.message;
			} else {
				draft.error = result.message;
			}
			return {
				valid: false,
				message: result.message,
				property: result.property,
			};
		}

		const affectedProperties = getAffectedProperties(
			variant.variantTokens,
			result.value,
		);
		const commandName = draft.commandName.trim();
		const nextCommandName =
			commandName.length > 0 ? commandName : undefined;
		const nextIcon = draft.icon ?? undefined;
		const shouldSyncCommands =
			variant.name !== draft.name ||
			variant.commandName !== nextCommandName ||
			variant.icon !== nextIcon;
		const shouldSyncStyles = !doTokenMapsMatch(
			variant.variantTokens,
			result.value,
		);

		variant.name = draft.name;
		variant.commandName = nextCommandName;
		variant.icon = nextIcon;
		variant.variantTokens = result.value;
		if (shouldSyncStyles) {
			cleanTokens(plugin.settings, affectedProperties);
		}

		draft.dirty = false;
		draft.fieldErrors = {};
		draft.error = null;

		if (!shouldSyncCommands && !shouldSyncStyles) {
			return { valid: true, value: null };
		}

		const changes: SettingsChange[] = [];
		if (shouldSyncCommands) {
			changes.push("command-metadata-changed");
		}
		if (shouldSyncStyles) {
			changes.push("variant-style-changed");
		}

		return { valid: true, value: changes };
	}

	async function persistToolDrafts(
		tool: Tool,
		variants: Variant[],
		options: CommitCurrentPageOptions = {},
	): Promise<Validation<boolean>> {
		const { refreshOnError = true } = options;
		clearErrors();

		const changes = new Set<SettingsChange>();
		const toolImpact = applyToolDraft(tool);
		let hasChanges = toolImpact !== null;
		addChanges(changes, toolImpact);

		for (const variant of variants) {
			const result = applyVariantDraft(tool, variant);
			if (!result.valid) {
				state.pageError = result.property ? null : result.message;
				if (refreshOnError) {
					refreshView();
				}
				return {
					valid: false,
					message: result.message,
					property: result.property,
				};
			}

			hasChanges ||= result.value !== null;
			addChanges(changes, result.value);
		}

		if (hasChanges) {
			await plugin.saveSettings(changes);
		}

		return { valid: true, value: hasChanges };
	}

	async function commitCurrentPage(
		options: CommitCurrentPageOptions = {},
	): Promise<boolean> {
		const { refreshOnError = true, refreshOnSuccess = false } = options;
		const target = getCurrentPageTarget();
		if (!target) {
			return true;
		}

		const result = await persistToolDrafts(
			target.tool,
			target.variants,
			{ refreshOnError },
		);
		if (!result.valid) {
			return false;
		}

		if (refreshOnSuccess) {
			refreshView();
		}

		return true;
	}

	function getCurrentPageTarget(): PageTarget {
		if (!state.selectedPageId || state.page === "main") {
			return null;
		}

		if (state.page === "tool") {
			const location = locateTool(plugin.settings.tools, state.selectedPageId);
			return location
				? { tool: location.tool, variants: location.tool.variants }
				: null;
		}

		const location = locateVariant(plugin.settings.tools, state.selectedPageId);
		return location
			? { tool: location.tool, variants: [location.variant] }
			: null;
	}

	async function openMainPage(): Promise<void> {
		await openPage("main", null);
	}

	async function openToolPage(toolId: string): Promise<void> {
		if (state.page === "tool" && state.selectedPageId === toolId) {
			return;
		}

		await openPage("tool", toolId);
	}

	async function openVariantPage(variantId: string): Promise<void> {
		if (state.page === "variant" && state.selectedPageId === variantId) {
			return;
		}

		await openPage("variant", variantId);
	}

	async function openPage(
		page: SettingsViewState["page"],
		pageId: string | null,
	): Promise<void> {
		if (
			!(await commitCurrentPage({
				refreshOnError: true,
			}))
		) {
			return;
		}

		if (page === "tool" && (!pageId || !locateTool(plugin.settings.tools, pageId))) {
			return;
		}

		if (
			page === "variant" &&
			(!pageId || !locateVariant(plugin.settings.tools, pageId))
		) {
			return;
		}

		state.page = page;
		state.selectedPageId = pageId;
		state.pageError = null;
		refreshView();
	}

	async function createTool(type: StyleType): Promise<void> {
		clearErrors();

		let tool: Tool;
		try {
			tool = createToolEntity(
				plugin.settings.tools,
				"New tool",
				type,
				[],
			);
		} catch (error) {
			if (isListLimitError(error)) {
				showListLimitNotice();
				return;
			}
			throw error;
		}
		toolDraft(tool);
		await plugin.saveSettings(["data-only"]);

		state.page = "tool";
		state.selectedPageId = tool.id;
		state.pageError = null;
		refreshView();
	}

	async function duplicateTool(tool: Tool): Promise<void> {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		if (!(await commitCurrentPage({ refreshOnError: true }))) {
			return;
		}

		clearErrors();
		let duplicate: Tool | null = null;
		try {
			duplicate = createToolEntity(
				plugin.settings.tools,
				getNextDuplicateName(
					location.tool.name,
					plugin.settings.tools.map((candidate) => candidate.name),
				),
				location.tool.type,
				copyStyleFields(location.tool.styleFields),
				location.tool.icon,
			);

			for (const variant of location.tool.variants) {
				createVariantEntity(
					duplicate,
					variant.name,
					variant.variantTokens,
					variant.icon,
				).commandName = variant.commandName;
			}
		} catch (error) {
			if (isListLimitError(error)) {
				plugin.settings.tools = plugin.settings.tools.filter(
					(candidate) => candidate.id !== duplicate?.id,
				);
				showListLimitNotice();
				return;
			}
			throw error;
		}
		if (!duplicate) {
			return;
		}

		toolDraft(duplicate);
		for (const variant of duplicate.variants) {
			variantDraft(duplicate, variant);
		}

		state.page = "tool";
		state.selectedPageId = duplicate.id;
		state.pageError = null;
		await saveSettingsAndRefresh(["variant-created"]);
	}

	async function deleteTool(tool: Tool): Promise<void> {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		plugin.settings.tools = plugin.settings.tools.filter(
			(candidate) => candidate.id !== tool.id,
		);
		cleanTokens(plugin.settings);
		removeToolState(tool);

		if (state.page === "tool" && state.selectedPageId === tool.id) {
			state.page = "main";
			state.selectedPageId = null;
		}

		if (
			state.page === "variant" &&
			state.selectedPageId !== null &&
			tool.variants.some(
				(variant) => variant.id === state.selectedPageId,
			)
		) {
			state.page = "main";
			state.selectedPageId = null;
		}

		await saveSettingsAndRefresh(["tool-deleted"]);
	}

	async function moveTool(tool: Tool, targetIndex: number): Promise<void> {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		if (!(await commitCurrentPage({ refreshOnError: true }))) {
			return;
		}

		const currentIndex = plugin.settings.tools.indexOf(location.tool);
		if (currentIndex < 0 || currentIndex === targetIndex) {
			return;
		}

		plugin.settings.tools = insertAtIndex(
			plugin.settings.tools,
			location.tool,
			targetIndex,
		);
		await saveSettingsAndRefresh(["list-order-changed"]);
	}

	function setToolType(tool: Tool, type: StyleType): void {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		const draft = toolDraft(location.tool);
		if (draft.type === type) {
			return;
		}

		draft.type = type;
		draft.styleFields = filterStyleFieldsByType(draft.styleFields, type);
		draft.propertyMenuOpen = false;
		draft.propertySearch = "";
		draft.dirty = true;
		refreshView();
	}

	async function createVariant(tool: Tool): Promise<void> {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		clearErrors();
		const changes = new Set<SettingsChange>(["variant-created"]);
		addChanges(changes, applyToolDraft(location.tool));

		let variant: Variant;
		try {
			variant = createVariantEntity(
				location.tool,
				"New variant",
				{},
			);
		} catch (error) {
			if (isListLimitError(error)) {
				showListLimitNotice();
				return;
			}
			throw error;
		}
		variantDraft(location.tool, variant);
		state.page = "variant";
		state.selectedPageId = variant.id;
		state.pageError = null;
		await saveSettingsAndRefresh(changes);
	}

	async function duplicateVariant(variant: Variant): Promise<void> {
		const location = locateVariant(plugin.settings.tools, variant.id);
		if (!location) {
			return;
		}

		if (!(await commitCurrentPage({ refreshOnError: true }))) {
			return;
		}

		clearErrors();
		let duplicate: Variant;
		try {
			duplicate = createVariantEntity(
				location.tool,
				getNextDuplicateName(
					location.variant.name,
					location.tool.variants.map((candidate) => candidate.name),
				),
				location.variant.variantTokens,
				location.variant.icon,
			);
			duplicate.commandName = location.variant.commandName;
		} catch (error) {
			if (isListLimitError(error)) {
				showListLimitNotice();
				return;
			}
			throw error;
		}

		variantDraft(location.tool, duplicate);
		state.page = "variant";
		state.selectedPageId = duplicate.id;
		state.pageError = null;
		await saveSettingsAndRefresh(["variant-created"]);
	}

	async function deleteVariant(variant: Variant): Promise<void> {
		const location = locateVariant(plugin.settings.tools, variant.id);
		if (!location) {
			return;
		}

		location.tool.variants = location.tool.variants.filter(
			(candidate) => candidate.id !== variant.id,
		);
		cleanTokens(plugin.settings);
		state.variantDrafts.delete(variant.id);

		if (state.page === "variant" && state.selectedPageId === variant.id) {
			state.page = "tool";
			state.selectedPageId = location.tool.id;
		}

		await saveSettingsAndRefresh(["variant-deleted"]);
	}

	async function moveVariant(
		variant: Variant,
		targetIndex: number,
	): Promise<void> {
		const location = locateVariant(plugin.settings.tools, variant.id);
		if (!location) {
			return;
		}

		if (!(await commitCurrentPage({ refreshOnError: true }))) {
			return;
		}

		const currentIndex = location.tool.variants.indexOf(location.variant);
		if (currentIndex < 0 || currentIndex === targetIndex) {
			return;
		}

		location.tool.variants = insertAtIndex(
			location.tool.variants,
			location.variant,
			targetIndex,
		);
		await saveSettingsAndRefresh(["list-order-changed"]);
	}

	function addToolProperty(tool: Tool, property: string): void {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		const draft = toolDraft(location.tool);
		if (!isPropertyStyleType(property, draft.type)) {
			return;
		}

		if (draft.styleFields.some((field) => field.property === property)) {
			return;
		}

		draft.styleFields = [...draft.styleFields, { property }];
		draft.propertySearch = "";
		draft.dirty = true;
		refreshView();
	}

	function removeToolProperty(
		tool: Tool,
		property: string,
	): void {
		const location = locateTool(plugin.settings.tools, tool.id);
		if (!location) {
			return;
		}

		const draft = toolDraft(location.tool);
		const nextStyleFields = draft.styleFields.filter(
			(field) => field.property !== property,
		);
		if (nextStyleFields.length === draft.styleFields.length) {
			return;
		}

		draft.styleFields = nextStyleFields;
		draft.dirty = true;
		refreshView();
	}

	return createControllerApi({
		toolDraft,
		variantDraft,
		commitCurrentPage,
		openMainPage,
		openToolPage,
		openVariantPage,
		createTool,
		duplicateTool,
		deleteTool,
		moveTool,
		setToolType,
		createVariant,
		duplicateVariant,
		deleteVariant,
		moveVariant,
		addToolProperty,
		removeToolProperty,
	});
}

export type SettingsTabController = ReturnType<typeof createControllerApi>;
