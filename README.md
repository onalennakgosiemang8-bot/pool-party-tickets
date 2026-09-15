# The Parks · Splash Water Park Party — ticketing

A complete, production-shaped ticketing site for one private event:
**03 October 2026, 13:00–22:00, The Parks LifeStyle Apartments — Splash Water Park.**
Invite only. R150 per guest. **Hard cap of 55 guests, enforced in the database.**

Guests buy a ticket, pay through PayFast, and get a personalised pass with a
signed QR code by email. Organisers watch sales live, scan guests in at the
gate, and export the guest list.

---

## What is in the box

| Area | Where |
|---|---|
| Public pages | `/`, `/event`, `/tickets`, `/checkout`, `/success`, `/sold-out`, `/ticket/[id]` |
| Organiser pages | `/admin` (sign in), `/admin/dashboard`, `/admin/check-in` |
| Public API | `/api/availability`, `/api/checkout`, `/api/checkout/status` |
| Payments | `/api/payments/payfast/notify` (ITN), `/api/payments/cancel`, `/api/payments/mock/*` (sandbox) |
| Organiser API | `/api/admin/{login,logout,stats,guests,export,check-in}`, `/api/admin/tickets/[id]` |
| Tickets | `/api/tickets/[id]/pdf` |
| Housekeeping | `/api/cron/release-expired` |

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind · PostgreSQL · Prisma**.
Extra dependencies are deliberately few: `qrcode`, `pdf-lib`, `html5-qrcode`,
`csv-stringify`, `zod`. Passwords, HMACs and tokens use Node's own `crypto`.

---

## Getting it running

```bash
npm install
cp .env.example .env          # then fill it in — see below
npm run db:deploy             # applies prisma/migrations to your database
npm run seed                  # creates the event row + your organiser login
npm run dev
```

Open <http://localhost:3000>. Sign in at `/admin` with the `ADMIN_EMAIL` and
`ADMIN_PASSWORD` you put in `.env`.

### The event photograph

Both images are already in `public/`, cut from the invitation you supplied:

- **`public/hero.jpg`** — the invitation itself, shown framed in the hero and
  on `/event`.
- **`public/hero-wide.jpg`** — the photograph of the splash park from the same
  invitation, used as the hero background and as the banner on `/tickets`.

They are served through `next/image`, so every device gets a correctly sized
AVIF/WebP version. If you ever want a different shot, replace the files and
keep the names.

---

## Environment

Everything lives in `.env`; nothing is hardcoded. See `.env.example` for the
full annotated list. The ones that matter:

| Variable | Why |
|---|---|
| `DATABASE_URL` | PostgreSQL (Neon, Supabase, Railway, RDS, local) |
| `NEXT_PUBLIC_SITE_URL` | Must be your real HTTPS URL in production — PayFast posts back to it |
| `SESSION_SECRET` | Signs organiser session cookies (`openssl rand -hex 32`) |
| `TICKET_SIGNING_SECRET` | Signs QR tokens — a **different** random value |
| `PAYFAST_*` | Merchant credentials, plus `PAYFAST_MODE=sandbox\|live` |
| `PAYMENT_PROVIDER` | `payfast`, or `mock` for local testing (refuses to run in production) |
| `EMAIL_*` | `EMAIL_MODE=test` logs emails instead of sending; switch to `live` with a Resend or SendGrid key |
| `CRON_SECRET` | Protects the expired-hold sweeper |

### PayFast

`.env.example` ships with PayFast's public **sandbox** merchant ID and key, so
the flow works end to end before you have an account. When your account is
ready:

1. Set `PAYFAST_MODE=live` and paste your real `PAYFAST_MERCHANT_ID`,
   `PAYFAST_MERCHANT_KEY` and `PAYFAST_PASSPHRASE`.
2. In the PayFast dashboard set the ITN (notify) URL to
   `https://your-domain.co.za/api/payments/payfast/notify`.
3. Deploy over HTTPS. PayFast will not post to plain HTTP.

No PayFast account yet, and you want to click through the whole journey?

```bash
PAYMENT_PROVIDER=mock npm run dev
```

