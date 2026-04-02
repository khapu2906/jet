import { EventHandler } from './../event-handler'
import { CoreEventBus } from './../event-bus';
import { DomainEvent } from './../event';
import type { EventBusConfig } from './../factory'
import { PgBoss } from 'pg-boss'
import type PgBossType from 'pg-boss'
import { connectionString } from '../../db'
import { Logger } from '@shared/logger';

interface QueueStats {
  name: string
  size: number
  createdOn?: Date
  completed?: number
  failed?: number
}

export class PgBossEventBus extends CoreEventBus {
  private boss: PgBoss

  constructor(config: EventBusConfig) {
    super(config)
    this.boss = new PgBoss(connectionString)
    this._setupErrorHandling()
  }

  async start(): Promise<void> {
    this._log(`PgBossEventBus instance #${this.instanceId} starting (role: ${this.role})...`)
    this._log(`Registered handlers at start time: ${this.handlers.size} events`)

    await this.boss.start().then(() => {
      this._log('PgBoss schema created successfully')
    }).catch((err) => {
      Logger.error('PgBoss failed to create schema:', err)
      throw err
    })
    this._log(`PgBoss instance started`)

    // Only register workers when role is consumer or both
    if (this.role === 'consumer' || this.role === 'both') {
      for (const [eventName, handlers] of Array.from(this.handlers.entries())) {
        this._log(`Registering worker for event: ${eventName} (${handlers.length} handlers)`)
        await this._registerWorker(eventName, handlers)
      }
    } else {
      this._log(`Skipping worker registration (role: ${this.role})`)
    }

    this.started = true
    this._log(`PgBossEventBus instance #${this.instanceId} started (role: ${this.role})`)
  }

  async stop(): Promise<void> {
    this._log(`Stopping PgBossEventBus instance #${this.instanceId}`)
    await this.boss.stop()
    this.started = false
    this._log(`PgBossEventBus instance #${this.instanceId} stopped`)
  }

  protected async _publishInternal(event: DomainEvent): Promise<void> {
    await this.boss.send(event.name, event)

    // Check queue stats after publish
    try {
      const stats = await this.boss.getQueue(event.name) as unknown as QueueStats
      this._log(`Queue stats for ${event.name}: ${JSON.stringify({
        size: stats.size,
        createdOn: stats.createdOn,
        completed: stats.completed,
        failed: stats.failed
      })}`)
    } catch (err) {
      this._log(`Could not get queue stats: ${err}`)
    }
  }

  protected _onHandlerSubscribed(eventName: string, handler: EventHandler): void {
    // If already started, register worker immediately
    if (this.started) {
      this._log(`EventBus already started, registering worker immediately for ${eventName}`)
      this._registerWorker(eventName, [handler])
    }
  }

  async getEventStats(eventName: string): Promise<QueueStats> {
    const stats = await this.boss.getQueue(eventName) as unknown as QueueStats
    return stats
  }

  async getAllEventStats(): Promise<Array<QueueStats & { eventName: string }>> {
    const stats = []
    for (const eventName of Array.from(this.handlers.keys())) {
      const stat = await this.getEventStats(eventName)
      stats.push({ eventName, ...stat })
    }
    return stats
  }

  private async _registerWorker(eventName: string, handlers?: EventHandler[]): Promise<void> {
    this._log(`Instance #${this.instanceId} registering worker for: ${eventName}`)

    try {
      await this.boss.createQueue(eventName)
      this._log(`Queue created/verified: ${eventName}`)
    } catch (err) {
      Logger.warn(`Queue creation warning for ${eventName}: ${err}`)
    }

    const workerHandlers = handlers || this.handlers.get(eventName) || []
    this._log(`Setting up ${workerHandlers.length} handler(s) for event: ${eventName}`)

    await this.boss.work(eventName, async (jobs: Array<PgBossType.Job<DomainEvent>>) => {
      this._log(`Worker received ${jobs.length} job(s) for ${eventName}`)

      // Process each job in the batch
      for (const job of jobs) {
        const event: DomainEvent = job.data

        try {
          this._log(`Processing job ${job.id} - event: ${eventName}`)
          await this._executeHandlers(event, workerHandlers)
          this._log(`Batch completed: processed ${jobs.length} job(s) for ${eventName}`)
        } catch (error) {
          this._error(`Critical failure processing job ${job.id} - event: ${eventName} - error: ${error}`)
          throw error
        }
      }
    })

    this._log(`Worker registered successfully for event: ${eventName}`)
  }

  private _setupErrorHandling(): void {
    (this.boss as unknown as NodeJS.EventEmitter).on('error', (error: Error) => {
      this._error(`PgBossEventBus instance #${this.instanceId} error: ${error}`)
    })
  }
}