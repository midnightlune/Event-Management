# TicketHub - Event Ticket Booking & Seat Allocation System

DBMS Mini Project. 

PES2UG24CS324: Nirupama Jayaraman
PES2UG24CS329: Niya Ann Joseph

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/API:** Next.js Route Handlers (`app/api/**/route.ts`)
- **Databases:** MySQL 8 (transactional data) + MongoDB (event content, seat maps, reviews, activity logs)

Seats are allocated inside MySQL stored procedures that lock the chosen seats (`SELECT ... FOR UPDATE`),
so two people can never hold the same seat. A trigger and a scheduled event release cancelled or unpaid seats.

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.6 or newer | needed for `node --env-file` used by the setup scripts |
| MySQL Server | 8.0.16 or newer | older versions ignore CHECK constraints |
| MongoDB | 6 or newer | MongoDB Compass connects to the same server |

## 2. Setup

```bash
npm install
cp .env.example .env.local      # then edit .env.local (MySQL admin password, the five DB_*_PASSWORD values, AUTH_SECRET)
npm run setup:all               # creates the MySQL database + sample data, demo passwords, MySQL roles and accounts, seeds MongoDB
npm run dev                     # http://localhost:3000
```

`npm run setup:all` is four steps you can also run one at a time:

| Command | What it does |
|---------|--------------|
| `npm run db:setup` | **Drops and re-creates** the `ticketdb` MySQL database from `db/schema.sql` and `db/seed.sql` |
| `npm run db:passwords` | Gives every sample user a real bcrypt hash of the demo password |
| `npm run db:roles` | Creates the MySQL roles from `db/roles.sql` and one login account per role (passwords from `.env.local`) |
| `npm run mongo:seed` | **Empties** the four MongoDB collections, then loads sample documents and creates indexes |
| `db/ddl_examples.sql` | Optional: ALTER and DROP examples for the report (`mysql -u root -p ticketdb < db/ddl_examples.sql`) |
| `db/extra_queries.sql` | Optional: recursive CTE and outer-join queries (`mysql -u root -p ticketdb < db/extra_queries.sql`) |
| `npm run db:test` | Logs in as every role account and checks what is allowed and refused, and every booking-status transition (45 checks). It books and cancels a few seats, so re-run `db:setup`, `db:passwords`, `db:roles` afterwards. |

Alternatively load the SQL yourself: `mysql -u root -p < db/schema.sql` then `mysql -u root -p < db/seed.sql` then `mysql -u root -p < db/roles.sql`
(the last one defines roles only; `npm run db:roles` is what creates the login accounts).

**Event scheduler:** unpaid holds expire through a MySQL event. Turn the scheduler on once (or add
`event_scheduler=ON` to `my.cnf`):

```sql
SET GLOBAL event_scheduler = ON;
```

**MongoDB Compass:** connect to `mongodb://localhost:27017`. After seeding you will see the database `ticketdb`
with the collections `event_details`, `seat_maps`, `reviews` and `activity_logs`.

## 3. Demo accounts

Password for every sample user: **`Password@123`**

| Role | Email |
|------|-------|
| Admin | admin@ticketdb.in |
| Organizer | meera@liveevents.in, karthik@showtime.in |
| Customer | anita@mail.com, rohan@mail.com, divya@mail.com, imran@mail.com |

## 4. Project structure

```
app/
  api/                    Route Handlers (the backend)
    auth/                 register, login, logout, me
    events/               list + search, event details (MySQL + MongoDB)
    shows/[id]/seats      seat availability + seat map layout
    bookings/             hold (book_seats), history, pay (confirm_payment), cancel
    reviews/              reviews stored in MongoDB
    organizer/            create event, add show, dashboard (views)
    admin/                summary (MySQL + MongoDB aggregation), users, venues
  events, shows, checkout, my-bookings, organizer, admin, login, register   (pages)
components/               NavBar, shared UI pieces
lib/                      db.ts (one MySQL pool per role: dbFor(role)), mongo.ts, auth.ts (JWT session), validation.ts (zod), http.ts
middleware.ts             page-level role protection
db/                       schema.sql (tables, indexes, views, procedures, functions, triggers, event), seed.sql,
                          ddl_examples.sql, extra_queries.sql, roles.sql (MySQL roles and privileges)
scripts/                  setup-mysql.mjs, set-passwords.mjs, setup-roles.mjs, seed-mongo.mjs, test-db-security.mjs
```

## 5. Which database holds what

| Data | Database | Why |
|------|----------|-----|
| Users, roles, venues, events, shows, seats, bookings, payments, cancellations | MySQL | relationships, constraints, ACID transactions, row locking |
| Event descriptions, line-ups, FAQs | MongoDB `event_details` | varying structure, nested arrays, no joins |
| Seat-map layout (stage, aisles) | MongoDB `seat_maps` | hierarchical JSON rendered directly by the UI |
| Reviews and ratings | MongoDB `reviews` | self-contained documents, aggregation for averages |
| Activity log | MongoDB `activity_logs` | append-only events, TTL index (90 days) |

If MongoDB is unreachable, event pages and booking still work; only descriptions, seat-map aisles, reviews
and analytics are missing.
