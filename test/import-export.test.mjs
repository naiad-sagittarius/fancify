import assert from "node:assert/strict";
import jiti from "jiti";

const load = jiti(import.meta.url, { interopDefault: true });
const { createBackupExport, createPresetExport } = load(
	"../src/settings/import-export/export.ts",
);
const { appendPresetImport, parseFancifyImport } = load(
	"../src/settings/import-export/import.ts",
);
const { stringifyExport } = load("../src/settings/import-export/export.ts");
const { formatKeySegment, maxKeySegmentIndex } = load(
	"../src/tools/key-format.ts",
);

const tests = [
	{
		name: "preset export stores style values instead of token ids",
		run() {
			const settings = {
				tools: [
					{
						id: "fancifyaa",
						name: "Marker",
						type: "inline",
						icon: "highlighter",
						toolKey: "aa",
						styleFields: [{ property: "background-color" }],
						variants: [
							{
								id: "fancifyaaaa",
								name: "Yellow",
								commandName: "Mark yellow",
								variantKey: "aa",
								tagPrefix: "{{aaaa",
								variantTokens: {
									"background-color": "background-color-aaa",
								},
							},
						],
					},
				],
				tokens: [
					{
						id: "background-color-aaa",
						property: "background-color",
						value: "#ffff99",
					},
				],
			};

			const preset = createPresetExport(
				settings,
				"1.0.0",
				new Date("2026-07-06T00:00:00.000Z"),
			);

			assert.equal(preset.format, "fancify-preset");
			assert.equal(preset.tools[0].variants[0].values["background-color"], "#ffff99");
			assert.equal(preset.tools[0].variants[0].variantTokens, undefined);
			assert.equal(preset.tools[0].toolKey, undefined);
		},
	},
	{
		name: "preset import appends new tools with generated keys",
		run() {
			const targetSettings = {
				tools: [
					{
						id: "fancifyaa",
						name: "Existing",
						type: "inline",
						toolKey: "aa",
						styleFields: [],
						variants: [],
					},
				],
				tokens: [],
			};
			const preset = {
				format: "fancify-preset",
				formatVersion: 1,
				pluginVersion: "1.0.0",
				exportedAt: "2026-07-06T00:00:00.000Z",
				tools: [
					{
						name: "Marker",
						type: "inline",
						styleFields: [{ property: "background-color" }],
						variants: [
							{
								name: "Yellow",
								commandName: "Mark yellow",
								values: { "background-color": "#ffff99" },
							},
						],
					},
				],
			};

			const result = appendPresetImport(targetSettings, preset);

			assert.equal(result.valid, true);
			assert.equal(targetSettings.tools.length, 2);
			assert.equal(targetSettings.tools[1].id, "fancifyab");
			assert.equal(targetSettings.tools[1].variants[0].id, "fancifyabaa");
			assert.equal(targetSettings.tools[1].variants[0].tagPrefix, "{{abaa");
			assert.equal(targetSettings.tokens.length, 1);
			assert.equal(targetSettings.tokens[0].value, "#ffff99");
		},
	},
	{
		name: "backup export round-trips full settings for replace import",
		run() {
			const settings = {
				tools: [
					{
						id: "fancifyac",
						name: "Line",
						type: "vertical-line",
						toolKey: "ac",
						styleFields: [{ property: "--fancify-line-color" }],
						variants: [
							{
								id: "fancifyacaa",
								name: "Blue",
								variantKey: "aa",
								tagPrefix: "{{acaa",
								variantTokens: {
									"--fancify-line-color": "--fancify-line-color-aaa",
								},
							},
						],
					},
				],
				tokens: [
					{
						id: "--fancify-line-color-aaa",
						property: "--fancify-line-color",
						value: "#0000ff",
					},
				],
			};
			const backup = createBackupExport(
				settings,
				"1.0.0",
				new Date("2026-07-06T00:00:00.000Z"),
			);

			const parsed = parseFancifyImport(stringifyExport(backup));

			assert.equal(parsed.valid, true);
			assert.equal(parsed.value.format, "fancify-settings");
			assert.deepEqual(parsed.value.settings, settings);
		},
	},
	{
		name: "invalid preset property is rejected",
		run() {
			const parsed = parseFancifyImport(
				JSON.stringify({
					format: "fancify-preset",
					formatVersion: 1,
					tools: [
						{
							name: "Broken",
							type: "inline",
							styleFields: [{ property: "text-align" }],
							variants: [],
						},
					],
				}),
			);

			assert.equal(parsed.valid, false);
			assert.match(parsed.message, /not valid/);
		},
	},
	{
		name: "failed preset import does not mutate existing settings",
		run() {
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

			const targetSettings = { tools, tokens: [] };
			const snapshot = JSON.stringify(targetSettings);
			const result = appendPresetImport(targetSettings, {
				format: "fancify-preset",
				formatVersion: 1,
				pluginVersion: "1.0.0",
				exportedAt: "2026-07-06T00:00:00.000Z",
				tools: [
					{
						name: "Overflow",
						type: "inline",
						styleFields: [],
						variants: [],
					},
				],
			});

			assert.equal(result.valid, false);
			assert.equal(JSON.stringify(targetSettings), snapshot);
		},
	},
];

for (const { name, run } of tests) {
	run();
	console.log(`PASS ${name}`);
}

console.log(`Completed ${tests.length} import/export checks.`);