You get a sandbox payment screen with *simulate success* and *simulate
failure* buttons that drive exactly the same server-side confirmation path.

### Adding another provider

`src/lib/payments/provider.ts` defines the contract: `createCheckout` and
`verifyWebhook`. PayFast and the mock provider implement it. To add Yoco, Ozow
or Paystack, write one file, register it in `src/lib/payments/index.ts`, and
nothing else in the app changes.

### Email

`EMAIL_MODE=test` (the default) writes every message to the console and the
`EmailLog` table and sends nothing — useful while you are still testing.
Set `EMAIL_MODE=live`, `EMAIL_PROVIDER=resend|sendgrid` and `EMAIL_API_KEY` to
send for real. Templates live in `src/lib/email/templates.ts`: purchase and
ticket delivery (with the PDF attached and the QR inline), payment failure,
and cancellation/refund.

---

## How the 55-guest cap actually holds

This is the part worth reading closely.

1. **One authority.** `Event.capacity` in Postgres. The frontend counter is
   decoration; it never gates anything.
2. **A row lock, not a count-then-insert.** `reserveSeat()` opens a
   serializable transaction and starts with
   `SELECT … FROM "Event" … FOR UPDATE`. Two people tapping *pay* at the same
   instant are serialised there: the second request waits for the first to
   commit and then sees its seat.
3. **Expired holds are released inside that same lock**, so nobody is turned
   away because of a seat someone abandoned ten minutes ago.
4. **Ticket numbers come from `lastTicketSeq`**, incremented inside the lock —
   unique and gapless, backed by a unique index on `ticketNumber`.
5. **A seat is only *sold* when payment is verified.** A reservation is
   `PENDING` and holds a seat for `RESERVATION_HOLD_MINUTES` (15 by default).
   Failed, cancelled and lapsed reservations return the seat to the pool.
6. **Confirmation happens in exactly one place** — `applyPaymentResult()`,
   reached only from a verified webhook. The browser can never confirm a
   ticket, no matter what it posts.

When the 55th ticket confirms, `/tickets` and `/checkout` redirect to
`/sold-out`, the homepage button changes, and `/api/checkout` answers
`409 SOLD_OUT`.

---

## Changing the numbers

Capacity, price, date and venue live in two places that must agree:

1. `src/lib/event.ts` — drives every piece of copy on the site.
2. The `Event` row in the database — the actual authority for capacity and
   price.

Change `EVENT.capacity` (or `priceCents`) in `src/lib/event.ts` and re-run
`npm run seed`; the seed upserts the row, so the database follows. Or change
capacity alone at any time, with no deploy:

```sql
UPDATE "Event" SET capacity = 60 WHERE slug = 'parks-splash-2026';
```

Lowering capacity below the number already sold does not cancel anyone — it
simply stops further sales.

## When a payment arrives too late

A seat is held for 15 minutes. If a guest takes longer and pays after the hold
lapses, the seat is reclaimed automatically *if there is still room*. If the
room filled up in the meantime the payment is recorded as `PAID` with a
"refund this guest" note and **no ticket is issued** — the 55 cap is never
broken to accommodate a late payment. Those show up on the dashboard as a
ticket that is EXPIRED or FAILED with a PAID payment; refund them in the
PayFast dashboard.

## Security notes

- **Webhooks are verified three ways**: the MD5 signature over the fields in
  the order PayFast sent them, the source IP resolved against PayFast's hosts,
  and a server-to-server callback to PayFast's `validate` endpoint. The amount
  is then compared to the ticket price before anything is confirmed.
- **Duplicate webhooks are inert.** Every notification is recorded first under
  a unique `(provider, externalId)`; a replay returns `200` and stops. Ticket
  confirmation is idempotent on top of that, and the email only goes out on
  the first pass.
- **QR codes carry no personal data** — just `PSWP1.<ticket-number>.<random
  token>.<HMAC>`. The token is 32 random bytes and means nothing without the
  database; the HMAC lets the scanner reject forgeries before a query runs.
