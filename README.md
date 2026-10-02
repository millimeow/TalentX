# TalentX (MVP)

A marketplace for the creative industry: post shoots and casting calls, apply, sign a digital
contract, pay into **demo escrow**, get paid in two 50% parts, rent gear, and rate each other.
Built with **Node.js, Express, PostgreSQL (Prisma)** and a plain HTML/CSS/JS frontend, following
the PRD v1.0.

> Payments are simulated. The UI says "Demo payments" — real escrow needs a licensed payment
> partner and is out of scope.

## Quick start

```bash
# 1. PostgreSQL running locally, then set DATABASE_URL in .env
#    (default .env points to postgresql://aayushray@localhost:5432/talentx)

# 2. Install + create schema + seed demo data
npm install
npx prisma migrate dev
node prisma/seed.js

# 3. Run
npm start            # http://localhost:3000 (or the PORT in .env)

# Verify everything: full flow end-to-end (server must be running)
node scripts/e2e-test.mjs    # 55 checks — escrow, disputes, rentals, ratings, admin, oauth
```

### Google sign-in (optional, 5-minute setup)

Login supports email/password **and Google OAuth** via Google Identity Services — no extra npm
packages, the ID token is verified against Google's public tokeninfo endpoint.

1. Open https://console.cloud.google.com/apis/credentials → **Create credentials → OAuth client ID**
2. Application type **Web application**, authorised JavaScript origin `http://localhost:3100`
   (add your production origin too, e.g. `https://yourapp.onrender.com`)
3. Put the client id in `.env` as `GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com` and restart.
4. The login page now shows the official **Continue with Google** button; the first sign-in creates
   the account automatically (it can only be entered through Google until a password is set).

Without a client id the app still works — the login page shows a note explaining the setup.

Demo accounts (all passwords `password123`, admin `admin123`):

| Account | Email | Notes |
|---|---|---|
| Meera | meera@talentx.test | giver, has a completed gig + a delivered gig |
| Arjun | arjun@talentx.test | taker, wallet has escrow payouts |
| Zoya | zoya@talentx.test | PRO plan, has an open dispute |
| Kabir | kabir@talentx.test | gear owner, flagged for review (avg < 2.0) |
| Admin | admin@talentx.test | admin panel (disputes, flagged, suspend) |

The seed also creates a contract delivered **6 days ago** — the hourly auto-release job completes
it on server start (PRD 4.4: giver does nothing for 5 days → remaining 50% releases).

## Walkthrough of the money flow

1. **Post a gig** (Dashboard → or "Post a gig") — free plan allows 3 posts/month.
2. **Apply** to a gig from the gig board; the giver accepts one applicant.
3. **Contract**: the giver uploads the contract PDF + agreed amount on the gig page.
4. **Taker** opens/downloads the PDF and clicks accept (Contract page).
5. **Giver deposits 100%** into escrow — one `prisma.$transaction` moves the money and records it.
6. **Giver confirms the shoot finished** → first 50% moves to the taker.
7. **Taker delivers** (file or link) → **giver approves** → remaining 50% releases. Gig is COMPLETED.
8. **Both rate each other** (1–5 on professionalism, punctuality, quality, communication).
9. If something goes wrong: **dispute** freezes the rest; an admin releases, refunds or splits it.

Rentals work in parallel: request dates → owner approves + uploads agreement PDF → renter pays
rent + deposit into escrow → PRE/POST inspections by both sides → owner confirms the return
(rent to owner, deposit back) or raises a dispute.

## API

All endpoints live under `/api/v1`. Highlights:

```
POST /auth/register /auth/login /auth/refresh /auth/logout
GET|PUT /profile/me   POST /profile/me/photo      GET /users/:id
POST /portfolio       GET /users/:id/portfolio    DELETE /portfolio/:id
POST|GET /gigs        GET|PUT|DELETE /gigs/:id
POST /gigs/:id/apply  GET /gigs/:id/applications  POST /applications/:id/accept
GET  /applications/mine
POST /contracts (PDF)  GET /contracts/mine  GET /contracts/:id/pdf (auth-checked)
POST /contracts/:id/accept|deposit|confirm-shoot|deliver|approve|dispute
GET  /wallet          POST /wallet/topup
POST /equipment       GET /equipment|/equipment/:id
POST /rentals         POST /rentals/:id/approve|sign-and-pay|return|dispute|inspection
GET  /rentals/:id/agreement
POST /ratings         GET /users/:id/ratings
POST /plans/upgrade|downgrade
GET  /admin/disputes  POST /admin/disputes/:id/decide  GET /admin/flagged  POST /admin/users/:id/suspend
```

