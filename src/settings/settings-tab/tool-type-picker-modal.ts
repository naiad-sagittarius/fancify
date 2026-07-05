import { Modal, type App } from "obsidian";
import { type StyleType } from "../../styles/types";

type ToolCreationType = "inline" | "block" | "element";

const toolCreationTypes = ["inline", "block", "element"] as const;
const defaultElementStyleType: StyleType = "vertical-line";

export class ToolTypePickerModal extends Modal {
	private readonly onChoose: (type: StyleType) => void;

	constructor(app: App, onChoose: (type: StyleType) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	onOpen(): void {
		this.containerEl.addClass("fancify-tool-type-modal-container");
		this.containerEl.removeClass("fancify-tool-type-modal-no-close-slide");
		this.modalEl.addClass("fancify-tool-type-modal");
		this.modalEl.removeClass("fancify-tool-type-modal-no-close-slide");
		this.titleEl.setText("Create tool");
		this.contentEl.empty();

		this.contentEl.createDiv({
			cls: "fancify-tool-type-question",
			text: "Which tool type do you want to create?",
		});

		const actionsEl = this.contentEl.createDiv("fancify-tool-type-actions");
		for (const type of toolCreationTypes) {
			this.renderTypeButton(actionsEl, type);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}

	close(): void {
		this.containerEl.addClass("fancify-tool-type-modal-no-close-slide");
		this.modalEl.addClass("fancify-tool-type-modal-no-close-slide");
		super.close();
	}

	private renderTypeButton(
		container: HTMLElement,
		type: ToolCreationType,
	): void {
		const buttonEl = container.createEl("button", {
			attr: { type: "button" },
			cls: "fancify-tool-type-button",
			text: type,
		});

		buttonEl.addEventListener("click", () => {
			this.close();
			this.onChoose(type === "element" ? defaultElementStyleType : type);
		});
	}
}
