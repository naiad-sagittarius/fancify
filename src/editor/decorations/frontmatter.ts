import type { Text } from "@codemirror/state";
import type { ScanRange } from "./types";

const frontmatterDelimiter = "---";
const frontmatterEndDelimiters = new Set(["---", "..."]);

export function detectFrontmatter(doc: Text): ScanRange | null {
	if (doc.lines === 0) {
		return null;
	}

	const firstLine = doc.line(1);
	if (firstLine.text !== frontmatterDelimiter) {
		return null;
	}

	for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber++) {
		const line = doc.line(lineNumber);
		if (!frontmatterEndDelimiters.has(line.text)) {
			continue;
		}

		return {
			from: 0,
			to: line.to,
		};
	}

	return null;
}
