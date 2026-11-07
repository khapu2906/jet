import type { CreateUserInput, CreateUserResult } from "../dto";

// Public surface of the user module. Another module depending on user gets
// UserServiceKey via `imports` + UserModule.share(to), and nothing else.
export const UserServiceKey = Symbol("UserService");

export interface IUserService {
	createUser(input: CreateUserInput): Promise<CreateUserResult>;
}
