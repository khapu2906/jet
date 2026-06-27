import * as v from "valibot";
import { resolve } from "node:path";
import { parseEnv, envNumber } from "@shared/config/env";

const StorageEnvSchema = v.object({
	STORAGE_PROVIDER: v.optional(v.picklist(["local"]), "local"),
	// Local — STORAGE_LOCAL_DIR nên là absolute path trong .env
	// Default: <cwd>/.tmp/storage (works khi chạy từ backends/api-server/)
	STORAGE_LOCAL_DIR: v.optional(v.string(), ""),
	STORAGE_LOCAL_BASE_URL: v.optional(
		v.string(),
		"http://localhost:2906/storage",
	),
	STORAGE_LOCAL_SECRET: v.optional(v.string(), "change-me-in-production"),
	DEFAULT_STORAGE_EXPIRES: envNumber(60 * 5),
});

const env = parseEnv(StorageEnvSchema);

export const storageConfig = {
	provider: env.STORAGE_PROVIDER as "local",
	local: {
		// Ưu tiên env var (nên là absolute path).
		// Fallback: resolve từ cwd — đảm bảo chạy `yarn dev` từ backends/api-server/
		dir: env.STORAGE_LOCAL_DIR
			? resolve(env.STORAGE_LOCAL_DIR)
			: resolve(process.cwd(), ".tmp", "storage"),
		baseUrl: env.STORAGE_LOCAL_BASE_URL,
		secret: env.STORAGE_LOCAL_SECRET,
		defaultStorageExpries: env.DEFAULT_STORAGE_EXPIRES,
	},
};
