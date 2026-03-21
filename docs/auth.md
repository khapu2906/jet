# Authentication & Authorization

## Overview

Auth flow is JWT-based with an internal provider (email/password). Designed to support multiple providers via the `identities` table.

## Registration Flow

```
POST /auth/register
  → Validate (email, password ≥8 chars, optional username)
  → Hash password (scrypt + random salt)
  → Atomic DB transaction:
      1. INSERT users
      2. INSERT auth_credentials
      3. INSERT identities (links user ↔ credentials, provider="INTERNAL")
  → Return JWT token
```

## Login Flow

```
POST /auth/login
  → Validate (email, password)
  → Find credentials by email
  → Check account lock (lockedUntil > now → reject)
  → Verify password (timing-safe comparison)
  → On failure: increment failedLoginAttempts
                if attempts ≥ 5 → lock for 15 minutes
  → On success: reset failedLoginAttempts
                generate JWT
  → Return token + user info
```

## JWT Payload

```ts
{
  sub: string           // user ID
  userId: string
  email: string
  username?: string
  role: Role            // NORMAL_USER | SYSTEM_ADMIN
  emailVerified: boolean
  iat: number
  exp: number
}
```

## Password Hashing

Uses Node.js `crypto.scrypt` with random salt:

```
format: "${salt}:${hash}"  (hex-encoded, 16-byte salt, 64-byte key)
```

Verification uses `timingSafeEqual` to prevent timing attacks.

## RBAC

Roles and their permissions:

| Role | Permissions |
|---|---|
| `NORMAL_USER` | `user:profile:view`, `user:profile:manage` |
| `SYSTEM_ADMIN` | All permissions |

All permissions:

| Permission | Description |
|---|---|
| `user:profile:view` | View own profile |
| `user:profile:manage` | Edit own profile |
| `user:view` | View all users |
| `user:manage` | Manage users |

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `JWT_SECRET` | `"dev-secret"` | HMAC signing secret (required in production) |
| `JWT_EXPIRES_IN` | `"1h"` | Token expiration |
| `JWT_REFRESH_SECRET` | — | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | `"7d"` | Refresh token expiration |

> In production, `JWT_SECRET` must be set or the app throws FATAL on startup.

## Adding a New Auth Provider

1. Create a provider class implementing `AuthProvider`
2. Add provider name to `identities.provider` (e.g. `"GOOGLE"`)
3. Register in `AuthModule.register()` with appropriate binding
4. Add routes in `AuthModule.bootstrap()`
