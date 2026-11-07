import type { IAuthService } from "../auth/contracts/service";
import type { IUserService } from "./contracts/service";
import type { CreateUserInput, CreateUserResult } from "./dto";

export class UserService implements IUserService {
	// IAuthService arrives through UserModule.share(to) — auth's public
	// surface, not its repository or concrete service class.
	constructor(private readonly _auth: IAuthService) {}

	async createUser(input: CreateUserInput): Promise<CreateUserResult> {
		const user = await this._auth.register(input);
		return { id: user.id, email: user.email };
	}
}
