import type { AuthCredential, AuthIdentity } from "./model";
import type { LoginType, RegisterType } from "./dto";
import type { UserRole } from "@shared/auth/rbac";

// ─────────────────────────────────────────────
// Auth response types
// ─────────────────────────────────────────────

export interface LoginResponse {
	idToken: string;
	refreshToken: string;
	expiresIn: number;
	user: {
		id: string;
		email: string;
		username: string;
		role: UserRole;
		emailVerified: boolean;
	};
}

// ─────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────

export const AuthRepositoryKey = Symbol("AuthRepository");

export interface IAuthRepository {
	findCredentialByEmail(email: string): Promise<AuthCredential | null>;
	findIdentityByProviderUserId(
		providerUserId: string,
	): Promise<AuthIdentity | null>;
	createUserWithIdentityAndCredential(
		input: RegisterType,
	): Promise<{ userId: string }>;
	incrementFailedAttempts(
		credentialId: string,
		lockUntil: Date | null,
	): Promise<void>;
	resetFailedAttempts(credentialId: string): Promise<void>;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export const AuthServiceKey = Symbol("AuthService");

export interface IAuthService {
	register(input: RegisterType): Promise<{ userId: string }>;
	login(input: LoginType): Promise<LoginResponse>;
}
