# Authentication & Authorization — How To

For how the register/login flows and password hashing actually work internally, see
`docs/deeper/auth.md`.

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
