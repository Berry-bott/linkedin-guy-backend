# chuks-kitchen backend

Auth API for chuks-kitchen — Node.js, Express 5, Prisma ORM, Neon Postgres, JWT.

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
| `POST` | `/api/auth/register` | – | Create an account, email a verification code |
| `POST` | `/api/auth/verify-email` | – | Confirm the emailed code so the account can log in |
| `POST` | `/api/auth/resend-verification` | – | Email a fresh verification code |
| `POST` | `/api/auth/login` | – | Exchange verified credentials for a token |
| `GET` | `/api/auth/me` | Bearer | Current user's profile |
| `PATCH` | `/api/auth/me` | Bearer | Update `name`, `email` and/or `phone` |
| `POST` | `/api/auth/change-password` | Bearer | Rotate password (requires current one) |

### Examples

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Me","email":"me@example.com","password":"Passw0rd123","confirmPassword":"Passw0rd123","phone":"08031112222"}'

# Verify the code emailed during registration
curl -X POST http://localhost:5000/api/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","code":"123456"}'

# Login (only works after the email is verified)
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
| `confirmPassword` | yes | Must match `password` |
| `phone` | yes | 8–15 digits; normalised, may be shared by several accounts |

`POST /api/auth/login` requires `email` and `password` only. Registration does
**not** return a token: the account must first be verified with the 6-digit code
emailed to it (`POST /api/auth/verify-email`). Logging in before verification
returns `401 EMAIL_NOT_VERIFIED`.

### Email verification

- Registration emails a single-use 6-digit code (default TTL 15 minutes,
  `EMAIL_VERIFICATION_TTL_MINUTES`). Only an HMAC of the code is stored.
- `POST /api/auth/verify-email` accepts `{ "email", "code" }`, allows
  `EMAIL_VERIFICATION_MAX_ATTEMPTS` (default 5) wrong tries, then requires a
  fresh code.
- `POST /api/auth/resend-verification` accepts `{ "email" }` and always replies
  with a generic message (no account enumeration), throttled to one send per
  60 seconds.
- Changing your email address through `PATCH /api/auth/me` resets verification;
  logins against the new address are blocked until it is re-verified.
- Delivery uses SMTP via nodemailer: set `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `APP_URL` (see
  `.env.example`). `SMTP_HOST` is required in production. For local development
  without SMTP you can set `EMAIL_LOG_VERIFICATION_CODE=true` to print the code
  to the server console instead — this is forcibly disabled in production.

#### Applying the schema change

```bash
npm run prisma:push     # adds the new verification columns to `users`
```

If the database already contains accounts created **before** this feature,
backfill them as verified so their owners are not locked out (new signups stay
unverified until they confirm their code):

```bash
# Preview how many rows are pending, then apply the backfill:
node scripts/backfill-email-verification.js
node scripts/backfill-email-verification.js --apply
```

The script runs this SQL:

```sql
UPDATE "users"
SET "emailVerifiedAt" = COALESCE("updatedAt", now())
WHERE "emailVerifiedAt" IS NULL;
```

### Phone numbers

`phone` is normalised before it is stored, so the same number written in
different ways always resolves to one stored value:

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

**Phone numbers are not unique.** This is a food-ordering app, so several
accounts may legitimately share one number (a household ordering together), and
registering `08031112222` when `+2348031112222` already exists succeeds with
`201`. Normalisation still guarantees that both spellings are stored identically,
so the value is consistent for contact/notification purposes. Only `email` is
unique, and duplicate emails return `409 EMAIL_IN_USE`.


### Error format

```json
{ "success": false, "message": "Validation failed.", "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Please provide a valid email address." }] }
```

Codes: `VALIDATION_ERROR`, `EMAIL_IN_USE`, `INVALID_CREDENTIALS`,
`EMAIL_NOT_VERIFIED`, `INVALID_VERIFICATION_CODE`, `VERIFICATION_CODE_EXPIRED`,
`VERIFICATION_ATTEMPTS_EXCEEDED`, `VERIFICATION_RESEND_COOLDOWN`,
`EMAIL_NOT_CONFIGURED`, `EMAIL_NOT_SENT`, `TOKEN_MISSING`, `TOKEN_INVALID`,
`TOKEN_EXPIRED`, `USER_NOT_FOUND`, `INVALID_CURRENT_PASSWORD`,
`PASSWORD_UNCHANGED`, `DUPLICATE_RECORD`, `CORS_ORIGIN_DENIED`,
`DATABASE_UNAVAILABLE`.

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
  smoke-test.js               # end-to-end auth test
  check-hash.js               # verify a stored password is a bcrypt hash
src/
  app.js                      # Express app factory (no listen — testable)
  config/       env.js, prisma.js, cors.js
  middleware/   auth.middleware.js, error.middleware.js
  routes/       index.js, auth.routes.js
  services/     auth.service.js, email.service.js
  utils/        ApiError.js, asyncHandler.js, password.js, token.js,
                validate.js, verification.js
  validators/   auth.validator.js
test/
  verification.test.js        # unit tests for verification-code utilities
```

## Testing

```bash
npm test                       # unit tests (verification-code utilities)
npm run dev                     # terminal 1
node scripts/smoke-test.js      # terminal 2 -> end-to-end auth checks
```

The smoke test registers a throwaway user, exercises the whole auth lifecycle
(validation failures, email verification, login gating, password rotation and
CORS) and prints a pass/fail summary. In development without SMTP, start the
server with `EMAIL_LOG_VERIFICATION_CODE=true` to have the verification code
printed to the server console (never enable this in production), then re-run the
test with `SMOKE_VERIFICATION_CODE=<code>` to execute the full
register → verify → login → profile/password checks.

## Security notes

- Passwords are hashed with bcrypt cost 12 and **never** returned by any endpoint.
- Login returns an identical message for unknown emails and wrong passwords, so
  the endpoint cannot be used to enumerate registered accounts.
- Tokens are re-validated against the database on each request, so deleting an
  account immediately invalidates its tokens.
- `trust proxy` is enabled for correct client IPs behind a reverse proxy.
- JSON bodies are capped at 100kb.
- Stack traces are only included in responses outside production.
