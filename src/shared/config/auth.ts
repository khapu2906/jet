/**
 * Authentication configuration
 * 
 * Note: This configuration is minimal as authentication is now handled entirely via AWS Cognito.
 * Login, token generation, and token refresh should be handled via Cognito SDK or frontend.
 */

// This file is kept for backwards compatibility but is no longer used
// All authentication is now handled through AWS Cognito
export const authConfig = {
	// Token configuration (for reference only)
	tokenExpiry: 3600, // 1 hour in seconds (Cognito default)
	refreshTokenExpiry: 604800, // 7 days in seconds (Cognito default)
};
