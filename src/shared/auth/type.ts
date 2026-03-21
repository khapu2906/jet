import type { UserRole } from "./rbac";

export interface AuthContext {
	userId: string;
	userEmail?: string;
	userRole?: UserRole;
	emailVerified?: boolean;
	username?: string;
	firstName?: string;
	lastName?: string;
	avatar?: string;
	bio?: string;
	createdAt?: string;
	updatedAt?: string;
	sub: string;
	/** JWT issued-at (unix seconds) — populated from token payload */
	iat?: number;
	/** JWT expiry (unix seconds) — populated from token payload */
	exp?: number;
}

export interface UserCredentials {
	userEmail: string;
	password: string;
	userId: string;
}

export interface TokenUserMap {
	[token: string]: string;
}

export interface VerifyTokenResponse {
	user: {
		id: string;
		sub: string;
		email: string;
		username: string;
		role: UserRole;
		emailVerified: boolean;
	};
	tokenInfo: {
		uid: string;
		email: string;
		emailVerified: boolean;
		iat: number;
		exp: number;
	};
}
