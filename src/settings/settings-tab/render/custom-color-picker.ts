import { activeDocument } from "obsidian";

export type ColorOutputFormat = "hex" | "rgb";

interface RgbColor {
	b: number;
	g: number;
	r: number;
}

interface HsvColor {
	h: number;
	s: number;
	v: number;
}

interface CustomColorPickerOptions {
	anchorEl: HTMLElement;
	anchorPreviewEl?: HTMLElement;
	initialFormat: ColorOutputFormat;
	initialValue: string;
	onChange: (value: string, format: ColorOutputFormat) => void;
}

const defaultHexColor = "#000000";
const viewportPadding = 12;
const popoverWidth = 260;
let colorParserContext: CanvasRenderingContext2D | null | undefined;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function getColorParserContext(): CanvasRenderingContext2D | null {
	if (colorParserContext !== undefined) {
		return colorParserContext;
	}

	const canvas = activeDocument.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	colorParserContext = canvas.getContext("2d");
	return colorParserContext;
}

function normaliseHexColor(value: string): string {
	const lowerCaseValue = value.toLowerCase();
	if (lowerCaseValue.length === 4) {
		return `#${lowerCaseValue
			.slice(1)
			.split("")
			.map((channel) => `${channel}${channel}`)
			.join("")}`;
	}

	if (lowerCaseValue.length === 9) {
		return lowerCaseValue.slice(0, 7);
	}

	return lowerCaseValue;
}

function rgbFunctionToHex(value: string): string | null {
	const match = value.match(
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i,
	);
	if (!match) {
		return null;
	}

	const channels = match
		.slice(1, 4)
		.map((channel) => Number.parseInt(channel, 10));
	if (
		channels.some(
			(channel) => Number.isNaN(channel) || channel < 0 || channel > 255,
		)
	) {
		return null;
	}

	return `#${channels
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("")}`;
}

function getPickerHexValue(value: string): string | null {
	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return null;
	}

	const context = getColorParserContext();
	if (!context) {
		return null;
	}

	try {
		context.fillStyle = defaultHexColor;
		context.fillStyle = trimmedValue;
	} catch {
		return null;
	}

	const normalisedValue = context.fillStyle.trim().toLowerCase();
	if (normalisedValue.startsWith("#")) {
		return normaliseHexColor(normalisedValue);
	}

	return rgbFunctionToHex(normalisedValue);
}

export function getInitialColorFormat(value: string): ColorOutputFormat {
	return value.trim().toLowerCase().startsWith("rgb") ? "rgb" : "hex";
}

function hexToRgb(hex: string): RgbColor {
	const normalisedHex = normaliseHexColor(hex);
	return {
		r: Number.parseInt(normalisedHex.slice(1, 3), 16),
		g: Number.parseInt(normalisedHex.slice(3, 5), 16),
		b: Number.parseInt(normalisedHex.slice(5, 7), 16),
	};
}

function rgbToHex(rgb: RgbColor): string {
	return `#${[rgb.r, rgb.g, rgb.b]
		.map((channel) =>
			clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"),
		)
		.join("")}`;
}

function rgbToHsv(rgb: RgbColor): HsvColor {
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	let h = 0;

	if (delta !== 0) {
		if (max === r) {
			h = ((g - b) / delta) % 6;
		} else if (max === g) {
			h = (b - r) / delta + 2;
		} else {
			h = (r - g) / delta + 4;
		}
		h *= 60;
		if (h < 0) {
			h += 360;
		}
	}

	return {
		h,
		s: max === 0 ? 0 : delta / max,
		v: max,
	};
}

function hsvToRgb(hsv: HsvColor): RgbColor {
	const h = ((hsv.h % 360) + 360) % 360;
	const s = clamp(hsv.s, 0, 1);
	const v = clamp(hsv.v, 0, 1);
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let r = 0;
	let g = 0;
	let b = 0;

	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}

	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
	};
}

function formatColor(rgb: RgbColor, format: ColorOutputFormat): string {
	if (format === "rgb") {
		return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
	}

	return rgbToHex(rgb);
}

function syncColorPreviewElement(
	element: HTMLElement | null | undefined,
	hex: string,
): void {
	if (!element) {
		return;
	}

	element.style.setProperty("--fancify-selected-color", hex);
	element.style.backgroundColor = hex;
}

function trySetPointerCapture(
	element: HTMLElement | null,
	pointerId: number,
): void {
	if (!element) {
		return;
	}

	try {
		element.setPointerCapture(pointerId);
	} catch {
		// Some mobile webviews reject capture after touch focus changes.
	}
}

export class CustomColorPicker {
	private static activePicker: CustomColorPicker | null = null;

