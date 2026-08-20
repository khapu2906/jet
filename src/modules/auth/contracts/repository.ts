import type { AuthCredential, AuthIdentity } from "../model";
import type { RegisterResponse, RegisterType } from "../dto";

// Kept in its own file under contracts/ (not merged into ../repository.ts,
// not shared with ./service.ts) so ArchSafe classifies it under the
// "repository" layer specifically — see archsafe.config.mts, which globs
// this file alongside ../repository.ts into that same layer. This is what
// makes forbid(routes, repository) also catch routes.ts resolving
// IAuthRepository directly, bypassing service.ts.
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
