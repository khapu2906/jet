import { CoreEventBus } from './../event-bus';
import { DomainEvent } from './../event';
import type { EventBusConfig } from './../factory'

export class InMemoryEventBus extends CoreEventBus {
  constructor(config: EventBusConfig) {
    super(config)
  }

  async start(): Promise<void> {
    this._log(`InMemoryEventBus instance #${this.instanceId} starting (role: ${this.role})...`)
    this._log(`Registered handlers at start time: ${this.handlers.size} events`)
    
    this.started = true
    this._log(`InMemoryEventBus instance #${this.instanceId} started (role: ${this.role})`)
  }

  async stop(): Promise<void> {
    this._log(`Stopping InMemoryEventBus instance #${this.instanceId}`)
    this.started = false
    this._log(`InMemoryEventBus instance #${this.instanceId} stopped`)
  }

  protected async _publishInternal(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.name) || []
    await this._executeHandlers(event, handlers)
  }
}