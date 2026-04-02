import { Queue, Worker as BullWorker } from 'bullmq'
import { CoreEventBus } from '../event-bus'
import { DomainEvent } from '../event'
import { EventHandler } from '../event-handler'
import type { EventBusConfig } from '../factory'
import { Logger } from '@shared/logger'

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

export class BullMQEventBus extends CoreEventBus {
  private readonly queues = new Map<string, Queue>()
  private readonly workers: BullWorker[] = []

  constructor(config: EventBusConfig) {
    super(config)
  }

  async start(): Promise<void> {
    this._log(`BullMQEventBus instance #${this.instanceId} starting (role: ${this.role})...`)

    if (this.role === 'consumer' || this.role === 'both') {
      for (const [eventName, handlers] of Array.from(this.handlers.entries())) {
        this._registerWorker(eventName, handlers)
      }
    }

    this.started = true
    this._log(`BullMQEventBus instance #${this.instanceId} started (role: ${this.role})`)
  }

  async stop(): Promise<void> {
    this._log(`Stopping BullMQEventBus instance #${this.instanceId}`)

    await Promise.all(this.workers.map(w => w.close()))
    await Promise.all(Array.from(this.queues.values()).map(q => q.close()))

    this.started = false
    this._log(`BullMQEventBus instance #${this.instanceId} stopped`)
  }

  protected async _publishInternal(event: DomainEvent): Promise<void> {
    const queue = this._getOrCreateQueue(event.name)

    await queue.add(event.name, event, {
      attempts: this.config.async.maxRetries,
      backoff: {
        type: 'fixed',
        delay: this.config.async.retryDelay,
      },
    })

    this._log(`Event queued: ${event.name}`)
  }

  protected _onHandlerSubscribed(eventName: string, _handler: EventHandler): void {
    if (this.started) {
      const handlers = this.handlers.get(eventName) || []
      this._registerWorker(eventName, handlers)
    }
  }

  private _getOrCreateQueue(eventName: string): Queue {
    if (!this.queues.has(eventName)) {
      const queue = new Queue(eventName, { connection: redisConnection })
      this.queues.set(eventName, queue)
    }
    return this.queues.get(eventName)!
  }

  private _registerWorker(eventName: string, handlers: EventHandler[]): void {
    this._getOrCreateQueue(eventName)

    const worker = new BullWorker(
      eventName,
      async (job) => {
        const event: DomainEvent = job.data
        this._log(`Processing job ${job.id} - event: ${eventName}`)
        await this._executeHandlers(event, handlers)
      },
      {
        connection: redisConnection,
        concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '1', 10),
      },
    )

    worker.on('failed', (job, err) => {
      Logger.error(`BullMQ job ${job?.id} failed for ${eventName}: ${err}`)
    })

    this.workers.push(worker)
    this._log(`Worker registered for event: ${eventName}`)
  }
}
