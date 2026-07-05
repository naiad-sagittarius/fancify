import type { IconName } from "obsidian";
import { getAvailableIconIds } from "./icon-rendering";

interface ToolIconEntry {
	id: IconName;
	normalizedId: string;
	terms: string[];
}

const hiddenInitialIconIds = new Set<IconName>(["link-glyph"]);

const featuredToolIcons: IconName[] = [
	"brush",
	"palette",
	"wand-sparkles",
	"sparkles",
	"highlighter",
	"pen-tool",
	"pen-square",
	"pencil-ruler",
	"shapes",
	"type",
	"whole-word",
	"file-text",
	"book-open",
	"tag",
	"bookmark",
	"star",
	"heart",
	"sun",
	"moon-star",
	"flame",
	"bolt",
	"gem",
	"folder",
	"swatch-book",
];

let cachedToolIconEntries: ToolIconEntry[] | null = null;

function normalizeIconQuery(value: string): string {
	return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function getToolIconEntries(): ToolIconEntry[] {
	if (cachedToolIconEntries) {
		return cachedToolIconEntries;
	}

	const iconIds = [...getAvailableIconIds()].sort((left, right) =>
		left.localeCompare(right),
	);
	cachedToolIconEntries = iconIds.map((id) => {
		const normalizedId = normalizeIconQuery(id);
		return {
			id,
			normalizedId,
			terms: normalizedId.split(" ").filter(Boolean),
		};
	});
	return cachedToolIconEntries;
}

function getToolIconSet(): ReadonlySet<IconName> {
	return getAvailableIconIds();
}

export function getFeaturedToolIconIds(
	limit = featuredToolIcons.length,
): IconName[] {
	const visibleIcons: IconName[] = [];
	const seenIcons = new Set<IconName>();

	for (const iconId of featuredToolIcons) {
		if (
			hiddenInitialIconIds.has(iconId) ||
			!getToolIconSet().has(iconId) ||
			seenIcons.has(iconId)
		) {
			continue;
		}

		visibleIcons.push(iconId);
		seenIcons.add(iconId);
		if (visibleIcons.length >= limit) {
			return visibleIcons;
		}
	}

	for (const entry of getToolIconEntries()) {
		if (hiddenInitialIconIds.has(entry.id) || seenIcons.has(entry.id)) {
			continue;
		}

		visibleIcons.push(entry.id);
		seenIcons.add(entry.id);
		if (visibleIcons.length >= limit) {
			return visibleIcons;
		}
	}

	return visibleIcons;
}

export function searchToolIconIds(query: string): IconName[] {
	const normalizedQuery = normalizeIconQuery(query);
	if (!normalizedQuery) {
		return getFeaturedToolIconIds();
	}

	const queryTerms = normalizedQuery.split(" ").filter(Boolean);
	const matches = getToolIconEntries()
		.map((entry) => {
			const exactMatch = entry.normalizedId === normalizedQuery;
			const prefixMatch = entry.normalizedId.startsWith(normalizedQuery);
			const termPrefixMatch = entry.terms.some((term) =>
				term.startsWith(normalizedQuery),
			);
			const includesAllTerms = queryTerms.every((term) =>
				entry.normalizedId.includes(term),
			);

			if (!exactMatch && !prefixMatch && !termPrefixMatch && !includesAllTerms) {
				return null;
			}

			let score = 0;
			if (exactMatch) {
				score += 4_000;
			}
			if (prefixMatch) {
				score += 2_000;
			}
			if (termPrefixMatch) {
				score += 1_000;
			}
			if (includesAllTerms) {
				score += 500;
			}

			score -= entry.normalizedId.length;

			return {
				id: entry.id,
				score,
			};
		})
		.filter((entry): entry is { id: IconName; score: number } => entry !== null)
		.sort(
			(left, right) =>
				right.score - left.score || left.id.localeCompare(right.id),
		);

	return matches.map((entry) => entry.id);
}
