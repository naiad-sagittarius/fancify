interface LineElementOptions {
	readonly interactive?: boolean;
}

export function createLineElement(
	doc: Document,
	cssClass: string,
	options: LineElementOptions = {},
): HTMLElement {
	const lineEl = doc.createElement("span");
	for (const className of cssClass.split(/\s+/)) {
		if (className.length > 0) {
			lineEl.classList.add(className);
		}
	}

	if (options.interactive) {
		lineEl.setAttribute("aria-label", "Horizontal line");
		lineEl.setAttribute("role", "button");
		lineEl.setAttribute("tabindex", "0");
		lineEl.setAttribute("title", "Open menu");
	} else {
		lineEl.setAttribute("aria-hidden", "true");
	}

	return lineEl;
}
