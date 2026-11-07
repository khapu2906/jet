import * as v from "valibot";

export const CreateUserDto = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8)),
	username: v.optional(v.pipe(v.string(), v.minLength(3))),
});
export type CreateUserInput = v.InferOutput<typeof CreateUserDto>;

export const CreateUserResponseDto = v.object({
	id: v.string(),
	email: v.optional(v.string()),
});
export type CreateUserResult = v.InferOutput<typeof CreateUserResponseDto>;
