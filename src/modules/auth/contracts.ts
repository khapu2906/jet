import type { AuthCredential, AuthIdentity } from "./model";
import type {
	LoginResponse,
	LoginType,
	RegisterResponse,
	RegisterType,
} from "./dto";

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
	): Promise<RegisterResponse>;
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
	register(input: RegisterType): Promise<RegisterResponse>;
	login(input: LoginType): Promise<LoginResponse>;
}