	private readonly anchorEl: HTMLElement;
	private readonly anchorPreviewEl: HTMLElement | null;
	private readonly onChange: (
		value: string,
		format: ColorOutputFormat,
	) => void;
	private abortController: AbortController | null = null;
	private dragAbortController: AbortController | null = null;
	private format: ColorOutputFormat;
	private hueSliderEl: HTMLElement | null = null;
	private hueThumbEl: HTMLElement | null = null;
	private isOpen = false;
	private pointerEl: HTMLElement | null = null;
	private popoverEl: HTMLElement | null = null;
	private previewEl: HTMLElement | null = null;
	private rafId: number | null = null;
	private saturationValueEl: HTMLElement | null = null;
	private selectedHsv: HsvColor;
	private stagedHuePointer: { clientX: number } | null = null;
	private stagedPointer: { clientX: number; clientY: number } | null = null;

	constructor(options: CustomColorPickerOptions) {
		this.anchorEl = options.anchorEl;
		this.anchorPreviewEl = options.anchorPreviewEl ?? null;
		this.onChange = options.onChange;
		this.format = options.initialFormat;
		const initialHex =
			getPickerHexValue(options.initialValue) ?? defaultHexColor;
		this.selectedHsv = rgbToHsv(hexToRgb(initialHex));
		this.syncAnchorPreview();
		this.anchorEl.addEventListener("click", () => {
			this.toggle();
		});
		this.anchorEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") {
				return;
			}
			event.preventDefault();
			this.toggle();
		});
	}

	close(): void {
		if (!this.isOpen) {
			return;
		}

		this.abortDrag();
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.abortController?.abort();
		this.abortController = null;
		this.popoverEl?.remove();
		this.popoverEl = null;
		this.hueSliderEl = null;
		this.hueThumbEl = null;
		this.pointerEl = null;
		this.previewEl = null;
		this.saturationValueEl = null;
		this.stagedHuePointer = null;
		this.stagedPointer = null;
		this.isOpen = false;
		if (CustomColorPicker.activePicker === this) {
			CustomColorPicker.activePicker = null;
		}
	}

	open(): void {
		if (this.isOpen) {
			return;
		}

		CustomColorPicker.activePicker?.close();
		CustomColorPicker.activePicker = this;
		this.isOpen = true;
		this.abortController = new AbortController();
		this.renderPopover();
		this.syncPopover();
		this.positionPopover();
		this.registerGlobalListeners(this.abortController.signal);
	}

	toggle(): void {
		if (this.isOpen) {
			this.close();
			return;
		}

		this.open();
	}

	updateFromText(value: string): void {
		const nextHex = getPickerHexValue(value);
		if (!nextHex) {
			return;
		}

		this.selectedHsv = rgbToHsv(hexToRgb(nextHex));
		this.format = getInitialColorFormat(value);
		this.syncAnchorPreview();
		if (this.isOpen) {
			this.syncPopover();
		}
	}

	private abortDrag(): void {
		this.dragAbortController?.abort();
		this.dragAbortController = null;
	}

	private emitChange(): void {
		const rgb = hsvToRgb(this.selectedHsv);
		this.onChange(formatColor(rgb, this.format), this.format);
		this.syncAnchorPreview();
		this.syncPopover();
	}

	private getHex(): string {
		return rgbToHex(hsvToRgb(this.selectedHsv));
	}

	private positionPopover(): void {
		if (!this.popoverEl) {
			return;
		}

		this.popoverEl.style.maxHeight = `${Math.max(
			160,
			window.innerHeight - viewportPadding * 2,
		)}px`;
		const anchorRect = this.anchorEl.getBoundingClientRect();
		const popoverRect = this.popoverEl.getBoundingClientRect();
		const popoverHeight = popoverRect.height;
		const availableBelow =
			window.innerHeight - anchorRect.bottom - viewportPadding;
		const availableAbove = anchorRect.top - viewportPadding;
		const shouldOpenAbove =
			availableBelow < popoverHeight && availableAbove > availableBelow;
		const top = shouldOpenAbove
			? Math.max(viewportPadding, anchorRect.top - popoverHeight - 8)
			: Math.min(
					window.innerHeight - popoverHeight - viewportPadding,
					anchorRect.bottom + 8,
				);
		const left = clamp(
			anchorRect.left,
			viewportPadding,
			window.innerWidth - popoverWidth - viewportPadding,
		);

		this.popoverEl.style.left = `${left}px`;
		this.popoverEl.style.top = `${Math.max(viewportPadding, top)}px`;
	}

	private registerGlobalListeners(signal: AbortSignal): void {
		activeDocument.addEventListener(
			"pointerdown",
			(event) => {
				const target = event.target;
				if (!(target instanceof Node)) {
					return;
				}

				if (
					this.popoverEl?.contains(target) ||
					this.anchorEl.contains(target)
				) {
					return;
				}

				this.close();
			},
			{ capture: true, signal },
		);
		activeDocument.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					this.close();
				}
			},
			{ signal },
		);
		window.addEventListener("resize", () => this.positionPopover(), {
			signal,
		});
		window.addEventListener("scroll", () => this.positionPopover(), {
			capture: true,
			signal,
		});
	}

	private renderPopover(): void {
		const popoverEl = activeDocument.body.createDiv(
			"fancify-custom-color-popover",
		);
		popoverEl.style.width = `${popoverWidth}px`;
		this.popoverEl = popoverEl;

		const hueRowEl = popoverEl.createDiv("fancify-custom-color-hue-row");
		const hueSliderEl = hueRowEl.createDiv({
			cls: "fancify-custom-color-hue",
			attr: {
				"aria-label": "Hue",
				"aria-valuemax": "359",
				"aria-valuemin": "0",
				role: "slider",
				tabindex: "0",
			},
		});
		this.hueSliderEl = hueSliderEl;
		this.hueThumbEl = hueSliderEl.createDiv(
			"fancify-custom-color-hue-thumb",
		);
		hueSliderEl.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			this.startHueDrag(event);
		});
		hueSliderEl.addEventListener("keydown", (event) => {
			this.handleHueKeydown(event);
		});

		const saturationValueEl = popoverEl.createDiv({
			cls: "fancify-custom-color-sv",
			attr: {
				role: "slider",
				tabindex: "0",
				"aria-label": "Color saturation and brightness",
			},
		});
		this.saturationValueEl = saturationValueEl;
		this.pointerEl = saturationValueEl.createDiv(
			"fancify-custom-color-sv-pointer",
		);
		saturationValueEl.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			this.startSaturationValueDrag(event);
		});
		saturationValueEl.addEventListener("keydown", (event) => {
			this.handleSaturationValueKeydown(event);
		});

		this.previewEl = popoverEl.createDiv("fancify-custom-color-preview");

		const formatEl = popoverEl.createDiv("fancify-custom-color-format");
		this.renderFormatButton(formatEl, "hex", "Hex");
		this.renderFormatButton(formatEl, "rgb", "RGB");
	}

	private renderFormatButton(
		container: HTMLElement,
		format: ColorOutputFormat,
		label: string,
	): void {
		const buttonEl = container.createEl("button", {
			text: label,
			attr: {
				"aria-pressed": "false",
				type: "button",
			},
			cls: [
				"fancify-custom-color-format-button",
				"fancify-center-content",
			],
		});
		buttonEl.addEventListener("click", () => {
			this.format = format;
			this.emitChange();
		});
	}

	private scheduleSaturationValueUpdate(
		clientX: number,
		clientY: number,
	): void {
		this.stagedPointer = { clientX, clientY };
		if (this.rafId !== null) {
			return;
		}

		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			if (this.stagedHuePointer) {
				this.updateHueFromPointer(this.stagedHuePointer.clientX);
				this.stagedHuePointer = null;
			}
			if (!this.stagedPointer) {
				return;
			}

			this.updateSaturationValueFromPointer(
				this.stagedPointer.clientX,
				this.stagedPointer.clientY,
			);
			this.stagedPointer = null;
		});
	}

	private scheduleHueUpdate(clientX: number): void {
		this.stagedHuePointer = { clientX };
		if (this.rafId !== null) {
			return;
		}

		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			if (this.stagedHuePointer) {
				this.updateHueFromPointer(this.stagedHuePointer.clientX);
				this.stagedHuePointer = null;
			}
			if (this.stagedPointer) {
				this.updateSaturationValueFromPointer(
					this.stagedPointer.clientX,
					this.stagedPointer.clientY,
				);
				this.stagedPointer = null;
			}
		});
	}

	private startHueDrag(event: PointerEvent): void {
		this.abortDrag();
		this.dragAbortController = new AbortController();
		trySetPointerCapture(this.hueSliderEl, event.pointerId);
		this.scheduleHueUpdate(event.clientX);

		activeDocument.addEventListener(
			"pointermove",
			(pointerEvent) => {
				this.scheduleHueUpdate(pointerEvent.clientX);
			},
			{ signal: this.dragAbortController.signal },
		);
		activeDocument.addEventListener(
			"pointerup",
			() => {
				this.abortDrag();
			},
			{ once: true, signal: this.dragAbortController.signal },
		);
	}

	private startSaturationValueDrag(event: PointerEvent): void {
		this.abortDrag();
		this.dragAbortController = new AbortController();
		trySetPointerCapture(this.saturationValueEl, event.pointerId);
		this.scheduleSaturationValueUpdate(event.clientX, event.clientY);

		activeDocument.addEventListener(
			"pointermove",
			(pointerEvent) => {
				this.scheduleSaturationValueUpdate(
					pointerEvent.clientX,
					pointerEvent.clientY,
				);
			},
			{ signal: this.dragAbortController.signal },
		);
		activeDocument.addEventListener(
			"pointerup",
			() => {
				this.abortDrag();
			},
			{ once: true, signal: this.dragAbortController.signal },
		);
	}

	private handleSaturationValueKeydown(event: KeyboardEvent): void {
		const step = event.shiftKey ? 0.1 : 0.02;
		let nextHsv: HsvColor | null = null;
		if (event.key === "ArrowLeft") {
			nextHsv = { ...this.selectedHsv, s: this.selectedHsv.s - step };
		} else if (event.key === "ArrowRight") {
			nextHsv = { ...this.selectedHsv, s: this.selectedHsv.s + step };
		} else if (event.key === "ArrowDown") {
			nextHsv = { ...this.selectedHsv, v: this.selectedHsv.v - step };
		} else if (event.key === "ArrowUp") {
			nextHsv = { ...this.selectedHsv, v: this.selectedHsv.v + step };
		}

		if (!nextHsv) {
			return;
		}

		event.preventDefault();
		this.selectedHsv = {
			h: nextHsv.h,
			s: clamp(nextHsv.s, 0, 1),
			v: clamp(nextHsv.v, 0, 1),
		};
		this.emitChange();
	}

	private handleHueKeydown(event: KeyboardEvent): void {
		const step = event.shiftKey ? 10 : 1;
		let nextHue: number | null = null;
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			nextHue = this.selectedHsv.h - step;
		} else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			nextHue = this.selectedHsv.h + step;
		} else if (event.key === "Home") {
			nextHue = 0;
		} else if (event.key === "End") {
			nextHue = 359;
		}

		if (nextHue === null) {
			return;
		}

		event.preventDefault();
		this.selectedHsv = {
			...this.selectedHsv,
			h: ((nextHue % 360) + 360) % 360,
		};
		this.emitChange();
	}

	private syncAnchorPreview(): void {
		const hex = this.getHex();
		this.anchorEl.style.setProperty("--fancify-selected-color", hex);
		syncColorPreviewElement(this.anchorPreviewEl, hex);
	}

	private syncPopover(): void {
		const hex = this.getHex();
		const hueColor = rgbToHex(
			hsvToRgb({
				h: this.selectedHsv.h,
				s: 1,
				v: 1,
			}),
		);
		syncColorPreviewElement(this.previewEl, hex);
		this.saturationValueEl?.style.setProperty(
			"--fancify-selected-hue",
			hueColor,
		);
		this.hueThumbEl?.style.setProperty("--fancify-selected-hue", hueColor);
		this.hueThumbEl?.style.setProperty(
			"--fancify-hue-thumb-x",
			`${(this.selectedHsv.h / 359) * 100}%`,
		);
		this.hueSliderEl?.setAttr(
			"aria-valuenow",
			`${Math.round(this.selectedHsv.h)}`,
		);
		this.pointerEl?.style.setProperty(
			"--fancify-sv-pointer-x",
			`${this.selectedHsv.s * 100}%`,
		);
		this.pointerEl?.style.setProperty(
			"--fancify-sv-pointer-y",
			`${(1 - this.selectedHsv.v) * 100}%`,
		);
		this.popoverEl
			?.querySelectorAll(".fancify-custom-color-format-button")
			.forEach((buttonEl) => {
				if (!buttonEl.instanceOf(HTMLButtonElement)) {
					return;
				}

				const isActive =
					buttonEl.textContent?.toLowerCase() === this.format;
				buttonEl.toggleClass("is-active", isActive);
				buttonEl.setAttr("aria-pressed", `${isActive}`);
			});
	}

	private updateSaturationValueFromPointer(
		clientX: number,
		clientY: number,
	): void {
		const rect = this.saturationValueEl?.getBoundingClientRect();
		if (!rect) {
			return;
		}

		this.selectedHsv = {
			h: this.selectedHsv.h,
			s: clamp((clientX - rect.left) / rect.width, 0, 1),
			v: clamp(1 - (clientY - rect.top) / rect.height, 0, 1),
		};
		this.emitChange();
	}

	private updateHueFromPointer(clientX: number): void {
		const rect = this.hueSliderEl?.getBoundingClientRect();
		if (!rect) {
			return;
		}

		const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
		this.selectedHsv = {
			...this.selectedHsv,
			h: ratio >= 1 ? 359 : ratio * 360,
		};
		this.emitChange();
	}
}
