import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { createSettingsController } = load(
	"../src/settings/settings-tab/controller.ts",
);
const { createSettingsViewState } = load(
	"../src/settings/settings-tab/view-state.ts",
);
const { formatKeySegment, maxKeySegmentIndex } = load(
	"../src/tools/key-format.ts",
);

const tests = [
	{
		name: "tool creation uses root tools and two-character keys",
		async run() {
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [],
					tokens: [],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.createTool("inline");

			assert.equal(plugin.settings.tools.length, 1);
			assert.equal(plugin.settings.tools[0].id, "fancifyaa");
			assert.equal(plugin.settings.tools[0].toolKey, "aa");
			assert.equal(state.page, "tool");
			assert.equal(state.selectedPageId, "fancifyaa");
			assert.deepEqual(savedChanges, [["data-only"]]);
		},
	},
	{
		name: "variant creation uses two-character keys",
		async run() {
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants: [],
			};
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			state.page = "tool";
			state.selectedPageId = tool.id;
			const controller = createSettingsController(plugin, state, () => {});

			await controller.createVariant(tool);

			assert.equal(tool.variants.length, 1);
			assert.equal(tool.variants[0].id, "fancifyaaaa");
			assert.equal(tool.variants[0].variantKey, "aa");
			assert.equal(tool.variants[0].tagPrefix, "{{aaaa");
			assert.equal(state.page, "variant");
			assert.equal(state.selectedPageId, "fancifyaaaa");
			assert.deepEqual(savedChanges, [["variant-created"]]);
		},
	},
	{
		name: "tool property edits stay in the draft until commit",
		async run() {
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants: [],
			};
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			state.page = "tool";
			state.selectedPageId = tool.id;
			const controller = createSettingsController(plugin, state, () => {});

			controller.addToolProperty(tool, "color");

			assert.deepEqual(tool.styleFields, []);
			assert.deepEqual(controller.toolDraft(tool).styleFields, [
				{ property: "color" },
			]);

			assert.equal(await controller.commitCurrentPage(), true);
			assert.deepEqual(tool.styleFields, [{ property: "color" }]);
			assert.deepEqual(savedChanges, [["data-only"]]);
		},
	},
	{
		name: "tool icon edits stay in the draft until commit",
		async run() {
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants: [],
			};
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			state.page = "tool";
			state.selectedPageId = tool.id;
			const controller = createSettingsController(plugin, state, () => {});

			const draft = controller.toolDraft(tool);
			draft.icon = "tag";
			draft.dirty = true;

			assert.equal(tool.icon, undefined);
			assert.equal(await controller.commitCurrentPage(), true);
			assert.equal(tool.icon, "tag");
			assert.deepEqual(savedChanges, [["command-metadata-changed"]]);
		},
	},
	{
		name: "variant icon edits stay in the draft until commit",
		async run() {
			const variant = {
				id: "fancifyaaaa",
				name: "Variant",
				variantKey: "aa",
				tagPrefix: "{{aaaa",
				variantTokens: {},
			};
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants: [variant],
			};
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			state.page = "variant";
			state.selectedPageId = variant.id;
			const controller = createSettingsController(plugin, state, () => {});

			const draft = controller.variantDraft(tool, variant);
			draft.icon = "sparkles";
			draft.dirty = true;

			assert.equal(variant.icon, undefined);
			assert.equal(await controller.commitCurrentPage(), true);
			assert.equal(variant.icon, "sparkles");
			assert.deepEqual(savedChanges, [["command-metadata-changed"]]);
		},
	},
	{
		name: "tool element type edits stay in the draft until commit",
		async run() {
			const lineColorProperty = "--fancify-line-color";
			const lineLengthProperty = "--fancify-line-length";
			const variant = {
				id: "fancifyaaaa",
				name: "Variant",
				variantKey: "aa",
				tagPrefix: "{{aaaa",
				variantTokens: {
					[lineColorProperty]: "token-color",
					[lineLengthProperty]: "token-length",
				},
			};
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "horizontal-line",
				toolKey: "aa",
				styleFields: [
					{ property: lineColorProperty },
					{ property: lineLengthProperty },
				],
				variants: [variant],
			};
			const colorToken = {
				id: "token-color",
				property: lineColorProperty,
				value: "#ffffff",
			};
			const savedChanges = [];
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [
						colorToken,
						{
							id: "token-length",
							property: lineLengthProperty,
							value: "80%",
						},
					],
				},
				saveSettings: async (changes) => {
					savedChanges.push([...(changes ?? [])]);
				},
			};
			const state = createSettingsViewState();
			state.page = "tool";
			state.selectedPageId = tool.id;
			const controller = createSettingsController(plugin, state, () => {});

			controller.setToolType(tool, "vertical-line");

			assert.equal(tool.type, "horizontal-line");
			assert.equal(controller.toolDraft(tool).type, "vertical-line");
			assert.deepEqual(controller.toolDraft(tool).styleFields, [
				{ property: lineColorProperty },
			]);

			assert.equal(await controller.commitCurrentPage(), true);
			assert.equal(tool.type, "vertical-line");
			assert.deepEqual(tool.styleFields, [
				{ property: lineColorProperty },
			]);
			assert.deepEqual(variant.variantTokens, {
				[lineColorProperty]: "token-color",
			});
			assert.deepEqual(plugin.settings.tokens, [colorToken]);
			assert.deepEqual(savedChanges, [
				["tool-style-structure-changed", "command-metadata-changed"],
			]);
		},
	},
	{
		name: "tool duplication copies the selected tool with the next available suffix",
		async run() {
			const variant = {
				id: "fancifyaaaa",
				name: "Variant",
				commandName: "Apply variant",
				variantKey: "aa",
				tagPrefix: "{{aaaa",
				variantTokens: { color: "token-color" },
				icon: "sparkles",
			};
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				icon: "tag",
				toolKey: "aa",
				styleFields: [{ property: "color" }],
				variants: [variant],
			};
			const plugin = {
				settings: {
					tools: [
						tool,
						{
							...tool,
							id: "fancifyab",
							name: "Tool 1",
							toolKey: "ab",
							variants: [],
						},
					],
					tokens: [],
				},
				saveSettings: async () => {},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.duplicateTool(tool);

			const duplicate = plugin.settings.tools.at(-1);
			assert.equal(duplicate.name, "Tool 2");
			assert.equal(duplicate.id, "fancifyac");
			assert.deepEqual(duplicate.styleFields, [{ property: "color" }]);
			assert.equal(duplicate.variants.length, 1);
			assert.equal(duplicate.variants[0].id, "fancifyacaa");
			assert.equal(duplicate.variants[0].name, "Variant");
			assert.equal(duplicate.variants[0].commandName, "Apply variant");
			assert.equal(duplicate.variants[0].icon, "sparkles");
			assert.deepEqual(duplicate.variants[0].variantTokens, {
				color: "token-color",
			});
			assert.equal(state.page, "tool");
			assert.equal(state.selectedPageId, duplicate.id);
		},
	},
	{
		name: "variant duplication copies the selected variant with the next available suffix",
		async run() {
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [{ property: "color" }],
				variants: [
					{
						id: "fancifyaaaa",
						name: "Variant",
						commandName: "Apply variant",
						variantKey: "aa",
						tagPrefix: "{{aaaa",
						variantTokens: { color: "token-color" },
						icon: "sparkles",
					},
					{
						id: "fancifyaaab",
						name: "Variant 1",
						variantKey: "ab",
						tagPrefix: "{{aaab",
						variantTokens: {},
					},
				],
			};
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async () => {},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.duplicateVariant(tool.variants[0]);

			const duplicate = tool.variants.at(-1);
			assert.equal(duplicate.name, "Variant 2");
			assert.equal(duplicate.id, "fancifyaaac");
			assert.equal(duplicate.commandName, "Apply variant");
			assert.equal(duplicate.icon, "sparkles");
			assert.deepEqual(duplicate.variantTokens, { color: "token-color" });
			assert.equal(state.page, "variant");
			assert.equal(state.selectedPageId, duplicate.id);
		},
	},
	{
		name: "tool and variant moves reorder lists without changing ids",
		async run() {
			const firstVariant = {
				id: "fancifyaaaa",
				name: "First",
				variantKey: "aa",
				tagPrefix: "{{aaaa",
				variantTokens: {},
			};
			const secondVariant = {
				id: "fancifyaaab",
				name: "Second",
				variantKey: "ab",
				tagPrefix: "{{aaab",
				variantTokens: {},
			};
			const firstTool = {
				id: "fancifyaa",
				name: "First tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants: [firstVariant, secondVariant],
			};
			const secondTool = {
				id: "fancifyab",
				name: "Second tool",
				type: "inline",
				toolKey: "ab",
				styleFields: [],
				variants: [],
			};
			const plugin = {
				settings: {
					tools: [firstTool, secondTool],
					tokens: [],
				},
				saveSettings: async () => {},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.moveTool(firstTool, 2);
			await controller.moveVariant(firstVariant, 2);

			assert.deepEqual(
				plugin.settings.tools.map((tool) => tool.id),
				["fancifyab", "fancifyaa"],
			);
			assert.deepEqual(
				firstTool.variants.map((variant) => variant.id),
				["fancifyaaab", "fancifyaaaa"],
			);
		},
	},
	{
		name: "moves to a lower before-target position account for the removed source item",
		async run() {
			const variants = ["aa", "ab", "ac", "ad"].map((variantKey) => ({
				id: `fancifyaa${variantKey}`,
				name: variantKey,
				variantKey,
				tagPrefix: `{{aa${variantKey}`,
				variantTokens: {},
			}));
			const tool = {
				id: "fancifyaa",
				name: "Tool",
				type: "inline",
				toolKey: "aa",
				styleFields: [],
				variants,
			};
			const plugin = {
				settings: {
					tools: [tool],
					tokens: [],
				},
				saveSettings: async () => {},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.moveVariant(variants[1], 3);

			assert.deepEqual(
				tool.variants.map((variant) => variant.variantKey),
				["aa", "ac", "ab", "ad"],
			);
		},
	},
	{
		name: "duplication stops when the maximum list size is reached",
		async run() {
			const tools = [];
			for (let index = 0; index < maxKeySegmentIndex; index += 1) {
				const toolKey = formatKeySegment(index);
				tools.push({
					id: `fancify${toolKey}`,
					name: `Tool ${index}`,
					type: "inline",
					toolKey,
					styleFields: [],
					variants: [],
				});
			}
			const plugin = {
				settings: {
					tools,
					tokens: [],
				},
				saveSettings: async () => {
					throw new Error("Settings should not be saved.");
				},
			};
			const state = createSettingsViewState();
			const controller = createSettingsController(plugin, state, () => {});

			await controller.duplicateTool(tools[0]);

			assert.equal(plugin.settings.tools.length, maxKeySegmentIndex);
		},
	},
];

for (const { name, run } of tests) {
	await run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} settings controller checks.`);
