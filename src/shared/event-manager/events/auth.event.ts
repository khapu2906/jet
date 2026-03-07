export type PasswordResetPayload = {
	email: string
	username: string
	resetLink: string
}

export const PASSWORD_RESET_EVENT = 'auth.password-reset'