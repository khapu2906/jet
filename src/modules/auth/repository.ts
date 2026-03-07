import { eq, sql } from "drizzle-orm";
import type { Database } from "@shared/db";
import { users, identities, authCredentials } from "@shared/db/schema";
import { PROVIDERS } from "@shared/db/schema/indentities";
import type { IAuthRepository } from "./contracts";
import { hashPassword } from "./utils";
import { AuthCredential, AuthIdentity } from "./model";
import type { RegisterType } from "./dto";

export class AuthRepository implements IAuthRepository {
	constructor(private readonly _access: Database) {}

	async findCredentialByEmail(email: string): Promise<AuthCredential | null> {
		const row = await this._access.query.authCredentials.findFirst({
			where: eq(authCredentials.email, email),
		});
		if (!row) return null;
		return new AuthCredential(
			row.id,
			row.email,
			row.username,
			row.passwordHash,
			row.failedLoginAttempts,
			row.lockedUntil,
			row.lastLoginAt,
		);
	}

	async findIdentityByProviderUserId(
		providerUserId: string,
	): Promise<AuthIdentity | null> {
		const row = await this._access.query.identities.findFirst({
			where: eq(identities.providerUserId, providerUserId),
		});
		if (!row) return null;
		return new AuthIdentity(
			row.id,
			row.userId,
			row.provider,
			row.providerUserId,
			row.email,
			row.emailVerified,
		);
	}

	async createUserWithIdentityAndCredential(
		input: RegisterType,
	): Promise<{ userId: string }> {
		return this._access.transaction(async (tx) => {
			const [user] = await tx
				.insert(users)
				.values({ email: input.email })
				.returning({ id: users.id });

			const [credential] = await tx
				.insert(authCredentials)
				.values({
					email: input.email,
					username: input.username,
					passwordHash: hashPassword(input.password),
				})
				.returning({ id: authCredentials.id });

			await tx.insert(identities).values({
				userId: user.id,
				provider: PROVIDERS.INTERNAL,
				providerUserId: credential.id,
				email: input.email,
				emailVerified: false,
			});

			return { userId: user.id };
		});
	}

	async incrementFailedAttempts(
		credentialId: string,
		lockUntil: Date | null,
	): Promise<void> {
		await this._access
			.update(authCredentials)
			.set({
				failedLoginAttempts: sql`${authCredentials.failedLoginAttempts} + 1`,
				lockedUntil: lockUntil,
			})
			.where(eq(authCredentials.id, credentialId));
	}

	async resetFailedAttempts(credentialId: string): Promise<void> {
		await this._access
			.update(authCredentials)
			.set({
				failedLoginAttempts: 0,
				lockedUntil: null,
				lastLoginAt: new Date(),
			})
			.where(eq(authCredentials.id, credentialId));
	}
}
