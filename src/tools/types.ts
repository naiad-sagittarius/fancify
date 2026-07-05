import type { PropertyTokenMap, StyleField, StyleType } from "../styles/types";
import type { KeySegment } from "./key-format";

export interface Tool {
	id: string;
	name: string;
	type: StyleType;
	icon?: string;
	toolKey: KeySegment;
	styleFields: StyleField[];
	variants: Variant[];
}

export interface Variant {
	id: string;
	name: string;
	commandName?: string;
	variantKey: KeySegment;
	tagPrefix: string;
	variantTokens: PropertyTokenMap;
	icon?: string;
}
