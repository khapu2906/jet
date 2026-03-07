export * from "./event-handler";
export * from "./event";
export * from "./events";
export * from "./factory";

import { DomainEvent } from "./event";
import { EventHandler } from "./event-handler";

export const EventBusKey = Symbol("EventBus");

export interface EventBus {
	start(): Promise<void>;
	stop(): Promise<void>;
	publish(event: DomainEvent): Promise<void>;
	subscribe(handler: EventHandler): void;
}
