import { EventBus } from './event-bus'
import { InMemoryEventBus } from './infras/InMemoryEventBus'
import { PgBossEventBus } from './infras/PgBossEventBus'
import { Logger } from '@shared/logger';

export type EventBusType = 'memory' | 'pgboss'
export type EventBusRole = 'both' | 'publisher' | 'consumer'
export type EventBusEvents = '*' | Array<string>

export interface EventBusAsyncConfig {
  maxRetries: number
  retryDelay: number
  eventTTL: string
  archiveInterval: string
  deleteArchivedInterval: string
}

export interface EventBusConfig {
  type: EventBusType
  role: EventBusRole
  events: EventBusEvents
  async: EventBusAsyncConfig
}

/**
 * Resolve EventBus type from environment or defaults
 * Priority: ENV > Cluster detection > Default (memory)
 */
function resolveEventBusType(): EventBusType {
  const envType = process.env.EVENT_BUS_TYPE?.toLowerCase()

  if (envType) {
    if (!['memory', 'pgboss'].includes(envType)) {
      Logger.warn(`Invalid EVENT_BUS_TYPE: ${envType}. Using default.`)
    } else {
      return envType as EventBusType
    }
  }

  // Force PgBoss when cluster mode is enabled (InMemory won't work across processes)
  if (process.env.CLUSTER_ENABLED === 'true') {
    Logger.info('Cluster mode detected, using pgboss EventBus')
    return 'pgboss'
  }

  return 'memory'
}

/**
 * Resolve EventBus role from environment or default to 'both'
 */
function resolveEventBusRole(): EventBusRole {
  const envRole = process.env.EVENT_BUS_ROLE?.toLowerCase()

  if (envRole) {
    if (!['both', 'publisher', 'consumer'].includes(envRole)) {
      Logger.warn(`Invalid EVENT_BUS_ROLE: ${envRole}. Using 'both'.`)
      return 'both'
    }
    return envRole as EventBusRole
  }

  return 'both'
}

/**
 * Resolve allowed events from environment
 * Returns '*' for all events or array of specific event names
 */
function resolveEventBusEvents(): EventBusEvents {
  const eventBusEvents = process.env.EVENT_BUS_EVENTS?.trim()

  if (!eventBusEvents || eventBusEvents === '*') {
    return '*'
  }

  const eventBusEventsArray = eventBusEvents
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0)

  if (eventBusEventsArray.length === 0) {
    Logger.warn('EVENT_BUS_EVENTS is empty, defaulting to "*"')
    return '*'
  }

  return eventBusEventsArray
}

/**
 * Resolve async configuration from environment with fallbacks
 */
function resolveAsyncConfig(): EventBusAsyncConfig {
  return {
    maxRetries: parseInt(process.env.EVENT_BUS_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.EVENT_BUS_RETRY_DELAY || '5000', 10),
    eventTTL: process.env.EVENT_BUS_EVENT_TTL || '24 hours',
    archiveInterval: process.env.EVENT_BUS_ARCHIVE_INTERVAL || '1 hour',
    deleteArchivedInterval: process.env.EVENT_BUS_DELETE_ARCHIVED_INTERVAL || '7 days'
  }
}

/**
 * Default EventBus configuration
 * Automatically resolved from environment variables
 */
export const defaultEventBusConfig: EventBusConfig = {
  type: resolveEventBusType(),
  role: resolveEventBusRole(),
  events: resolveEventBusEvents(),
  async: resolveAsyncConfig()
}

/**
 * Validate EventBus configuration
 */
function validateConfig(config: EventBusConfig): void {
  // Validate type
  if (!['memory', 'pgboss'].includes(config.type)) {
    throw new Error(`Invalid EventBus type: ${config.type}. Must be 'memory' or 'pgboss'.`)
  }

  // Validate role
  if (!['both', 'publisher', 'consumer'].includes(config.role)) {
    throw new Error(`Invalid EventBus role: ${config.role}. Must be 'both', 'publisher', or 'consumer'.`)
  }

  // Validate memory + cluster combination
  if (config.type === 'memory' && process.env.CLUSTER_ENABLED === 'true') {
    Logger.warn(
      'WARNING: Using InMemoryEventBus in cluster mode. ' +
      'Events will NOT be shared across workers. Consider using pgboss.'
    )
  }

  // Validate publisher role doesn't subscribe to events
  if (config.role === 'publisher' && config.events !== '*' && config.events.length > 0) {
    Logger.warn(
      'Publisher role detected with specific events configured. ' +
      'Publishers do not subscribe to handlers, so EVENT_BUS_EVENTS will be ignored.'
    )
  }

  // Validate async config
  if (config.async.maxRetries < 0) {
    throw new Error('maxRetries must be >= 0')
  }
  if (config.async.retryDelay < 0) {
    throw new Error('retryDelay must be >= 0')
  }
}

/**
 * Create EventBus instance based on configuration
 */
export function createEventBus(config: EventBusConfig = defaultEventBusConfig): EventBus {
  // Validate configuration
  validateConfig(config)

  // Log configuration in debug mode
  if (process.env.EVENT_BUS_DEBUG === 'true') {
    Logger.info('Creating EventBus with config:', {
      type: config.type,
      role: config.role,
      events: config.events === '*' ? '*' : `${config.events.length} events`,
      async: config.async
    })
  }

  // Create instance
  switch (config.type) {
    case 'pgboss':
      return new PgBossEventBus(config)

    case 'memory':
    default:
      return new InMemoryEventBus(config)
  }
}

/**
 * Create EventBus with partial config override
 */
export function createEventBusWithOverrides(
  overrides: Partial<EventBusConfig>
): EventBus {
  const config: EventBusConfig = {
    ...defaultEventBusConfig,
    ...overrides,
    async: {
      ...defaultEventBusConfig.async,
      ...(overrides.async || {})
    }
  }

  return createEventBus(config)
}

/**
 * Helper to create publisher-only EventBus
 */
export function createPublisherEventBus(
  type: EventBusType = resolveEventBusType()
): EventBus {
  return createEventBusWithOverrides({
    type,
    role: 'publisher',
    events: '*' // Publishers don't need event filtering
  })
}

/**
 * Helper to create consumer-only EventBus
 */
export function createConsumerEventBus(
  events: EventBusEvents = resolveEventBusEvents(),
  type: EventBusType = resolveEventBusType()
): EventBus {
  return createEventBusWithOverrides({
    type,
    role: 'consumer',
    events
  })
}