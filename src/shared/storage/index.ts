export { StorageKey } from "./base";
export type { IStorage, UploadOptions } from "./base";
export { LocalStorage } from "./providers/local";
export { storageConfig } from "@shared/config/storage";

import { storageConfig } from "@shared/config/storage";
import { LocalStorage } from "./providers/local";
import type { IStorage } from "./base";

export function createStorage(): IStorage {
	return new LocalStorage(
		storageConfig.local.dir,
		storageConfig.local.baseUrl,
		storageConfig.local.secret,
	);
}
