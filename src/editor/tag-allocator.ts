import type { TagToken } from "./decorations/types";
import { buildVariantTag, maxCounterIndex } from "./tag-format";

export type TagAllocator = (tagPrefix: string) => string | null;

export function createTagAllocator(
	tokens: readonly Pick<TagToken, "tagPrefix" | "counterIndex">[],
): TagAllocator {
	const usedCountersByPrefix = new Map<string, Set<number>>();
	const nextCounterIndexByPrefix = new Map<string, number>();

	for (const token of tokens) {
		let usedCounters = usedCountersByPrefix.get(token.tagPrefix);
		if (!usedCounters) {
			usedCounters = new Set<number>();
			usedCountersByPrefix.set(token.tagPrefix, usedCounters);
		}

		usedCounters.add(token.counterIndex);
	}

	return (tagPrefix: string) => {
		let usedCounters = usedCountersByPrefix.get(tagPrefix);
		if (!usedCounters) {
			usedCounters = new Set<number>();
			usedCountersByPrefix.set(tagPrefix, usedCounters);
		}

		let counterIndex = nextCounterIndexByPrefix.get(tagPrefix) ?? 0;
		while (counterIndex < maxCounterIndex && usedCounters.has(counterIndex)) {
			counterIndex += 1;
		}

		if (counterIndex >= maxCounterIndex) {
			nextCounterIndexByPrefix.set(tagPrefix, maxCounterIndex);
			return null;
		}

		usedCounters.add(counterIndex);
		nextCounterIndexByPrefix.set(tagPrefix, counterIndex + 1);
		return buildVariantTag(tagPrefix, counterIndex);
	};
}
