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
