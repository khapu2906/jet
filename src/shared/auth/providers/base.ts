import type { AuthContext } from "../type";

export const AuthProviderKey = Symbol("AuthProvider");

export interface AuthProvider {
	/** get token/key from HTTP request. Each provider decide extract. */
	extractToken(headers: Record<string, string | undefined>): string | null;
	/** verify token/key and return AuthContext. */
	verify(token: string): Promise<AuthContext | null>;
}

export const TokenIssuerKey = Symbol("TokenIssuer");

export interface TokenIssuer {
	sign(payload: Record<string, unknown>, expiresIn?: string): string;
}
