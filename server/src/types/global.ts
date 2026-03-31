import type { NyxContext } from "@/app";

export type NyxSharedContext = {
	singleton: NyxContext["~Singleton"];
	definitions: NyxContext["~Definitions"];
	metadata: NyxContext["~Metadata"];
};
