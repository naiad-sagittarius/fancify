import type { Tree } from "@lezer/common";
import type { ScanRange } from "./types";

const excludedNodeNames = new Set(["InlineCode", "FencedCode", "CodeBlock"]);

export function collectSyntaxExclusions(
	tree: Tree,
	ranges: readonly ScanRange[],
): ScanRange[] {
	const exclusions: ScanRange[] = [];

	for (const range of ranges) {
		tree.iterate({
			from: range.from,
			to: range.to,
			enter: (node) => {
				if (!excludedNodeNames.has(node.name)) {
					return;
				}

				const from = Math.max(range.from, node.from);
				const to = Math.min(range.to, node.to);
				if (from >= to) {
					return;
				}

				exclusions.push({
					from,
					to,
				});
			},
		});
	}

	return exclusions;
}
