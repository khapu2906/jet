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

This repo has exactly one provider today (`InternalAuthProvider`, email+password) — for *why*
each step below is shaped this way (verified against a sibling codebase that has three
providers wired up), see `docs/deeper/auth.md`.

**1. Add the provider identifier** — `PROVIDERS` in `shared/db/schema/indentities.ts`:

```ts
export const PROVIDERS = {
	INTERNAL: "INTERNAL",
	GOOGLE: "GOOGLE", // ← add here (plain varchar column, no migration needed)
} as const;
```

**2. Create `shared/auth/providers/google.ts`**, implementing `IAuthProvider` only (not
`ITokenIssuer` — see `docs/deeper/auth.md` for why):

```ts
import type { AuthContext } from "../type";
import type { IAuthProvider } from "./base";
import { USER_ROLES } from "../rbac";
import { verifyGoogleIdToken } from "some-google-sdk"; // whatever SDK you integrate

export class GoogleAuthProvider implements IAuthProvider {
	extractToken(headers: Record<string, string | undefined>): string | null {
		const auth = headers["authorization"];
		if (!auth?.startsWith("Bearer ")) return null;
		return auth.substring(7);
	}

	async verify(token: string): Promise<AuthContext | null> {
		try {
			const decoded = await verifyGoogleIdToken(token);
			return {
				sub: decoded.sub,
				userId: decoded.sub,
				userEmail: decoded.email,
				userRole: USER_ROLES.NORMAL_USER,
				emailVerified: decoded.email_verified ?? false,
			};
		} catch {
			return null;
		}
	}
}
```

**3. Export it** from `shared/auth/providers/index.ts`:

```ts
export * from "./base";
export * from "./internal";
export * from "./google"; // ← add here
```

**4. Bind `AuthProviderKey`** — in `AuthModule.register()` if only `auth`'s own routes need it,
or in `HttpProcess._registerCoreDependencies()` (`src/processes/http.ts`, alongside
`DbKey`/`EventBusKey`) if routes in *other* modules need it too:

```ts
this.container.bind(AuthProviderKey, () => new GoogleAuthProvider());
```

**5. Wire it into a route** — `shared/auth/middleware.ts` already exports `authenticate(provider)`
(zero call sites in this repo today, see `docs/llm/code-pattern.md` §6):

```ts
// routes.ts
import { AuthProviderKey } from "@shared/auth/providers";
import { authenticate } from "@shared/auth/middleware";

app.post(
	"/auth/google",
	authenticate(container.resolve(AuthProviderKey)),
	async (c) => { /* ... */ },
);
```

**6. Extend `IAuthService`/`IAuthRepository`** (in `contracts/`) with whatever the new flow
needs — `createUserWithIdentityAndCredential` assumes a password, so a provider with none
(Google, Firebase, ...) needs a different repository/service method (e.g. find-or-create a
user by external identity), not just a new provider class plugged into `register`/`login`
as-is.
