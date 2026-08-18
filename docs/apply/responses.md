# Responses

## Success Response

All success responses are wrapped through the `success()` helper:

```ts
return c.json(success(MyResponseDto, data))
// with a custom message:
return c.json(success(MyResponseDto, data, "Created successfully"), 201)
```

Shape:

```json
{
  "data": { ... },
  "message": "successful",
  "timestamp": "2026-03-21T10:00:00.000Z"
}
```

## Paginated Response

```ts
return c.json(paginated(ItemDto, items, { page, pageSize }, totalCount))
```

Shape:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "successful",
  "timestamp": "2026-03-21T10:00:00.000Z"
}
```

## Error Response

Shape:

```json
{
  "error": "ValidationError",
  "message": "Validation failed",
  "timestamp": "2026-03-21T10:00:00.000Z",
  "path": "/auth/register",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ],
  "stack": "..."
}
```

> `stack` is only included in `NODE_ENV=development` and only for non-operational errors.

> `details` can be an array of field errors, a plain object, or a string.

## Error Types

| Class | HTTP Status | When to use |
|---|---|---|
| `BadRequestError` | 400 | Generic invalid request |
| `UnauthorizedError` | 401 | Not authenticated or invalid token |
| `ForbiddenError` | 403 | Authenticated but not permitted |
| `NotFoundError` | 404 | Resource does not exist |
| `ConflictError` | 409 | Resource already exists (e.g. duplicate email) |
| `ValidationError` | 422 | Input validation failed |
| `RateLimitError` | 429 | Rate limit exceeded |
| `InternalServerError` | 500 | Unexpected server error |
| `ServiceUnavailableError` | 503 | Service temporarily unavailable |

All extend `AppError`:

```ts
throw new ConflictError("Email already exists")
throw new ValidationError("Invalid input", [
  { field: "email", message: "Must be a valid email" }
])
```

## Error Normalization

The error handler automatically normalizes all thrown values:

| Input | Output |
|---|---|
| `AppError` | Passed through as-is |
| Valibot `ValiError` | → `ValidationError` (422) with field-level details |
| Other `Error` | → `AppError` (500) |
| Non-error throw | → `AppError` (500) |

## Auth Response Examples

### POST /auth/register

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john"
  },
  "message": "successful",
  "timestamp": "..."
}
```

### POST /auth/login

```json
{
  "data": {
    "idToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "john",
      "role": "NORMAL_USER",
      "emailVerified": false
    }
  },
  "message": "successful",
  "timestamp": "..."
}
```

## Health Response Examples

### GET /health

```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 3600,
  "service": "app",
  "version": "0.0.1",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 12
    }
  }
}
```

Returns `503` if `status` is `"unhealthy"`.

### GET /health/live

```json
{ "status": "alive" }
```

### GET /health/ready

Same shape as `/health`. Returns `503` if database is down.
