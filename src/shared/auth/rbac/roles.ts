/**
 * User roles in the Creative Evaluation Tool system
 */

export const USER_ROLES = {
	NORMAL_USER: "normal_user",
	SYSTEM_ADMIN: "system_admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
