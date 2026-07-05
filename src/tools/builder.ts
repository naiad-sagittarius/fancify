import {
	formatKeySegment,
	maxKeySegmentIndex,
	type KeySegment,
} from "./key-format";

// build tool id => "fancify" + toolKey
export function buildToolId(toolKey: KeySegment): string {
	return `fancify${toolKey}`;
}

// build variant id => "fancify" + toolKey + variantKey
export function buildVariantId(
	toolKey: KeySegment,
	variantKey: KeySegment,
): string {
	return `${buildToolId(toolKey)}${variantKey}`;
}

// build tag prefix for variant
export function buildTagPrefix(
	toolKey: KeySegment,
	variantKey: KeySegment,
): string {
	return `{{${toolKey}${variantKey}`;
}

// build keys for tools and variants
export function buildKey<T>(
	objects: T[],
	getKey: (object: T) => KeySegment,
): KeySegment {
	// check for used keys
	const usedKeys = new Set<string>();

	for (const obj of objects) {
		usedKeys.add(getKey(obj));
	}

	// find the first available key
	for (let index = 0; index < maxKeySegmentIndex; index += 1) {
		const key = formatKeySegment(index);
		if (!usedKeys.has(key)) {
			return key;
		}
	}

	throw new Error(
		"You have reached the maximum number of tools/variants",
	);
}
