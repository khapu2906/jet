export interface DomainEvent<T = unknown> {
	name: string
	payload: T
	occurredAt: Date
}

export function createEvent<T>(
	name: string,
	payload: T
): DomainEvent<T> {
	return {
		name,
		payload,
		occurredAt: new Date()
	}
}
