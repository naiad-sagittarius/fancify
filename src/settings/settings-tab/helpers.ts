import { getAllProperties } from "../../styles/properties";
import type { PropertyTokenMap, StyleField, StyleType } from "../../styles/types";

export function getDisplayName(value: string, fallback: string): string {
	const trimmedValue = value.trim();
	return trimmedValue || fallback;
}

export function getAffectedProperties(
	currentPropertyTokenMap: PropertyTokenMap,
	nextPropertyTokenMap: PropertyTokenMap,
): Set<string> {
	return new Set<string>([
		...Object.keys(currentPropertyTokenMap),
		...Object.keys(nextPropertyTokenMap),
	]);
}

export function getAvailableProperties(
	styleFields: StyleField[],
	styleType: StyleType,
): string[] {
	const usedProperties = new Set(styleFields.map((field) => field.property));
	return getAllProperties()
		.filter(
			(definition) =>
				definition.styleType.includes(styleType) &&
				!usedProperties.has(definition.property),
		)
		.map((definition) => definition.property);
}
