import type {
	BlockTargetContext,
	BlockWrapperMode,
} from "../../editor/block-targets";
import type { ScanRange } from "../../editor/decorations/types";
import type { StyleType } from "../../styles/types";

export interface PlannedEdit extends ScanRange {
	readonly text: string;
	readonly sequence: number;
	readonly affinity?: InsertAffinity;
}

export interface StyleSelectionRange extends ScanRange {
	readonly wrapperMode?: BlockWrapperMode;
}

export interface PlannedWrapper extends StyleSelectionRange {
	readonly tag: string;
}

export type InsertAffinity = "before" | "after";
export type BlockTargetContextProvider = () => BlockTargetContext;
export type VariantRemovalResult = "removed" | "not-styled" | "failed";
export type VariantApplyResult = "applied" | "unchanged" | "failed";

export interface VariantRemovalOptions {
	readonly tagPrefix: string;
	readonly styleType: StyleType;
	readonly selectionRanges: readonly ScanRange[];
}

export interface VariantApplyOptions extends VariantRemovalOptions {
	readonly variantName: string;
	readonly toolKey?: string;
}

export interface RemovableVariantStyle extends VariantRemovalOptions {
	readonly variantName: string;
	readonly menuTitle: string;
	readonly icon?: string;
}
