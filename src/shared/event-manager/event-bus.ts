import { Logger } from '@shared/logger';
import { DomainEvent } from './event'
import { EventHandler } from './event-handler'
import { EventBusConfig, EventBusRole } from "./factory";

export const EventBusKey = Symbol('EventBus')

export interface EventBus {
  start(): Promise<void>
  stop(): Promise<void>
  publish(event: DomainEvent): Promise<void>
  subscribe(handler: EventHandler): void
}

export abstract class CoreEventBus implements EventBus {
  protected handlers = new Map<string, EventHandler[]>()
  protected started = false
  protected static instanceCount = 0
  protected readonly instanceId: number
  protected readonly role: EventBusRole

  constructor(protected config: EventBusConfig) {
    this.instanceId = (this.constructor as typeof CoreEventBus).instanceCount
    ;(this.constructor as typeof CoreEventBus).instanceCount++
    this.role = config.role || 'full'
    this._log(`${this.constructor.name} instance #${this.instanceId} created (role: ${this.role})`)
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  protected abstract _publishInternal(event: DomainEvent): Promise<void>

  async publish(event: DomainEvent): Promise<void> {
    // Validate role
    if (this.role === 'consumer') {
      throw new Error('Consumer-only EventBus cannot publish events. Set EVENT_BUS_ROLE to "full" or "publisher".')
    }

    // Validate started state
    if (!this.started) {
      throw new Error('EventBus not started. Call start() first.')
    }

    this._log(`Instance #${this.instanceId} publishing event: ${event.name}`)
    this._log(`Event data: ${JSON.stringify(event.payload)}`)

    try {
      await this._publishInternal(event)
      this._log(`Event published successfully: ${event.name}`)
    } catch (error) {
      this._error(`Failed to publish event: ${event.name}: ${error}`)
      throw error
    }
  }

  subscribe(handler: EventHandler): void {
    // Publisher-only mode: no need to register handlers
    if (this.role === 'publisher') {
      this._log(`Skipping handler subscription (role: publisher): ${handler.eventName}`)
      return
    }

    const eventName = handler.eventName

    this._log(`Instance #${this.instanceId} subscribing to event: ${eventName} with handler: ${handler.constructor.name}`)

    // Validate event name if config.events is not '*'
    if (
      this.config.events !== '*' &&
      !this.config.events.includes(eventName)
    ) {
      Logger.warn(`Event name ${eventName} not exists in allowed events`)
      return;
    }

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, [])
    }

    this.handlers.get(eventName)!.push(handler)

    this._log(`Total handlers for ${eventName}: ${this.handlers.get(eventName)!.length}`)

    // Hook for child classes to react to new subscriptions
    this._onHandlerSubscribed(eventName, handler)
  }

  protected _onHandlerSubscribed(_eventName: string, _handler: EventHandler): void {
    // Override in child classes if needed
  }

  protected async _executeHandlers(event: DomainEvent, handlers: EventHandler[]): Promise<void> {
    if (handlers.length === 0) {
      this._log(`No handlers registered for event: ${event.name}`)
      return
    }

    this._log(`Processing event ${event.name} with ${handlers.length} handler(s)`)

    // Execute all handlers with error isolation
    const results = await Promise.allSettled(
      handlers.map(async (handler) => {
        this._log(`Executing handler: ${handler.constructor.name} for event ${event.name}`)
        try {
          await handler.handle(event)
          this._log(`Handler ${handler.constructor.name} completed successfully`)
          return { handler: handler.constructor.name, status: 'success' as const }
        } catch (handlerError) {
          this._error(`Handler ${handler.constructor.name} failed for ${event.name}: ${handlerError}`)
          return { handler: handler.constructor.name, status: 'failed' as const, error: handlerError }
        }
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length
    const failureCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'failed').length

    this._log(`Event ${event.name} processed: ${successCount} success, ${failureCount} failed`)
  }

  protected _log(message: string) {
    const debugLogAllow = process.env.EVENT_BUS_DEBUG === "true"

    if (debugLogAllow) {
      Logger.info(message)
    }
  }

  protected _error(message: string) {
    const debugLogAllow = process.env.EVENT_BUS_DEBUG === "true"

    if (debugLogAllow) {
      Logger.error(message)
    }
  }
}