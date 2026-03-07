import jwt, { type SignOptions } from "jsonwebtoken";
import type { AuthContext } from "../type";
import type { AuthProvider, TokenIssuer } from "./base";
import { USER_ROLES, type UserRole } from "../rbac";
import { authConfig } from "@shared/config/auth";

export interface InternalJwtPayload {
	sub: string;
	userId: string;
	email: string;
	username?: string;
	role: UserRole;
	emailVerified: boolean;
	iat?: number;
	exp?: number;
}

export class InternalAuthProvider implements AuthProvider, TokenIssuer {
	async verify(token: string): Promise<AuthContext | null> {
		try {
			const payload = jwt.verify(token, authConfig.jwtSecret) as InternalJwtPayload;
			return {
				sub: payload.sub,
				userId: payload.userId,
				userEmail: payload.email,
				username: payload.username,
				userRole: payload.role ?? USER_ROLES.NORMAL_USER,
				emailVerified: payload.emailVerified ?? false,
				iat: payload.iat,
				exp: payload.exp,
			};
		} catch {
			return null;
		}
	}

	sign(payload: Record<string, unknown>, expiresIn = "1h"): string {
		return jwt.sign(payload as object, authConfig.jwtSecret, { expiresIn } as SignOptions);
	}
}

export const internalAuthProvider = new InternalAuthProvider();
