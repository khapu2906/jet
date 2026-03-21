import type { Context } from "hono";

// Get user ID from context
export const getUserId = (c: Context): string | null => {
	return c.get("userId") || null;
};

// Get user email from context
export const getUserEmail = (c: Context): string | null => {
	return c.get("userEmail") || null;
};

// Get user role from context
export const getUserRole = (c: Context): string | null => {
	return c.get("userRole") || null;
};

// Get email verified status from context
export const getEmailVerified = (c: Context): boolean => {
	return c.get("emailVerified") || false;
};
