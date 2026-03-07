/**
 * Permission definitions for Creative Evaluation Tool
 * Compatible with bitmask (≤ 31) & Fire Shield wildcard matching
 */

export const Permissions = {
	// ───────────────── User ─────────────────
	USER_PROFILE_VIEW: "user:profile:view",
	USER_PROFILE_MANAGE: "user:profile:manage",
	USER_VIEW: "user:view",
	USER_MANAGE: "user:manage",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
