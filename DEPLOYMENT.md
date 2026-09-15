# The Parks — production database & deployment

## What is already included

The application uses PostgreSQL + Prisma. The `prisma/migrations/` directory is the source of truth for the database schema.

The latest migration adds database-level safety rails:
- event capacity can never be configured above 55;
- price and ticket sequence cannot be negative;
- a PostgreSQL trigger locks the Event row before a ticket is confirmed and refuses a 56th confirmed ticket.

The application-level reservation transaction remains the primary allocation mechanism.

## Create the hosted PostgreSQL database

Recommended: Neon or another managed PostgreSQL provider.

For this project, use a **direct PostgreSQL connection** in `DATABASE_URL`, because `reserveSeat()` uses an interactive transaction and `SELECT ... FOR UPDATE`.

Do not paste the database password into chat or commit it to GitHub.

## Initialize it

From the project directory:

```bash
npm install
npm run db:deploy
npm run seed
npm run db:check
```

`npm run seed` creates/upserts:
- The Parks event
- 03 October 2026
- 13:00–22:00
- R150
- 55 maximum guests
- invite-only flag
- the first organiser account if ADMIN_EMAIL/ADMIN_PASSWORD are supplied

## Local functional test

Terminal 1:

```bash
PAYMENT_PROVIDER=mock EMAIL_MODE=test npm run dev
```

Terminal 2:

```bash
npm run verify -- --reset
```

Then:

```bash
npm run build
```

## Vercel

Add the project to GitHub as a private repository and import it into Vercel.

Set the production environment variables from `.env.example` / `PRODUCTION_ENV_TEMPLATE.txt`.

For the first production deployment use:

```text
PAYMENT_PROVIDER=payfast
PAYFAST_MODE=sandbox
EMAIL_MODE=test
```

After the production site is verified, configure live PayFast and live email.

## PayFast

After a real HTTPS domain is attached:

```text
https://YOUR-DOMAIN/api/payments/payfast/notify
```

Use that as the PayFast ITN/notify URL.

Keep sandbox enabled until a complete end-to-end test passes.

## Important

Never put:
- PayFast merchant secrets
- database passwords
- email API keys
- admin passwords
- session/signing secrets

inside source files or GitHub.

Store them in Vercel Environment Variables / the provider's secret store.
