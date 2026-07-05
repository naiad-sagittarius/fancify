import {
	ButtonComponent,
	TextComponent,
} from "obsidian";
import { setSafeIcon } from "../../../tools/icon-rendering";

export function renderTextField(
	container: HTMLElement,
	options: {
		fieldClass?: string;
		inputClass?: string;
		label?: string;
		onChange: (value: string) => void;
		placeholder: string;
		value: string;
	},
): void {
	const fieldEl = container.createDiv("fancify-field");
	if (options.fieldClass) {
		fieldEl.addClass(options.fieldClass);
	}

	if (options.label) {
		fieldEl.createDiv({
			cls: "fancify-field-label",
			text: options.label,
		});
	}

	const inputComponent = new TextComponent(
		fieldEl.createDiv("fancify-field-control"),
	);
	inputComponent.setPlaceholder(options.placeholder);
	inputComponent.setValue(options.value);
	if (options.inputClass) {
		inputComponent.inputEl.addClass(options.inputClass);
	}
	inputComponent.onChange((value) => {
		options.onChange(value);
	});
}

export function renderIconButton(
	container: HTMLElement,
	label: string,
	icon: string,
	onClick: () => void | Promise<void>,
	isDanger = false,
	isLarge = false,
): ButtonComponent {
	const button = new ButtonComponent(container);
	setSafeIcon(button.buttonEl, icon, "circle");
	button.setTooltip(label);
	button.buttonEl.setAttr("aria-label", label);
	button.setClass("fancify-icon-button");
	button.buttonEl.addClass("fancify-center-content");

	if (isDanger) {
		button.buttonEl.addClass("is-danger");
	}

	if (isLarge) {
		button.buttonEl.addClass("is-large");
	}

	button.onClick(async () => {
		await onClick();
	});

	return button;
}
