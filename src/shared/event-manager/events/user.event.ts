export type UserCreatedPayload = {
	email: string
	username: string
	tempPassword?: string
}

export const USER_CREATED_EVENT = 'user.created'


export type UserUpdatedPayload = {
	email: string
	username: string
}

export const USER_UPDATED_EVENT = 'user.updated'
