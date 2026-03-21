import { createSuccessResponseDto } from "@/shared/dto";
import {
	LoginDto,
	LoginResponseDto,
	RegisterDto,
	RegisterResponseDto,
} from "./dto";

export const docs = {
	register: {
		tag: "Auth",
		description: "Register new user",
		request: RegisterDto,
		response: createSuccessResponseDto(RegisterResponseDto),
		status: 201,
	},
	login: {
		tag: "Auth",
		description: "User login",
		request: LoginDto,
		response: createSuccessResponseDto(LoginResponseDto),
	},
};
