/**
 * URL Validation Utilities
 * SECURITY: Prevents SSRF (Server-Side Request Forgery) attacks
 */

import { URL } from 'url';
import { Logger } from '@shared/logger';

/**
 * Private/internal IP ranges that should be blocked
 * Prevents SSRF attacks to internal services
 */
const BLOCKED_IP_RANGES = [
  // Loopback
  /^127\./,
  /^::1$/,
  /^localhost$/i,

  // Private IPv4 ranges
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16

  // Link-local
  /^169\.254\./,              // 169.254.0.0/16
  /^fe80:/,                   // IPv6 link-local

  // AWS metadata endpoint (critical!)
  /^169\.254\.169\.254$/,

  // Private IPv6 ranges
  /^fc00:/,                   // IPv6 private
  /^fd00:/,                   // IPv6 private
];

/**
 * Allowed protocols for external URLs
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Check if hostname is a private/internal IP
 */
function isPrivateIP(hostname: string): boolean {
  return BLOCKED_IP_RANGES.some(pattern => pattern.test(hostname));
}

/**
 * Validate URL and check for SSRF vulnerabilities
 *
 * @param urlString - URL to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validateUrl(
  urlString: string,
  options: {
    allowPrivateIPs?: boolean;
    allowedProtocols?: string[];
    allowedDomains?: string[];
    maxLength?: number;
  } = {}
): { valid: boolean; error?: string; parsedUrl?: URL } {
  const {
    allowPrivateIPs = false,
    allowedProtocols = ALLOWED_PROTOCOLS,
    allowedDomains,
    maxLength = 2048,
  } = options;

  // 1. Check URL length
  if (urlString.length > maxLength) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${maxLength} characters`,
    };
  }

  // 2. Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    Logger.error(error.message);
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }

  // 3. Check protocol
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      error: `Protocol ${parsedUrl.protocol} not allowed. Allowed protocols: ${allowedProtocols.join(', ')}`,
    };
  }

  // 4. Check for credentials in URL (security risk)
  if (parsedUrl.username || parsedUrl.password) {
    return {
      valid: false,
      error: 'URLs with credentials are not allowed',
    };
  }

  // 5. Check for private/internal IPs (SSRF prevention)
  if (!allowPrivateIPs && isPrivateIP(parsedUrl.hostname)) {
    return {
      valid: false,
      error: 'Access to private/internal IP addresses is not allowed',
    };
  }

  // 6. Check domain whitelist if provided
  if (allowedDomains && allowedDomains.length > 0) {
    const isAllowed = allowedDomains.some(domain => {
      // Exact match or subdomain match
      return parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`);
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain ${parsedUrl.hostname} is not in the allowed list`,
      };
    }
  }

  // 7. Additional checks for suspicious patterns
  const suspiciousPatterns = [
    /@/,                // URLs with @ can be misleading (http://expected.com@evil.com)
    /\.\./,             // Path traversal attempts
    /%00/,              // Null byte
    /%0d%0a/i,          // CRLF injection
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(urlString))) {
    return {
      valid: false,
      error: 'URL contains suspicious patterns',
    };
  }

  return {
    valid: true,
    parsedUrl,
  };
}

/**
 * Validate and sanitize image URL for external API calls
 * Specific validation for image URLs (TinEye, reverse image search, etc.)
 */
export function validateImageUrl(urlString: string): { valid: boolean; error?: string; url?: string } {
  // Basic URL validation with SSRF protection
  const validation = validateUrl(urlString, {
    allowPrivateIPs: false,
    allowedProtocols: ['http:', 'https:'],
    maxLength: 2048,
  });

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
    };
  }

  // Additional checks for image URLs
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const hasImageExtension = imageExtensions.some(ext =>
    validation.parsedUrl!.pathname.toLowerCase().endsWith(ext)
  );

  // Note: Some image URLs don't have extensions (e.g., dynamic URLs with query params)
  // So we don't enforce this, just log a warning
  if (!hasImageExtension) {
    console.warn(`Image URL validation: URL doesn't have common image extension: ${urlString}`);
  }

  return {
    valid: true,
    url: urlString,
  };
}

/**
 * Validate webhook URL
 * Stricter validation for webhooks to prevent SSRF and callback attacks
 */
export function validateWebhookUrl(urlString: string, allowedDomains?: string[]): { valid: boolean; error?: string } {
  return validateUrl(urlString, {
    allowPrivateIPs: false,
    allowedProtocols: ['https:'], // Only HTTPS for webhooks
    allowedDomains,
    maxLength: 1024,
  });
}

/**
 * Extract domain from URL safely
 */
export function extractDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if URL is safe to fetch
 * Quick check before making external HTTP requests
 */
export function isSafeToFetch(urlString: string): boolean {
  const validation = validateUrl(urlString, {
    allowPrivateIPs: false,
  });

  return validation.valid;
}
