import { defineEvent } from "@event-bus-manager/core";

export const AuthResetedPassword = defineEvent<{
	email: string;
	username: string;
	resetLink: string;
}>("auth.password-reseted", "v1");
