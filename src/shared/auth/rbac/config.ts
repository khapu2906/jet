import { USER_ROLES } from "./roles";
import { Permissions } from "./permissions";

// ───────────────── Interfaces ─────────────────
interface PermissionConfig {
	name: string;
}

interface RoleConfig {
	name: string;
	permissions: string[];
}

interface RBACConfig {
	name: string;
	version: string;
	permissions: PermissionConfig[];
	roles: RoleConfig[];
}

// ───────────────── Config ─────────────────
export const config: RBACConfig = {
	name: "CreativeEvaluationTool",
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
		// ───── Maker ─────
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
