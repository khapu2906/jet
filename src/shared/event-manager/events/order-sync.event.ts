import { defineEvent } from "@event-bus-manager/core";

// Starting example event, generated alongside the order-sync-worker module —
// rename/extend freely, or delete this file (and its export in ./index.ts)
// if the module only handles events another module already defines here.
export const OrderSyncRequested = defineEvent<{
	id: string;
}>("order-sync.requested", "v1");
