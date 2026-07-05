import type { Tool } from "../../../tools/types";
import { setSafeIcon } from "../../../tools/icon-rendering";

export type ToolIconPlaceholderStyle = "default" | "slash";

interface ToolIconSlotOptions {
	compact?: boolean;
	icon: Tool["icon"] | null | undefined;
	label: string;
	onClick?: () => void | Promise<void>;
	placeholderStyle?: ToolIconPlaceholderStyle;
}

function renderToolIconPlaceholder(
	container: HTMLElement,
	style: ToolIconPlaceholderStyle = "default",
): void {
	if (style !== "slash") {
		return;
	}

	const placeholderEl = container.createSpan({
		cls: [
			"fancify-tool-icon-slot-placeholder",
			"fancify-center-content",
			"is-slash",
		],
		attr: { "aria-hidden": "true" },
	});
	setSafeIcon(placeholderEl, "slash", "circle-slash");
	placeholderEl.querySelector("svg")?.classList.add(
		"fancify-tool-icon-slot-placeholder-icon",
	);
}

export function updateToolIconSlot(
	slotEl: HTMLElement,
	icon: Tool["icon"] | null | undefined,
	placeholderStyle: ToolIconPlaceholderStyle = "default",
): void {
	slotEl.empty();
	slotEl.toggleClass("is-placeholder", !icon);

	const previewEl = slotEl.createDiv({
		cls: ["fancify-tool-icon-slot-preview", "fancify-center-content"],
	});
	if (icon) {
		setSafeIcon(previewEl, icon, "circle");
		return;
	}

	renderToolIconPlaceholder(previewEl, placeholderStyle);
}

export function renderToolIconSlot(
	container: HTMLElement,
	options: ToolIconSlotOptions,
): HTMLElement {
	const slotEl =
		typeof options.onClick === "function"
			? container.createEl("button", {
					attr: {
						"aria-label": options.label,
						title: options.label,
						type: "button",
					},
					cls: ["fancify-tool-icon-slot", "fancify-center-content"],
				})
			: container.createDiv({
					cls: ["fancify-tool-icon-slot", "fancify-center-content"],
				});

	if (options.compact) {
		slotEl.addClass("is-compact");
	}

	updateToolIconSlot(
		slotEl,
		options.icon,
		options.placeholderStyle,
	);

	if (typeof options.onClick === "function") {
		slotEl.addEventListener("click", () => {
			void options.onClick?.();
		});
	}

	return slotEl;
}

export { renderToolIconPlaceholder };
