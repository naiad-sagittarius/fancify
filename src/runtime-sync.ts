export type SettingsChange =
	| "settings-replaced"
	| "data-only"
	| "command-metadata-changed"
	| "variant-style-changed"
	| "tool-style-structure-changed"
	| "variant-created"
	| "variant-deleted"
	| "tool-deleted"
	| "list-order-changed";

export interface RuntimeSyncOptions {
	tokens: boolean;
	registry: boolean;
	editor: boolean;
	commands: boolean;
	previews: boolean;
}

export const allRuntimeSyncOptions: RuntimeSyncOptions = {
	tokens: true,
	registry: true,
	editor: true,
	commands: true,
	previews: true,
};

const runtimeSyncByChange = new Map<SettingsChange, Partial<RuntimeSyncOptions>>([
	["settings-replaced", allRuntimeSyncOptions],
	["data-only", {}],
	["command-metadata-changed", { commands: true }],
	[
		"variant-style-changed",
		{ tokens: true, registry: true, editor: true, previews: true },
	],
	[
		"tool-style-structure-changed",
		{ tokens: true, registry: true, editor: true, previews: true },
	],
	[
		"variant-created",
		{ registry: true, editor: true, commands: true, previews: true },
	],
	[
		"variant-deleted",
		{ tokens: true, registry: true, editor: true, commands: true, previews: true },
	],
	[
		"tool-deleted",
		{ tokens: true, registry: true, editor: true, commands: true, previews: true },
	],
	["list-order-changed", { commands: true }],
]);

export function createRuntimeSyncOptions(
	changes: Iterable<SettingsChange>,
): RuntimeSyncOptions {
	const options: RuntimeSyncOptions = {
		tokens: false,
		registry: false,
		editor: false,
		commands: false,
		previews: false,
	};

	for (const change of changes) {
		const impact = runtimeSyncByChange.get(change) ?? {};
		options.tokens ||= impact.tokens ?? false;
		options.registry ||= impact.registry ?? false;
		options.editor ||= impact.editor ?? false;
		options.commands ||= impact.commands ?? false;
		options.previews ||= impact.previews ?? false;
	}

	return options;
}
