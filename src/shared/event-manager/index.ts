import "@shared/logger"; // Ensure CoreLogger is configured before EventBus uses it
import { createEventBus as _createEventBus } from "@event-bus-manager/core";
import { eventBusConfig } from "@shared/config/event-bus";

export type {
	EventBus,
	DomainEvent,
	EventHandler,
	PayloadOf,
} from "@event-bus-manager/core";
export { createEvent } from "@event-bus-manager/core";

// DI key — belongs to app layer, not the package
export const EventBusKey = Symbol("EventBus");

export function createEventBus() {
	return _createEventBus(eventBusConfig);
}
