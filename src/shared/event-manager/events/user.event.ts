import { defineEvent } from "@event-bus-manager/core";

export const UserCreated = defineEvent<{
	email: string;
	username: string;
}>("user.created", "v1");

export const UserUpdated = defineEvent<{
	email: string;
	username: string;
}>("user.updated", "v1");
