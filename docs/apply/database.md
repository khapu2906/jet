# Database

## Connection

Uses `pg.Pool` via Drizzle ORM. Connection string is built from config:

```
postgresql://{user}:{password}@{host}:{port}/{database}
```

| Env Var | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `jet-db` | Database name |
| `DB_SSL` | `false` | Enable SSL (auto-enabled in production) |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Verify SSL certificate |
| `DB_SSL_CA` | — | CA certificate for SSL |
| `DB_DEBUG` | `false` | Log SQL queries |

## Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `email` | VARCHAR(255) | Unique (when not deleted) |
| `firstName` | VARCHAR(100) | Optional |
| `lastName` | VARCHAR(100) | Optional |
| `avatar` | VARCHAR(500) | Optional URL |
| `bio` | TEXT | Optional |
| `phone` | VARCHAR(20) | Optional |
| `language` | VARCHAR(10) | Default: `en` |
| `timezone` | VARCHAR(50) | Default: `UTC` |
| `status` | ENUM | `ACTIVE` \| `INACTIVE`, default: `ACTIVE` |
| `createdAt` | TIMESTAMPTZ | Auto |
| `updatedAt` | TIMESTAMPTZ | Auto-updated |
| `deletedAt` | TIMESTAMPTZ | Soft delete |

### `identities`

Links a user to an auth provider.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → users.id (CASCADE DELETE) |
| `provider` | VARCHAR(50) | e.g. `INTERNAL`, `GOOGLE` |
| `providerUserId` | VARCHAR(255) | Provider's user identifier |
| `email` | VARCHAR(255) | Optional |
| `emailVerified` | BOOLEAN | Default: `false` |
| `createdAt` | TIMESTAMPTZ | Auto |

Unique constraint: `(provider, providerUserId)`

### `auth_credentials`

Internal email/password credentials.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | VARCHAR(255) | Unique |
| `passwordHash` | TEXT | scrypt hash |
| `username` | VARCHAR(255) | Optional |
| `lastLoginAt` | TIMESTAMPTZ | Optional |
| `failedLoginAttempts` | INTEGER | Default: `0` |
| `lockedUntil` | TIMESTAMPTZ | Account lock expiry |
| `createdAt` | TIMESTAMPTZ | Auto |
| `updatedAt` | TIMESTAMPTZ | Auto-updated |

## Migrations

Managed by Drizzle Kit. Migration files live in `migrations/`, snapshots in `migrations/meta/`.

```bash
# After editing schema files:
pnpm db:generate   # generate migration SQL

# Apply migrations:
pnpm db:migrate
```

## Adding a New Table

1. Create schema file in `src/shared/db/schema/`
2. Export from `src/shared/db/schema/index.ts`
3. Run `pnpm db:generate` → `pnpm db:migrate`
