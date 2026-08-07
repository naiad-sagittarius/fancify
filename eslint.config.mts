import { defineConfig, globalIgnores } from "eslint/config";
import type { Linter } from "eslint";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

const obsidianConfigs = (obsidianmd.configs?.recommended ??
	[]) as Linter.Config[];

export default defineConfig([
	...obsidianConfigs,

	{
		languageOptions: {
			globals: {
				...globals.browser,
				activeDocument: "readonly",
				activeWindow: "readonly",
				process: "readonly",
			},
			parserOptions: {
				parser: tseslint.parser,
				projectService: {
					allowDefaultProject: ["eslint.config.js", "manifest.json"],
				},
				tsconfigRootDir: new URL(".", import.meta.url).pathname,
				extraFileExtensions: [".json"],
			},
		},
	},

	{
		files: ["**/settings-tab.ts"],
		rules: {
			"@typescript-eslint/no-deprecated": "off",
			"obsidianmd/prefer-declarative-settings": "off",
			"obsidianmd/prefer-settings-update": "off",
			"obsidianmd/no-important": "off",
		},
	},

	globalIgnores(["node_modules", "dist", "*.js", "*.json"]),
]);
