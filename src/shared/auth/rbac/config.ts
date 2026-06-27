import { USER_ROLES } from "./roles";
import { Permissions } from "./permissions";
import type { PresetConfig } from "@fire-shield/core";

// ───────────────── Config ─────────────────
export const config: PresetConfig = {
	name: "Jet Framework",
	version: "v1",

	// ─────────────── Permissions registry ───────────────
	permissions: [
		// User
		{ name: Permissions.USER_PROFILE_VIEW },
		{ name: Permissions.USER_PROFILE_MANAGE },
		{ name: Permissions.USER_VIEW },
		{ name: Permissions.USER_MANAGE },
	],

	// ─────────────── Role definitions ───────────────
	roles: [
		// ───── Normal User ─────
		{
			name: USER_ROLES.NORMAL_USER,
			permissions: [
				Permissions.USER_PROFILE_VIEW,
				Permissions.USER_PROFILE_MANAGE,
			],
		},

		// ───── System Admin ─────
		{
			name: USER_ROLES.SYSTEM_ADMIN,
			permissions: [
				Permissions.USER_PROFILE_VIEW,
				Permissions.USER_PROFILE_MANAGE,
				Permissions.USER_VIEW,
				Permissions.USER_MANAGE,
			],
		},
	],
};
