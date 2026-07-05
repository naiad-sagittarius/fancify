import type Fancify from "../main";
import type { FancifySettings } from "../settings/settings";
import { isHorizontalLineStyleType } from "../styles/types";
import { getAvailableIconName } from "../tools/icon-rendering";
import { applyVariant } from "./apply-variant";

/**
 * Dynamically registers a command for each variant in the settings.
 * Commands are organized hierarchically in the command palette:
 * "Fancify: [Tool] [Variant]"
 *
 * Called during plugin load and after settings save to keep commands in sync.
 */
export function registerDynamicCommands(
	plugin: Fancify,
	settings: FancifySettings,
): string[] {
	const commandIds: string[] = [];

	settings.tools.forEach((tool) => {
		tool.variants.forEach((variant) => {
			const toolType = tool.type;
			const defaultCommandName = `${tool.name} ${variant.name}`;
			const commandIcon = variant.icon ?? tool.icon;
			plugin.addCommand({
				id: variant.id,
				name: variant.commandName?.trim() || defaultCommandName,
				icon: commandIcon
					? getAvailableIconName(commandIcon, "tag")
					: undefined,
				editorCheckCallback: (checking: boolean, editor) => {
					const canApply =
						isHorizontalLineStyleType(toolType) ||
						editor.somethingSelected();
					if (!checking && canApply) {
						applyVariant(editor, variant, toolType, tool.toolKey);
					}
					return canApply;
				},
			});
			commandIds.push(variant.id);
		});
	});

	return commandIds;
}
