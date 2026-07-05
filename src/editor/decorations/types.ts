import type { StyleType } from "../../styles/types";

export interface ScanRange {
	readonly from: number;
	readonly to: number;
}

export interface TagToken extends ScanRange {
	readonly groupId: string;
	readonly tagPrefix: string;
	readonly counterIndex: number;
	readonly text: string;
	readonly cssClass: string;
	readonly styleType: StyleType;
}

export interface StyledRange extends ScanRange {
	readonly cssClass: string;
	readonly styleType: StyleType;
}

export interface TagPair {
	readonly openingTag: TagToken;
	readonly closingTag: TagToken;
}

export type InvalidTagReason = "unknown-prefix" | "unpaired";

export interface InvalidTag extends ScanRange {
	readonly text: string;
	readonly tagPrefix: string;
	readonly groupId: string;
	readonly counterIndex: number;
	readonly reason: InvalidTagReason;
}

export interface BuildResult {
	readonly nodes: StyledRange[];
	readonly tagPairs: TagPair[];
	readonly invalidTags: InvalidTag[];
	readonly needsWiderScan: boolean;
}
