import { DomainEvent } from './event'

export interface EventHandler<T = unknown> {
	eventName: string
	handle(event: DomainEvent<T>): Promise<void>
}
