# GearUp API

**Rent sports and outdoor gear in Bangladesh.** This is the REST API behind
GearUp, a rental marketplace with three roles:

- **Customers** find gear, book dates and pay with Stripe.
- **Providers** list gear and move orders from request to return.
- **Admins** manage users, categories, reviews, damage claims and reports.

It is built with Express 5, Prisma 7 and PostgreSQL in TypeScript. The
Next.js client lives in its own repository,
[gearUp-frontend](https://github.com/abdullahmamun1/gearUp-frontend).

|               |                                                      |
| ------------- | ---------------------------------------------------- |
| API           | https://gear-up-backend-two.vercel.app               |
| Website       | https://gear-up-frontend-chi.vercel.app              |
| This repo     | https://github.com/abdullahmamun1/gearup-backend-api |
| Frontend repo | https://github.com/abdullahmamun1/gearUp-frontend    |

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [Requirements](#requirements)
  - [Install and run](#install-and-run)
  - [Environment variables](#environment-variables)
  - [Demo accounts](#demo-accounts)
  - [Scripts](#scripts)
- [Project structure](#project-structure)
- [How the API works](#how-the-api-works)
  - [Response format](#response-format)
  - [Authentication](#authentication)
  - [Errors](#errors)
  - [Rate limits](#rate-limits)
- [API reference](#api-reference)
- [Rental rules](#rental-rules)
  - [Availability](#availability)
  - [Order lifecycle](#order-lifecycle)
  - [Money, deposits and refunds](#money-deposits-and-refunds)
- [Email](#email)
- [AI features](#ai-features)
- [Languages](#languages)
- [Testing](#testing)
  - [Stripe payments locally](#stripe-payments-locally)
- [Deploying to Vercel](#deploying-to-vercel)

## Features

- **Accounts:** email and password or Google sign-in. Email verification,
  password reset and short-lived JWTs with refresh tokens.
- **Gear catalogue:** search, filters (category, brand, price, dates, city,
  distance), sorting, pagination, featured items, live availability per date
  range and public provider profiles.
- **Bookings that can't oversell:** stock is counted per day across
  overlapping orders, and row locks serialise concurrent bookings.
- **Order lifecycle:** provider response and payment deadlines, automatic
  expiry, cancellation with Stripe refunds, pickup, return and deposit
  handling.
- **Stripe Checkout:** rental and deposit charged together, a signed webhook,
  idempotent refunds and automatic refunds for late payments.
- **Messaging:** a chat thread on every order between customer and provider,
  with unread counts and email alerts.
- **Admin tools:** user and category management, review moderation, damage
  claim settlement, a contact inbox, newsletter subscribers, analytics and
  CSV exports.
- **Email:** a transactional outbox with retries, sent in the reader's language.
- **AI (Google Gemini):** trip planner, listing writer, search suggestions,
  review summaries, admin insights and inbox reply drafts.
- **English and Bangla:** stored per user, used for email and AI replies.

## Tech stack

| Area       | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Runtime    | Node.js, TypeScript (ESM)                                    |
| Framework  | Express 5, helmet, cors, express-rate-limit                  |
| Database   | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`)              |
| Validation | Zod 4                                                        |
| Auth       | JWT (access and refresh tokens), bcrypt, Google OAuth (PKCE) |
| Payments   | Stripe Checkout and webhooks                                 |
| Email      | Nodemailer (SMTP, Ethereal in development)                   |
| AI         | Google Gemini (`@google/genai`)                              |
| Images     | Cloudinary signed uploads                                    |
| Build      | tsup (one ESM bundle), deployed on Vercel                    |

## Getting started

### Requirements

- Node.js 20 or newer
- A PostgreSQL database (local, Docker or hosted)
- Optional: a Stripe test account and the Stripe CLI, a Google OAuth client, a
  Gemini API key and a Cloudinary account. Each feature reports a clear error
  when its keys are missing, and the rest of the API still works.

### Install and run

```bash
git clone https://github.com/abdullahmamun1/gearup-backend-api.git
cd gearup-backend-api
npm install                 # also runs prisma generate
cp .env.example .env        # then fill it in (see below)
npx prisma migrate deploy   # create the tables
npm run db:seed             # demo users, categories and gear
npm run dev                 # http://localhost:5000
```

Use `npm run db:migrate -- --name <name>` when you change the Prisma schema.
Never edit a migration that has already been applied.

### Environment variables

| Variable                                                                       | Purpose                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`                                                             | `development` or `production`; the port (default 5000)                                                              |
| `APP_URL`                                                                      | The **frontend** origin. Used for CORS, Stripe return URLs and links in emails.                                     |
| `DATABASE_URL`                                                                 | PostgreSQL connection string                                                                                        |
| `BCRYPT_SALT_ROUNDS`                                                           | Password hashing cost, e.g. `10`                                                                                    |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                      | Token secrets. **Must match the frontend**, which verifies tokens too.                                              |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`                              | Token lifetimes, e.g. `1d` and `30d`                                                                                |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                   | Stripe test keys and the webhook signing secret                                                                     |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                     | Google sign-in                                                                                                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing mail. Leave `SMTP_HOST` empty in development to use a throwaway Ethereal inbox (preview links are logged). |
| `ADMIN_EMAIL`                                                                  | Where contact form messages go (every admin if empty)                                                               |
| `CRON_SECRET`                                                                  | Protects `GET /api/cron/daily`                                                                                      |
| `GEMINI_API_KEY`                                                               | AI features. Optional `GEMINI_MODEL` (default `gemini-flash-lite-latest`) and `GEMINI_THINKING` (default `LOW`).    |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`         | Image uploads. Without them, uploads answer 503.                                                                    |

Read settings through `src/config/index.ts`, not `process.env`.

### Demo accounts

`npm run db:seed` creates these accounts. The password for all of them is
`Password123`. The seed is safe to run again: it never overwrites existing rows.

| Role     | Email                                           |
| -------- | ----------------------------------------------- |
| Admin    | `admin@gearup.com`                              |
| Provider | `provider1@gearup.com` … `provider4@gearup.com` |
| Customer | `customer1@gearup.com` … `customer5@gearup.com` |

### Scripts

| Command                               | What it does                                  |
| ------------------------------------- | --------------------------------------------- |
| `npm run dev`                         | Start with reload (`tsx watch src/server.ts`) |
| `npm run build`                       | Bundle to `dist/server.js` with tsup          |
| `npm start`                           | Run the built bundle                          |
| `npm run typecheck`                   | `tsc --noEmit`                                |
| `npm run db:migrate -- --name <name>` | Create and apply a migration                  |
| `npm run db:seed`                     | Load demo data                                |
| `npm run db:studio`                   | Open Prisma Studio                            |

## Project structure

```
prisma/
  schema/            one file per model, plus enum.prisma and schema.prisma
  migrations/
  seed.ts
src/
  server.ts          connects Prisma and starts listening
  app.ts             middleware, routers, 404 and error handler
  config/            typed settings read from .env
  lib/               prisma, stripe, mailer, gemini clients
  middleware/        auth, validateRequest, rateLimit, globalErrorHandler, notFound
  utils/             catchAsync, sendResponse, createError, jwt, dates, geo, months, …
  modules/
    auth/ gear/ review/ rental/ payment/ provider/ admin/ category/
    favorite/ message/ upload/ providerProfile/ stats/
    contact/ newsletter/ email/ cron/
    ai/ report/ claim/ inbox/
```

Each module follows the same pattern:

| File                   | Holds                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `<name>.route.ts`      | Routes: `router.verb(path, auth(Role.X), validate…(schema), handler)` |
| `<name>.controller.ts` | Thin handlers that call the service and send the response             |
| `<name>.service.ts`    | Prisma queries, ownership checks and business rules                   |
| `<name>.validation.ts` | Zod schemas for the body, params and query                            |
| `<name>.interface.ts`  | TypeScript types (`I` prefix)                                         |

## How the API works

### Response format

Every endpoint answers with the same envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Gear retrieved successfully",
  "data": {}
}
```

Lists are paginated with `?page=` and `?limit=` (at most 100) and return
`data: { data: [...], meta: { page, limit, total, totalPages } }`.

### Authentication

- `POST /api/auth/login` returns `{ accessToken, refreshToken, locale }` in the
  body.
- Send the access token as `Authorization: Bearer <token>` or as an
  `accessToken` cookie. The frontend keeps both tokens in httpOnly cookies.
- `POST /api/auth/refresh-token` issues a new access token.
- Tokens carry `{ id, name, email, role }`. Suspended users get 403. Tokens
  issued before a password reset are rejected.
- Customers must verify their email before paying, and providers before
  publishing gear. Google accounts count as verified.

### Errors

| Cause                         | Status                                  |
| ----------------------------- | --------------------------------------- |
| Invalid input (Zod)           | 400, with `errorDetails[]`              |
| Duplicate unique value        | 400 "Duplicate Key Error"               |
| Missing record                | 404                                     |
| Wrong role or suspended user  | 403                                     |
| Order changed by someone else | 409, so the client can reload and retry |
| Thrown with `createError`     | Its own status                          |

### Rate limits

The frontend calls the API from its own servers, so many visitors share one
IP. Limits that protect an account key on IP plus email, and the AI limits key
on the user or the visitor IP that the frontend forwards in `x-client-ip`.

| Limiter            | Applies to                                           |
| ------------------ | ---------------------------------------------------- |
| `authLimiter`      | Login, register, password reset                      |
| `oauthLimiter`     | Google sign-in                                       |
| `writeLimiter`     | Contact form, newsletter, messages, uploads, replies |
| `aiGlobalLimiter`  | All AI calls together (30 a minute)                  |
| `aiLimiter`        | AI per visitor (8 a minute)                          |
| `aiSuggestLimiter` | Search suggestions per visitor (20 a minute)         |

## API reference

All paths start with `/api`. A Postman collection is included:
`GearUp_API.postman_collection.json`.

**Auth** (`/auth`)

| Method     | Path                                                    | Who                |
| ---------- | ------------------------------------------------------- | ------------------ |
| POST       | `/register` (CUSTOMER or PROVIDER), `/login`, `/google` | Public             |
| POST       | `/refresh-token`                                        | Public             |
| POST       | `/verify-email`, `/resend-verification`                 | Public / signed in |
| POST       | `/forgot-password`, `/reset-password`                   | Public             |
| GET, PATCH | `/me` (profile, location, avatar, language)             | Signed in          |

**Gear and reviews**

| Method      | Path                                                   | Who      |
| ----------- | ------------------------------------------------------ | -------- |
| GET         | `/gear`, `/gear/:gearId`, `/gear/:gearId/availability` | Public   |
| GET         | `/categories`, `/brands`                               | Public   |
| GET         | `/providers/:providerId`                               | Public   |
| GET, POST   | `/provider/gear`                                       | Provider |
| PUT, DELETE | `/provider/gear/:gearId` (PUT replaces the whole item) | Provider |
| GET         | `/gear/:gearId/reviews`                                | Public   |
| POST        | `/reviews` (one per returned order)                    | Customer |

`GET /gear` filters: `searchTerm`, `category` (id), `brand`, `minPrice`,
`maxPrice`, `isAvailable`, `from`/`to` (dates, `YYYY-MM-DD`), `city`,
`near=lat,lng` with `radius` (km), `sortBy` (`name`, `pricePerDay`, `stock`,
`createdAt`, `featured`), `sortOrder`, `page`, `limit`.

**Rentals, payments and messages**

| Method    | Path                                  | Who                                        |
| --------- | ------------------------------------- | ------------------------------------------ |
| POST, GET | `/rentals`                            | Customer                                   |
| GET       | `/rentals/stats`                      | Customer                                   |
| GET       | `/rentals/:orderId`                   | The order's customer, provider or an admin |
| PATCH     | `/rentals/:orderId/cancel`            | Customer                                   |
| GET       | `/provider/orders`, `/provider/stats` | Provider                                   |
| PATCH     | `/provider/orders/:orderId` (status)  | Provider                                   |
| POST      | `/payments/create` (`{ orderId }`)    | Customer                                   |
| GET       | `/payments`, `/payments/:paymentId`   | Signed in                                  |
| POST      | `/payments/confirm` (Stripe webhook)  | Stripe (signed)                            |
| GET, POST | `/rentals/:orderId/messages`          | The order's customer and provider          |
| PATCH     | `/rentals/:orderId/messages/read`     | Same                                       |
| GET       | `/messages/unread`                    | Signed in                                  |

**Account extras**

| Method       | Path                                                            | Who       |
| ------------ | --------------------------------------------------------------- | --------- |
| GET          | `/favorites`                                                    | Customer  |
| POST, DELETE | `/favorites/:gearId`                                            | Customer  |
| POST         | `/uploads/signature`                                            | Signed in |
| POST         | `/contact`                                                      | Public    |
| POST         | `/newsletter`, `/newsletter/confirm`, `/newsletter/unsubscribe` | Public    |

**Admin** (`/admin`, admins only)

| Method              | Path                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| GET, PATCH          | `/users`, `/users/:userId` (role, status)                              |
| GET, PATCH          | `/gear`, `/gear/:gearId` (featured)                                    |
| GET                 | `/rentals`                                                             |
| POST, PATCH, DELETE | `/category`, `/category/:categoryId`                                   |
| GET, PATCH          | `/reviews`, `/reviews/:reviewId` (hide or restore)                     |
| GET, PATCH          | `/claims`, `/claims/:orderId` (settle a deposit claim)                 |
| GET, PATCH          | `/inbox`, `/inbox/:messageId`                                          |
| POST                | `/inbox/:messageId/draft` (AI), `/inbox/:messageId/reply`              |
| GET                 | `/subscribers`                                                         |
| GET                 | `/analytics`, `/analytics/insights`                                    |
| GET                 | `/export/:type` (`users`, `rentals`, `payments`, `subscribers` as CSV) |

**AI** (`/ai`): `POST /gear-finder` and `POST /search-suggest` (public),
`POST /listing-draft` (provider).

**Cron:** `GET /cron/daily` with `Authorization: Bearer <CRON_SECRET>`.

## Rental rules

The rules live in `src/modules/rental/rental.policy.ts` (`RENTAL_POLICY`). The
frontend mirrors them in `src/utils/rental.ts`.

### Availability

- `stock` is the number of units a provider owns. It is never decremented.
- Free units for a date range are `stock` minus the most units held on any day
  in that range by overlapping orders.
- Ranges are half-open, `[startDate, endDate)`: the return day is free for the
  next renter. Dates are calendar days in Asia/Dhaka.
- An order holds units while it is PLACED (until the provider's deadline),
  CONFIRMED (until the payment deadline plus one hour), PAID or PICKED_UP.
- Bookings lock the gear rows (`SELECT … FOR UPDATE`) inside a transaction, so
  two people can't book the last unit at the same time.
- One order has one provider. The minimum order is ৳65.

### Order lifecycle

```
PLACED ──provider confirms──▶ CONFIRMED ──Stripe webhook──▶ PAID ──▶ PICKED_UP ──▶ RETURNED
   │ 48 h, no reply              │ 24 h, unpaid               │
   ▼                             ▼                            ▼
CANCELLED                    CANCELLED                    CANCELLED (refund until 24 h before start)
```

- The provider has 48 hours to confirm or decline, and the customer then has 24
  hours to pay. Both deadlines end no later than the end of the start day.
- Stale orders expire on the next read and in the daily cron.
- Only the Stripe webhook can mark an order PAID. A payment that arrives late,
  or for a cancelled order, is refunded automatically.
- Status changes are conditional writes, so two people acting at once get a 409
  instead of overwriting each other.

### Money, deposits and refunds

- `totalAmount` is the rental. `depositAmount` is separate. Checkout charges
  both as two line items.
- On return the provider either releases the deposit (refunded) or reports
  damage. A damage claim is settled by an admin: keep all, keep part or refund
  all.
- All refunds use Stripe idempotency keys, so a retry never pays out twice.

## Email

- Emails are queued in an outbox inside the same transaction as the change that
  causes them, then sent after the response (`waitUntil` on Vercel).
- A `dedupeKey` stops the same email being queued twice. Failed sends retry
  with backoff, up to 5 attempts.
- Templates are rendered at send time in the recipient's language
  (`email.templates.ts` and `email.templates.bn.ts`). Every value is escaped.
- The daily cron (02:00 UTC, 08:00 in Dhaka) expires stale orders, sends pickup
  reminders and review requests, retries failed mail, refreshes AI review
  summaries and removes old tokens.

## AI features

All AI calls go through `generateJson` in `src/lib/gemini.ts`. It sends a Zod
schema to Gemini and validates the reply against it. Every answer is checked
against real data: unknown gear ids are dropped, category names are mapped to
real ids and prices are clamped to what is normal for the category. Names,
emails and phone numbers are never sent.

| Feature            | Endpoint                        | What it does                                                     |
| ------------------ | ------------------------------- | ---------------------------------------------------------------- |
| Trip planner       | `POST /ai/gear-finder`          | Chat that recommends real, available gear for a trip             |
| Listing writer     | `POST /ai/listing-draft`        | Drafts a description, highlights, category and price             |
| Search suggestions | `POST /ai/search-suggest`       | Up to 4 better searches for a query                              |
| Review summaries   | (background)                    | Summary, pros and cons once an item has 3+ reviews               |
| Admin insights     | `GET /admin/analytics/insights` | Explains changes in the analytics; falls back to rule-based text |
| Inbox reply drafts | `POST /admin/inbox/:id/draft`   | Drafts an answer from the rental policy; never sends             |

If AI is unavailable, the endpoints return clear errors: 503 (no key), 429
(quota), 504 (timeout) or 502 (unreadable reply).

## Languages

Users, newsletter subscribers and contact messages store a `locale` (`en` or
`bn`). Emails, AI replies and inbox drafts use it. Bangla emails use Bengali
digits and link to the `/bn` pages of the site.

## Testing

There is no automated test suite. Before you push:

1. Run `npm run typecheck` and `npm run build`.
2. Exercise the flow you changed with the Postman collection or the frontend.
3. Test against a throwaway database, never production. Override
   `DATABASE_URL` for the run.

### Stripe payments locally

```bash
stripe listen --forward-to localhost:5000/api/payments/confirm
```

Put the `whsec_…` secret it prints in `STRIPE_WEBHOOK_SECRET`, restart the
server and pay with the test card `4242 4242 4242 4242` (any future date, any
CVC). The webhook needs the raw request body, so its `express.raw` mount in
`app.ts` must stay before `express.json()`.

## Deploying to Vercel

1. `vercel.json` sends every request to `dist/server.js`, so the build step
   must run `npm run build`.
2. Set every variable from [Environment variables](#environment-variables) in
   the Vercel project. `APP_URL` is the deployed frontend origin.
3. Run `npx prisma migrate deploy` against the production database.
4. Add a Stripe webhook for `https://<api-domain>/api/payments/confirm` with the
   events `checkout.session.completed`, `checkout.session.expired` and
   `charge.refunded`, and set its secret.
5. The daily cron is registered in `vercel.json`. Vercel sends `CRON_SECRET`
   automatically.
