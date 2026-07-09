# GearUp 🏋️

**Rent Sports & Outdoor Gear Instantly** — a backend REST API for a sports and outdoor equipment rental marketplace.

Customers browse gear, place rental orders, and pay via Stripe. Providers list and manage their own gear inventory and fulfill orders. Admins oversee users, gear, and rental orders across the platform.

---

## 🛠️ Tech Stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Runtime   | Node.js                                                 |
| Framework | Express                                                 |
| Language  | TypeScript                                              |
| Database  | PostgreSQL                                              |
| ORM       | Prisma                                                  |
| Auth      | JWT (access token; refresh token issued for future use) |
| Payments  | Stripe                                                  |

---

## 📁 Project Structure

```
src/
  modules/
    auth/
    category/
    gear/
    provider/
    rental/
    payment/
    review/
    admin/
      module.routes.ts
      module.controller.ts
      module.service.ts
  middlewares/
    auth.ts
    globalErrorHandler.ts
  utils/
    catchAsync.ts
    appError.ts
    jwt.ts
  config/
    index.ts
  app.ts
  server.ts
prisma/
  schema.prisma
```

Each module follows the same layered pattern: **routes → controller → service**. Controllers stay thin (parse request, call service, shape response); all Prisma logic and business rules live in the service layer.

---

## ⚙️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/gearup"

JWT_ACCESS_SECRET="your-access-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRES_IN="7d"

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

CLIENT_URL="http://localhost:3000"
```

### 3. Run migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Seed an admin account

Admin accounts cannot be created through public registration (`POST /api/auth/register` only accepts `CUSTOMER` or `PROVIDER`). Seed one manually:

```bash
npx prisma studio
```

Insert a row into `users` with `role = ADMIN`, or write a small seed script that hashes a password with bcrypt and inserts it via `prisma.user.create(...)`.

### 5. Run the server

```bash
npm run dev
```

Server starts at `http://localhost:5000`. Health check: `GET /`.

---

## 🔑 Authentication

All protected routes expect:

```
Authorization: Bearer <accessToken>
```

Roles: `CUSTOMER`, `PROVIDER`, `ADMIN` — chosen at registration (Admin excluded, seeded only).

---

## 📚 API Overview

### Auth

| Method | Endpoint             | Access        |
| ------ | -------------------- | ------------- |
| POST   | `/api/auth/register` | Public        |
| POST   | `/api/auth/login`    | Public        |
| GET    | `/api/auth/me`       | Authenticated |

### Categories

| Method | Endpoint                  | Access |
| ------ | ------------------------- | ------ |
| GET    | `/api/category`           | Public |
| POST   | `/api/admin/category`     | Admin  |
| PUT    | `/api/admin/category/:id` | Admin  |
| DELETE | `/api/admin/category/:id` | Admin  |

### Gear

| Method | Endpoint                 | Access                                                                                                              |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/gear`              | Public — supports `searchTerm`, `category`, `brand`, `minPrice`, `maxPrice`, `page`, `limit`, `sortBy`, `sortOrder` |
| GET    | `/api/gear/:id`          | Public                                                                                                              |
| POST   | `/api/provider/gear`     | Provider                                                                                                            |
| PUT    | `/api/provider/gear/:id` | Provider (owner only)                                                                                               |
| DELETE | `/api/provider/gear/:id` | Provider (owner only)                                                                                               |

### Rental Orders

| Method | Endpoint                   | Access                                    |
| ------ | -------------------------- | ----------------------------------------- |
| POST   | `/api/rentals`             | Customer                                  |
| GET    | `/api/rentals`             | Customer                                  |
| GET    | `/api/rentals/:id`         | Customer / Provider (if involved) / Admin |
| PATCH  | `/api/rentals/:id/cancel`  | Customer (owner, only while `PLACED`)     |
| GET    | `/api/provider/orders`     | Provider                                  |
| PATCH  | `/api/provider/orders/:id` | Provider (confirm / pickup / return)      |

### Payments (Stripe)

| Method | Endpoint                | Access                              |
| ------ | ----------------------- | ----------------------------------- |
| POST   | `/api/payments/create`  | Customer                            |
| POST   | `/api/payments/confirm` | Stripe webhook (signature-verified) |
| GET    | `/api/payments`         | Customer                            |
| GET    | `/api/payments/:id`     | Customer (owner)                    |

### Reviews

| Method | Endpoint                    | Access                              |
| ------ | --------------------------- | ----------------------------------- |
| POST   | `/api/reviews`              | Customer (order must be `RETURNED`) |
| GET    | `/api/gear/:gearId/reviews` | Public                              |

### Admin

| Method | Endpoint               | Access                   |
| ------ | ---------------------- | ------------------------ |
| GET    | `/api/admin/users`     | Admin                    |
| PATCH  | `/api/admin/users/:id` | Admin (suspend/activate) |
| GET    | `/api/admin/gear`      | Admin                    |
| GET    | `/api/admin/rentals`   | Admin                    |

---

## 🔄 Rental Order State Machine

```
PLACED ──confirm(Provider)──▶ CONFIRMED ──Stripe payment──▶ PAID ──▶ PICKED_UP ──▶ RETURNED
   │
   └──cancel(Customer)──▶ CANCELLED
```

Transitions are enforced server-side; out-of-sequence requests (e.g. cancelling a `PAID` order) are rejected with `400`.

---

## 💳 Testing Stripe Payments Locally

Stripe can't reach `localhost` directly, so use the Stripe CLI to forward webhook events:

```bash
stripe listen --forward-to localhost:5000/api/payments/confirm
```

Copy the webhook signing secret it prints into `STRIPE_WEBHOOK_SECRET` in `.env`, then trigger test events:

```bash
stripe trigger payment_intent.succeeded
```

---

## 🧪 Testing the API

A Postman collection (`GearUp.postman_collection.json`) is included, covering the full flow in order:

1. **Auth** — register, login, `/me`
2. **Categories** — admin CUD, public read
3. **Gear** — provider CUD, public browse/filter/sort/paginate, ownership rejection test
4. **Rental Orders** — create, list, detail, provider confirm, cancel-rejection test
5. **Payments** — create intent, history, detail
6. **Reviews** — pre-return rejection test, public gear reviews
7. **Provider — Orders** — incoming orders view
8. **Admin** — users, suspend, gear/rentals oversight, category delete conflict test

### How to run it

1. Import `GearUp_API.postman_collection.json` into Postman.
2. Set the `baseUrl` variable if not running on port 5000.
3. Seed an admin account (see setup step 4), then fill in `adminEmail` / `adminPassword` collection variables.
4. Fill up needed collection variables before requesting.
5. Run folders top to bottom.
6. For the Stripe webhook, use the Stripe CLI as described above — Postman cannot forge a valid Stripe signature.

---

## ⚠️ Known Limitations

- Stock is tracked as a flat count per gear item, not per date range — two non-overlapping bookings for the same gear still compete for the same stock counter. True date-range availability checking would require tracking overlapping order windows per gear item, which is out of scope for this version.
- Only Stripe is implemented as a payment gateway (SSLCommerz excluded by design).
- Refresh tokens are issued at login but the `/api/auth/refresh` endpoint is not yet implemented — reserved for future use.

---
