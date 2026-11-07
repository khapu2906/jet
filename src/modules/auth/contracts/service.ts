import type { LoginResponse, LoginType, RegisterResponse, RegisterType } from "../dto";

// This is the file another module is meant to depend on if it needs
// something from auth (e.g. a future `user` module) — via
// `imports` + AuthModule.share(to) binding AuthServiceKey.
// It deliberately does not import ./repository.ts (the sibling contract),
// so depending on this file alone never pulls in anything repository-shaped.
export const AuthServiceKey = Symbol("AuthService");

export interface IAuthService {
	register(input: RegisterType): Promise<RegisterResponse>;
	login(input: LoginType): Promise<LoginResponse>;
}