Status codes used: 200, 201, 400, 401, 403, 404, 409, 500.

## Structure (one feature = its own files)

```
prisma/          schema.prisma (14 models), seed.js
src/routes/      one file per feature (auth, gig, contract, rental, admin, ...)
src/controllers/ same names
src/middleware/  authenticate, requireAdmin, uploadImage, uploadPdf, checkPlanLimit, errorHandler
src/utils/       AppError, tokens, wallet (escrow moves), ratings, autoRelease
src/app.js       mounts everything
server.js        listens + hourly auto-release job
public/          css/ (theme, base, animations, per page), js/ (api helper + per page), pages/
uploads/         photos/ (public), contracts/ (NOT public — auth-checked), deliverables/
```

## Security rules implemented

- Passwords hashed (bcryptjs); `passwordHash` never returned.
- Every protected route uses `authenticate`; `requireAdmin` guards the admin panel.
- Ownership checks everywhere (only the giver accepts, only the taker delivers, only
  participants open contract/agreement PDFs).
- Inputs validated before touching the database; uploads limited (images 5 MB, PDFs 10 MB).
- Money movements always inside `prisma.$transaction`; every movement writes a WalletTransaction.
- Refresh tokens stored in DB, rotated on refresh, deleted on logout; suspended users blocked
  instantly (authenticate re-reads the user).

## Deploying

The app runs as a normal Node server locally and on Render (`npm start`).
Vercel is also supported through `api/index.js` + `vercel.json` — but it needs
a **hosted** database and, for uploads, a host with persistent storage.

### Deploy to Vercel (step by step)

1. **Create a hosted PostgreSQL** — e.g. [Neon](https://neon.tech), Vercel Postgres or Supabase.
   Copy its connection string (looks like `postgresql://user:pass@host/db?sslmode=require`).
2. **Import the repo in Vercel** (or run `vercel` in the project folder). The included
   `vercel.json` routes everything to `api/index.js` and registers a daily cron.
3. **Set environment variables** in Vercel → Project → Settings → Environment Variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the hosted Postgres connection string (**never** `localhost` — that's why a fresh deploy 500s on every API call) |
   | `JWT_ACCESS_SECRET` | any long random string |
   | `JWT_REFRESH_SECRET` | a different long random string |
   | `GOOGLE_CLIENT_ID` | optional — enables "Continue with Google" |
   | `CRON_SECRET` | optional — random string; Vercel cron sends it as a bearer token |

4. **Create the schema + demo data** in the hosted database, from your machine:
   ```bash
   DATABASE_URL="<hosted url>" npx prisma migrate deploy
   DATABASE_URL="<hosted url>" node prisma/seed.js
   ```
5. Redeploy. Now a 500 response will *say* what is wrong (missing `DATABASE_URL`,
   unreachable database, missing JWT secret) instead of a generic message —
   the function logs in the Vercel dashboard show the full stack trace.

### Deployment caveats

- **Uploads on Vercel**: serverless filesystems are read-only except `/tmp`, so contract
  PDFs, gear photos and deliverables only exist for the duration of a request there.
  For the *full* escrow flow with real PDF storage, deploy on **Render with a persistent
  disk** (the PRD's own suggestion) or wire in blob storage. Everything else works on Vercel.
- **Auto-release on Vercel**: the 5-day escrow release runs from the `/api/v1/jobs/auto-release`
  cron in `vercel.json` (daily on the Hobby plan — change the schedule on Pro). Locally and on
  Render it still runs on server start + every hour.
- **Google OAuth origins**: add your Vercel domain (e.g. `https://talent-x-vert.vercel.app`)
  to the authorised JavaScript origins of your Google OAuth client.

### Deploy to Render (full-featured alternative)

1. New Web Service → Node. Build: `npm install && npx prisma migrate deploy`. Start: `npm start`.
2. Attach a persistent disk mounted at `/opt/render/project/src/uploads` (or set `UPLOAD_DIR`
   to the disk mount) so uploads survive redeploys.
3. Set the same environment variables as above.

## Notes

- Money is stored as whole rupees (integers) so the 50/50 split is always exact.
- `uploads/contracts` is deliberately not served statically — PDFs go through
  `/api/v1/contracts/:id/pdf` and `/api/v1/rentals/:id/agreement` after a role check.
- On Render, the free disk wipes on redeploy: attach a persistent disk or accept uploads reset.
