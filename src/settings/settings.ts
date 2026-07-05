import type { StyleToken } from "../styles/types";
import type { Tool } from "../tools/types";

export interface FancifySettings {
	tools: Tool[];
	tokens: StyleToken[];
}

export function createDefaultSettings(): FancifySettings {
	return {
		tools: [],
		tokens: [],
	};
}
