import { USER_ROLES } from "@/shared/auth/rbac";
import * as v from "valibot";

export const RegisterDto = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8)),
	username: v.optional(v.pipe(v.string(), v.minLength(3))),
});
export type RegisterType = v.InferOutput<typeof RegisterDto>;

export const LoginDto = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(1)),
});
export type LoginType = v.InferOutput<typeof LoginDto>;

export const RegisterResponseDto = v.object({
	id: v.string(),
	email: v.optional(v.string()),
	username: v.optional(v.string()),
});
export type RegisterResponse = v.InferOutput<typeof RegisterResponseDto>;

export const UserRoleDto = v.union([
	v.literal(USER_ROLES.NORMAL_USER),
	v.literal(USER_ROLES.SYSTEM_ADMIN),
]);

export const AuthUserDto = v.object({
	id: v.string(),
	email: v.pipe(v.string(), v.email()),
	username: v.string(),
	role: UserRoleDto,
	emailVerified: v.boolean(),
});
export type AuthUser = v.InferOutput<typeof AuthUserDto>;

// Login Response DTO (FULL)
export const LoginResponseDto = v.object({
	idToken: v.string(),
	refreshToken: v.string(),
	expiresIn: v.number(),
	user: AuthUserDto,
});

// Type auto infer
export type LoginResponse = v.InferOutput<typeof LoginResponseDto>;
