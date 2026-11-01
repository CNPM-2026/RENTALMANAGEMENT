# Rental Management Backend

Backend API for the Rental Management project. The server is built with
Express, TypeScript, Prisma, PostgreSQL/Supabase, Socket.IO and Zod.

## Requirements

- Node.js 20+
- npm
- PostgreSQL or Supabase
- A configured `server/.env` file

## Environment variables

Copy `.env.example` to `server/.env` for development. Create
`server/.env.test` for the isolated test database. Do not commit either file.

```env
DB_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public"
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters"
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# Optional image and email integrations
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
MAIL_FROM=
MAIL_PROVIDER=resend
SMTP_HOST=
SMTP_PORT=2525
SMTP_USER=
SMTP_PASSWORD=
```

`NODE_ENV=test` loads `.env.test`; other environments load `.env`.

For local password-reset testing without a custom domain, create a Mailtrap
email sandbox and set `MAIL_PROVIDER=mailtrap`. Copy the SMTP host, port,
username, and password from Mailtrap's SMTP integration into `SMTP_*`, then
use a sender such as `no-reply@example.test` in `MAIL_FROM`. Messages remain
inside the Mailtrap inbox and are not delivered to real recipients. Keep
`MAIL_PROVIDER=resend` for Resend-based environments.

`RESET_PASSWORD_URL` is the frontend reset-password page. The backend appends
the one-time token as the `token` query parameter.

For a free Gmail SMTP development setup, enable 2-Step Verification on the
Gmail account, create a Google App Password, and configure:

```env
MAIL_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=your-16-character-app-password
MAIL_FROM="Rental Management <your-account@gmail.com>"
```

Use the App Password, not the normal Gmail password. Gmail SMTP is suitable
for development and small-scale testing, not high-volume production sending.

## Install and run

```powershell
cd server
npm install
npm run dev
```

The default server URL is `http://localhost:3000`.

Production-style build:

```powershell
npm run build
npm start
```

## API documentation

With the server running, open:

```text
http://localhost:3000/api-docs/
```

Use `POST /auth/login` to obtain an access token. In Swagger UI, click
**Authorize** and enter:

```text
Bearer <access-token>
```

Health check:

```text
GET http://localhost:3000/health
```

## Database commands

Push the current Prisma schema to the configured database:

```powershell
npx prisma db push
```

Generate Prisma Client after schema changes:

```powershell
npx prisma generate
```

Seed the development/real database configured in `.env`:

```powershell
npm run db:seed
```

Initialize and seed the isolated test database configured in `.env.test`:

```powershell
npm run db:test:init
```

The seed is idempotent for the named test records and does not reset or delete
existing data.

## Tests

Run the backend smoke tests against the test environment:

```powershell
npm test
```

The current smoke tests cover the health endpoint and seeded tenant login.
Integration tests should use the database configured in `.env.test`.

## Main API groups

| Group | Base path |
|---|---|
| Auth | `/api/v1/auth` |
| Properties | `/api/v1/properties` |
| Rooms | `/api/v1/rooms` |
| Posts | `/api/v1/posts` |
| Appointments | `/api/v1/appointments` |
| Contracts | `/api/v1/contracts` |
| Meter readings | `/api/v1/meter-readings` |
| Invoices | `/api/v1/invoices` |
| Chat | `/api/v1/chats` |
| Notifications | `/api/v1/notifications` |
| Matching | `/api/v1/matching` |
| Reviews | `/api/v1/reviews` |
| Favorites | `/api/v1/favorites` |
| Reports | `/api/v1/reports` |
| Statistics | `/api/v1/statistics` |

## Authentication endpoints

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

Access tokens are short-lived. Refresh tokens are stored as hashes and
rotated when refreshed.

## Uploads and email

- Cloudinary is used when all Cloudinary variables are configured.
- Local `/uploads` storage remains available as a development fallback.
- Resend is used for password-reset email when `MAIL_PROVIDER=resend`,
  `RESEND_API_KEY`, and `MAIL_FROM` are configured.
- Mailtrap SMTP is used when `MAIL_PROVIDER=mailtrap` and all `SMTP_*`
  variables plus `MAIL_FROM` are configured.
- Gmail SMTP is used when `MAIL_PROVIDER=gmail` and all `SMTP_*` variables plus
  `MAIL_FROM` are configured.

## Security notes

- Never commit `.env`, `.env.test`, API keys, database URLs or real passwords.
- Rotate credentials if they are exposed.
- The seed credentials are for learning/testing only.
- Use Prisma migrations instead of `db push` when moving to a production
  deployment workflow.