- **Check-in is single-use** at the database level: a conditional
  `UPDATE … WHERE checked_in = false` plus a unique index on `CheckIn.ticketId`.
  Two scanners at once cannot both succeed.
- **Admin auth**: scrypt password hashes, random 32-byte session tokens stored
  as SHA-256 digests, HMAC-signed httpOnly cookies, 12-hour expiry, server-side
  revocation. `middleware.ts` rejects unsigned cookies at the edge; every admin
  page and route *also* re-checks the session in the database.
- **Rate limits** on checkout (8 / 10 min / IP), sign-in (6 / 15 min / IP) and
  scanning, stored in Postgres so they work across serverless instances.
- **Also**: same-origin checks on state-changing routes, Zod validation and
  input sanitising, CSP and the usual security headers, HSTS when served over
  HTTPS, `robots: noindex` on every ticket and admin page, and an `AuditLog`
  of every organiser action.
- Guest personal data is served from exactly one endpoint, `/api/admin/guests`,
  behind authentication. `/api/availability` returns counts only.

---

## Verifying it before the event

With the app running under the mock provider:

```bash
# terminal 1
PAYMENT_PROVIDER=mock EMAIL_MODE=test npm run dev

# terminal 2  (writes and then deletes test data — dev database only)
npm run verify -- --reset
```

It walks the fifteen scenarios end to end: first ticket generated with the
guest's name, QR scan, dashboard count and revenue, check-in, repeat scan
refused, forged QR refused, failed payment releasing its seat, duplicate
webhooks, the 55th ticket, the 56th refused, two simultaneous buyers racing
for the final seat, anonymous access to admin pages, and guest data staying
private.

---

## Deploying to Vercel

### 1 · GitHub

```bash
git init && git add -A
git commit -m "The Parks Splash ticketing"
git remote add origin git@github.com:you/parks-splash.git
git push -u origin main
```

`.gitignore` already excludes every `.env` variant, `.vercel` and
`node_modules`. `.env.example` is the only environment file that ships, and it
contains no real credentials. `public/hero.jpg` and `public/hero-wide.jpg` are
committed, so the photograph deploys with the code.

### 2 · PostgreSQL

Any managed Postgres works — Neon, Supabase, Railway, RDS. One rule:

> **Use the direct (non-pooled) connection string.**

Seat allocation runs an interactive transaction holding
`SELECT … FOR UPDATE`, which is exactly what makes the 55 cap race-proof, and
transaction-mode poolers interfere with that. On Neon take the *Direct
connection* string; on Supabase use port **5432**, not 6543. Fifty-five guests
will never trouble a connection limit.

### 3 · Vercel

Import the repo. Framework detection picks up Next.js; `vercel.json` sets the
daily cron that sweeps lapsed holds.

The `vercel-build` script runs `prisma migrate deploy` before every build, so
the production database is migrated automatically on each deploy. Migrations
are in `prisma/migrations/` and are applied once, in order, and never reset —
`migrate deploy` never drops data. If you would rather run migrations by hand,
delete the `vercel-build` script and run `npm run db:deploy` yourself.

After the first successful deploy, seed the event row and your login once from
your own machine, pointed at the production database:

```bash
DATABASE_URL="<your production url>" \
ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-long-password" \
npm run seed
```

Then open `https://your-domain/api/health`. It reports whether the database is
reachable, whether the event row exists, which payment and email modes are
live, and a `warnings` array listing anything still misconfigured. No secrets
are ever returned.

### 4 · Environment variables to add in Vercel

Project → Settings → Environment Variables. Set each for **Production** (and
Preview if you use it):

