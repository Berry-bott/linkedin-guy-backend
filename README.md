# backend-linkedin

Auth API for a LinkedIn-style app — Node.js, Express 5, Prisma ORM, Neon Postgres, JWT.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js (CommonJS) |
| HTTP | Express 5 |
| ORM | Prisma 6 (`prisma-client-js`) |
| Database | Neon (serverless Postgres) |
| Passwords | bcryptjs, cost factor 12 |
| Tokens | jsonwebtoken (HS256) |
| Validation | express-validator |
| CORS | `cors`, allow-list driven |

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
cp .env.example .env # then fill in the values
npx prisma db push   # create the tables in your Neon database
npm run dev          # http://localhost:5000  (auto-restarts on file changes)
```

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts with `--watch`; restarts automatically when a file changes. |
| `npm start` | Production start, no watcher. |
| `npm run prisma:push` | Sync the schema to the database without a migration. |
| `npm run prisma:migrate` | Create + apply a versioned migration (dev). |
| `npm run prisma:deploy` | Apply pending migrations (production/CI). |
| `npm run prisma:studio` | Open Prisma Studio to browse the data. |
| `npm run prisma:generate` | Regenerate Prisma Client after editing the schema. |

`npm run dev` runs:

```bash
node --watch --watch-preserve-output --env-file=.env backend.js
```

- `--watch` restarts the process on any change (no `nodemon` dependency needed — native to Node 18.11+).
- `--watch-preserve-output` keeps previous logs on screen instead of clearing them, so you keep the startup banner and error history across restarts.
- `--env-file=.env` loads `.env` up front, so `process.env` is populated before any module runs.

> Node does **not** watch `.env`. After editing it, restart the dev server
> (press `Ctrl+C`, or touch a `.js` file to trigger a reload).


## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string. Use the **pooled** one (host contains `-pooler`) with `?sslmode=require`. |
| `JWT_SECRET` | yes | Signs JWTs. Must be ≥ 32 chars in production. |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d`. |
| `PORT` | no | Default `5000`. |
| `NODE_ENV` | no | `development` \| `production`. |
| `CORS_ORIGIN` | no | Comma-separated allowed origins. |
| `CORS_ALLOW_VERCEL_PREVIEWS` | no | `true` to allow any `*.vercel.app` origin. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Note on migrations.** `directUrl` is deliberately *not* set in
> `schema.prisma`: Prisma's `env()` throws at validation time when a variable is
> missing, which would break anyone using a single connection string. If you have
> a separate direct URL, pass it for migrations only:
> `DATABASE_URL="<direct-url>" npx prisma migrate deploy`.

## API

Base path `/api`. Every response is JSON with a `success` boolean.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | – | Service banner |
| `GET` | `/api/health` | – | Liveness probe (no DB access) |
| `POST` | `/api/auth/register` | – | Create an account, returns user + token |
| `POST` | `/api/auth/login` | – | Exchange credentials for a token |
| `GET` | `/api/auth/me` | Bearer | Current user's profile |
| `PATCH` | `/api/auth/me` | Bearer | Update `name`, `email` and/or `phone` |
| `POST` | `/api/auth/change-password` | Bearer | Rotate password (requires current one) |

### Examples

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Me","email":"me@example.com","password":"Passw0rd123","phone":"08031112222"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Passw0rd123"}'

# Authenticated request
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <token>"
```

### Register fields

| Field | Required | Rules |
|---|---|---|
| `name` | yes | 2–80 characters |
| `email` | yes | Valid email; trimmed + lowercased; must be unique |
| `password` | yes | 8–72 chars, needs 1 lowercase, 1 uppercase, 1 digit |
| `phone` | yes | 8–15 digits; must be unique |

`POST /api/auth/login` requires `email` and `password` only.

### Phone numbers

`phone` is normalised before it is stored, so the same number written in
different ways always resolves to one account:

| You send | Stored as |
|---|---|
| `08031112222` | `+2348031112222` |
| `+2348031112222` | `+2348031112222` |
| `2348031112222` | `+2348031112222` |
| `0803 111 2222` | `+2348031112222` |

Spaces, dashes, dots and parentheses are ignored. A local number with a trunk
`0` has it replaced by the country calling code, inferred from the digits that
follow (Nigeria `234`, UK `44`, India `91`, South Africa `27`). Numbers whose
trunk `0` is genuinely part of the national number (North America, e.g.
`0415555267`) are left untouched.

Because the value is normalised before the uniqueness check, registering
`08031112222` when `+2348031112222` already exists returns `409 PHONE_IN_USE`.


### Error format

```json
{ "success": false, "message": "Validation failed.", "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Please provide a valid email address." }] }
```

Codes: `VALIDATION_ERROR`, `EMAIL_IN_USE`, `INVALID_CREDENTIALS`, `TOKEN_MISSING`,
`TOKEN_INVALID`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, `INVALID_CURRENT_PASSWORD`,
`PASSWORD_UNCHANGED`, `DUPLICATE_RECORD`, `CORS_ORIGIN_DENIED`, `DATABASE_UNAVAILABLE`.

## CORS

`src/config/cors.js` allows: any origin in `CORS_ORIGIN`, `localhost`/`127.0.0.1`
(in development), and — when `CORS_ALLOW_VERCEL_PREVIEWS=true` — any
`https://*.vercel.app` origin. Requests without an `Origin` header (curl,
server-to-server) always pass. Credentials are enabled.

## Project layout

```
backend.js                    # server bootstrap + graceful shutdown
prisma/schema.prisma          # models (User)
scripts/
  smoke-test.js               # end-to-end auth test (24 checks)
  check-hash.js               # verify a stored password is a bcrypt hash
src/
  app.js                      # Express app factory (no listen — testable)
  config/       env.js, prisma.js, cors.js
  middleware/   auth.middleware.js, error.middleware.js
  routes/       index.js, auth.routes.js
  services/     auth.service.js
  utils/        ApiError.js, asyncHandler.js, password.js, token.js, validate.js
  validators/   auth.validator.js
```

## Testing

```bash
npm run dev                     # terminal 1
node scripts/smoke-test.js      # terminal 2 -> 24 checks
```

The smoke test registers a throwaway user, exercises the whole auth lifecycle
(including failure cases and CORS), and prints a pass/fail summary.

## Security notes

- Passwords are hashed with bcrypt cost 12 and **never** returned by any endpoint.
- Login returns an identical message for unknown emails and wrong passwords, so
  the endpoint cannot be used to enumerate registered accounts.
- Tokens are re-validated against the database on each request, so deleting an
  account immediately invalidates its tokens.
- `trust proxy` is enabled for correct client IPs behind a reverse proxy.
- JSON bodies are capped at 100kb.
- Stack traces are only included in responses outside production.
