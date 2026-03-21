import { USER_ROLES } from "@shared/auth/rbac";
import { ConflictError, UnauthorizedError } from "@shared/errors";
import type { TokenIssuer } from "@shared/auth/providers/base";
import type { IAuthRepository, IAuthService } from "./contracts";
import type {
	LoginResponse,
	LoginType,
	RegisterResponse,
	RegisterType,
} from "./dto";
import { verifyPassword } from "./utils";

export class AuthService implements IAuthService {
	constructor(
		private readonly _repo: IAuthRepository,
		private readonly _tokenIssuer: TokenIssuer,
	) {}

	async register(input: RegisterType): Promise<RegisterResponse> {
		const existing = await this._repo.findCredentialByEmail(input.email);
		if (existing) throw new ConflictError("Email already registered");
		return this._repo.createUserWithIdentityAndCredential(input);
	}

	async login(input: LoginType): Promise<LoginResponse> {
		const credential = await this._repo.findCredentialByEmail(input.email);
		if (!credential) throw new UnauthorizedError("Invalid email or password");

		if (credential.isLocked) {
			throw new UnauthorizedError(
				"Account is temporarily locked. Try again later.",
			);
		}

		if (!verifyPassword(input.password, credential.passwordHash)) {
			await this._repo.incrementFailedAttempts(
				credential.id,
				credential.nextLockUntil,
			);
			throw new UnauthorizedError("Invalid email or password");
		}

		const identity = await this._repo.findIdentityByProviderUserId(
			credential.id,
		);
		if (!identity) throw new UnauthorizedError("Invalid email or password");

		await this._repo.resetFailedAttempts(credential.id);

		const token = this._tokenIssuer.sign({
			sub: identity.userId,
			userId: identity.userId,
			email: input.email,
			username: credential.username ?? undefined,
			role: USER_ROLES.NORMAL_USER,
			emailVerified: identity.emailVerified,
		});

		return {
			idToken: token,
			refreshToken: "",
			expiresIn: 3600,
			user: {
				id: identity.userId,
				email: input.email,
				username: credential.username ?? input.email,
				role: USER_ROLES.NORMAL_USER,
				emailVerified: identity.emailVerified,
			},
		};
	}
}
