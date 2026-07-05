import { getIconIds, setIcon, type IconName } from "obsidian";

const fallbackIconByIcon = new Map<IconName, IconName>([
	["pen-square", "square-pen"],
	["trash", "trash-2"],
	["wand-sparkles", "sparkles"],
	["swatch-book", "palette"],
]);

let availableIconIds: Set<IconName> | null = null;

export function getAvailableIconIds(): ReadonlySet<IconName> {
	if (availableIconIds) {
		return availableIconIds;
	}

	availableIconIds = new Set(getIconIds());
	return availableIconIds;
}

export function getAvailableIconName(
	icon: IconName,
	fallbackIcon: IconName = "circle",
): IconName {
	const icons = getAvailableIconIds();
	if (icons.has(icon)) {
		return icon;
	}

	const mappedIcon = fallbackIconByIcon.get(icon);
	if (mappedIcon && icons.has(mappedIcon)) {
		return mappedIcon;
	}

	if (icons.has(fallbackIcon)) {
		return fallbackIcon;
	}

	if (icons.has("circle")) {
		return "circle";
	}

	return icon;
}

export function setSafeIcon(
	parent: HTMLElement,
	icon: IconName,
	fallbackIcon?: IconName,
): void {
	parent.empty();
	setIcon(parent, getAvailableIconName(icon, fallbackIcon));
}
