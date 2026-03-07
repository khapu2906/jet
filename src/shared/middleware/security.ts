import type { Context, Next } from 'hono';
import { config } from '../config';



/**
 * Rate limiting middleware
 * Simple in-memory rate limiting (for production use Redis-based solution)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(c: Context, next: Next) {
  if (!config.rateLimitEnabled) {
    return next();
  }

  const identifier = c.req.header('X-User-Id') || c.req.header('X-Forwarded-For') || 'anonymous';
  const now = Date.now();
  const windowMs = parseTimeWindow(config.rateLimitWindow);

  // Clean up old entries
  if (Math.random() < 0.1) { // 10% chance to clean up
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  // Get or create rate limit entry
  let entry = rateLimitStore.get(identifier);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(identifier, entry);
  }

  // Increment count
  entry.count++;

  // Check limit
  if (entry.count > config.rateLimitMax) {
    c.header('X-RateLimit-Limit', config.rateLimitMax.toString());
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
    c.header('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  // Add rate limit headers
  c.header('X-RateLimit-Limit', config.rateLimitMax.toString());
  c.header('X-RateLimit-Remaining', (config.rateLimitMax - entry.count).toString());
  c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

  return next();
}

/**
 * Parse time window string (e.g., "15m", "1h", "30s")
 */
function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)([smh])$/);
  if (!match) return 15 * 60 * 1000; // Default: 15 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}
