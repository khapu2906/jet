import type { AuthContext } from "../type";

export const AuthProviderKey = Symbol("AuthProvider");

export interface AuthProvider {
	verify(token: string): Promise<AuthContext | null>;
}

export const TokenIssuerKey = Symbol("TokenIssuer");

export interface TokenIssuer {
	sign(payload: Record<string, unknown>, expiresIn?: string): string;
}
