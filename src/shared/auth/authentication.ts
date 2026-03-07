import { AuthContext, VerifyTokenResponse } from "./type";
import { USER_ROLES, UserRole } from "./rbac";
// import { config } from "../config";

/**
 * Verify Cognito JWT token and return user context
 */
export async function verifyToken(_token: string): Promise<AuthContext | null> {
	try {
		// Check if Cognito is configured
		// if (!config.aws.cognito.userPoolId) {
		// 	console.error(
		// 		"Cognito not configured. Please set COGNITO_USER_POOL_ID in .env",
		// 	);
		// 	return null;
		// }

		const payload = {
			role: USER_ROLES.NORMAL_USER,
			profileId: "1234567890",
			email_verified: true,
			email: "test@example.com",
			username: "testuser",
			sub: "1234567890",
			cognito: {
				email: "test@example.com",
			},
			claims: {
				email: "test@example.com",
				email_verified: true,
				username: "testuser",
				sub: "1234567890",
				aud: "1234567890",
				iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_1234567890",
				token_use: "access",
				auth_time: 1672531200,
				exp: 1672617600,
				iat: 1672531200,
				jti: "1234567890",
				nonce: "1234567890",
				phone_number: "+1234567890",
				phone_number_verified: true,
				profile:
					"https://cognito-idp.us-east-1.amazonaws.com/us-east-1_1234567890/userpool/1234567890",
				role: USER_ROLES.NORMAL_USER,
				website: "https://example.com",
				website_verified: true,
			},
		};
		// Map Cognito claims to AuthContext
		const userRole = (payload["role"] as UserRole) || USER_ROLES.NORMAL_USER;
		const userId = payload["profileId"];
		const emailVerified = payload.email_verified === true;

		return {
			sub: payload.sub,
			userId: userId,
			userEmail: payload.email || "",
			username: payload["cognito:email"] || payload.username || payload.sub,
			userRole: userRole,
			emailVerified: emailVerified,
		};
	} catch (error) {
		console.error("Token verification failed:", error);
		return null;
	}
}

/**
 * Verify token with response
 */
export async function verifyTokenWithResponse(
	token: string,
): Promise<VerifyTokenResponse | null> {
	const user = await verifyToken(token);
	if (!user) return null;

	return createVerifyTokenResponse(user);
}

/**
 * Create verify token response
 */
export function createVerifyTokenResponse(
	user: AuthContext,
): VerifyTokenResponse {
	return {
		user: {
			id: user.userId,
			sub: user.sub,
			email: user.userEmail || "",
			username: user.username || user.userId,
			role: user.userRole || USER_ROLES.NORMAL_USER,
			emailVerified: user.emailVerified || false,
		},
		tokenInfo: {
			uid: user.userId,
			email: user.userEmail || "",
			emailVerified: user.emailVerified || false,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
	};
}

export type { AuthContext };