| Variable | Value |
|---|---|
| `DATABASE_URL` | direct Postgres connection string, `?sslmode=require` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.co.za` — no trailing slash |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `TICKET_SIGNING_SECRET` | `openssl rand -hex 32` — a different value |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `PAYMENT_PROVIDER` | `payfast` |
| `PAYFAST_MODE` | `sandbox` while testing, then `live` |
| `PAYFAST_MERCHANT_ID` | from the PayFast dashboard |
| `PAYFAST_MERCHANT_KEY` | from the PayFast dashboard |
| `PAYFAST_PASSPHRASE` | your PayFast passphrase, or leave empty |
| `EMAIL_MODE` | `live` |
| `EMAIL_PROVIDER` | `resend` or `sendgrid` |
| `EMAIL_API_KEY` | your provider key |
| `EMAIL_FROM` | `The Parks Splash <tickets@your-domain.co.za>` |
| `EMAIL_REPLY_TO` | an address you actually read |
| `RESERVATION_HOLD_MINUTES` | `15` |

`ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` are only read by the seed
script. Keep them out of Vercel and create organisers with
`npm run admin:create` instead.

**Turn Vercel Deployment Protection off for production.** With Vercel
Authentication enabled, PayFast's notification POST is intercepted by the
login wall and no ticket is ever confirmed. Preview protection is fine.

### 5 · PayFast

1. Dashboard → Settings → paste your live merchant ID, key and passphrase into
   Vercel, set `PAYFAST_MODE=live`, redeploy.
2. Set the ITN / notify URL to
   `https://your-domain.co.za/api/payments/payfast/notify`.
3. PayFast will only post to HTTPS on a real domain, so do this after the
   domain is attached.

Sandbox stays available the whole time: set `PAYFAST_MODE=sandbox` and use
PayFast's public test credentials (`10000100` / `46f0cd694581a`). Switching
back is one variable and a redeploy — nothing in the code changes.

### 6 · Domain

Add the domain in Vercel, point the DNS as instructed, then update
`NEXT_PUBLIC_SITE_URL` to match and redeploy. That variable is what builds
ticket links, email links and the PayFast return/cancel/notify URLs, so a stale
value breaks the payment round trip.

## Go-live checklist

Work down it once. Nothing here takes more than a few minutes.

- [ ] Repo pushed to GitHub; `git status` shows no `.env` file.
- [ ] Postgres created; **direct** connection string copied.
- [ ] Vercel project imported from the repo.
- [ ] Every variable from the table above added for Production.
- [ ] `SESSION_SECRET` and `TICKET_SIGNING_SECRET` are different 64-character values.
- [ ] First deploy succeeded (`vercel-build` ran `prisma migrate deploy`).
- [ ] `npm run seed` run once against the production database.
- [ ] `https://your-domain/api/health` returns `ok: true` with an empty `warnings` array.
- [ ] Domain attached; `NEXT_PUBLIC_SITE_URL` updated to it; redeployed.
- [ ] Vercel Deployment Protection **off** for production.
- [ ] `PAYFAST_MODE=live` with real merchant credentials.
- [ ] ITN URL set in PayFast to `/api/payments/payfast/notify`.
- [ ] `EMAIL_MODE=live`, sender domain verified with your email provider.
- [ ] Bought one real R150 ticket yourself: email arrived, PDF opens, QR scans.
- [ ] That test ticket scanned at `/admin/check-in`, and a second scan said *already checked in*.
- [ ] That test ticket refunded in PayFast and cancelled on the dashboard.
- [ ] Guest list exported to CSV as a paper backup.

## Day-of-event checklist

- Test one real R150 purchase on the live keys and refund it in PayFast.
- Open `/admin/check-in` on the gate phone, sign in, and scan that test ticket.
- Note that camera access needs HTTPS — a phone will refuse on plain HTTP.
- Export the guest list to CSV as a paper backup.
- If the gate phone loses signal, take names and use **Check in** on the
  dashboard later; every manual check-in is recorded and audited.
- Someone drops out? **Cancel** or **Refund** on their row frees the seat
  immediately and the counter reopens. **Transfer** changes the guest details
  on an existing ticket — the only way a ticket changes hands.


## Database hard-cap safety

In addition to the application transaction that serialises seat reservations, the database now has a PostgreSQL safety layer. The Event capacity is constrained to a maximum of 55, and a trigger locks the Event row and rejects any attempt to confirm a ticket once the capacity has been reached. This protects the hard cap even if a future code path or direct SQL write bypasses the normal reservation flow.

Run `npm run db:check` after migrations/seed to verify the production database is reachable and internally consistent.
