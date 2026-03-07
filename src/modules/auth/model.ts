const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export class AuthCredential {
	constructor(
		readonly id: string,
		readonly email: string,
		readonly username: string | null,
		readonly passwordHash: string,
		readonly failedLoginAttempts: number,
		readonly lockedUntil: Date | null,
		readonly lastLoginAt: Date | null,
	) {}

	get isLocked(): boolean {
		return this.lockedUntil !== null && this.lockedUntil > new Date();
	}

	get nextLockUntil(): Date | null {
		return this.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS
			? new Date(Date.now() + LOCK_DURATION_MS)
			: null;
	}
}

export class AuthIdentity {
	constructor(
		readonly id: string,
		readonly userId: string,
		readonly provider: string,
		readonly providerUserId: string,
		readonly email: string | null,
		readonly emailVerified: boolean,
	) {}
}
