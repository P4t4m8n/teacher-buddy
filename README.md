# Teacher Buddy

A small web app for teachers to manage their students and track assignments and grades.
Built as a home assignment; the UI is in Hebrew (RTL) and follows the system light/dark theme.

> [Assignment PDF](./docs/assignment.pdf)


## Demo login

| Field | Value |
|---|---|
| Name | `דנה כהן` |
| ID number | `123456789` |

The sign-in page also has a **"כניסה עם מורה לדוגמה"** button that signs in with this teacher in one click.
There is no registration flow, as the assignment allows. The teachers are created by the seed script (`npm run db:seed`).

The seed also creates demo classes and students in Hebrew (4 classes and 10 students for `דנה כהן`). It adds a second teacher, `יוסי מזרחי` (ID number `111222333`) with one class and two students, so you can check that a teacher only sees their own students. The seed data is in [`prisma/seed-data.ts`](./prisma/seed-data.ts).

## Requirements

- Node.js 22 or newer
- PostgreSQL 15 or newer (developed on 18)

## Run it

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create an empty PostgreSQL database, for example:
#    CREATE DATABASE teacher_buddy;

# 3. Configure the environment
cp .env.example .env        # on Windows PowerShell: Copy-Item .env.example .env
# then edit .env (see "Environment variables" below)

# 4. Create the tables and the demo data
npm run db:setup

# 5. Start the app
npm run dev
```

Open <http://localhost:3000>. Signed-out visitors are always redirected to `/auth`.

For a production build: `npm run build` and then `npm start`.

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@localhost:5432/teacher_buddy` |
| `DATABASE_URL_TEST` | Connection string of a **separate** database used only by the e2e tests |
| `JWT_SECRET` | Secret used to sign session tokens. Use a long random value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `COOKIE_SECURE` | `true` marks the session cookie as `Secure`. Set it to `true` only when the app is served over **https**. Keep `false` for local runs over http: Safari does not store `Secure` cookies on `http://localhost`, so sign-in would not stick. |

### Database scripts

| Script | What it does |
|---|---|
| `npm run db:setup` | Applies the migrations and seeds the demo data |
| `npm run db:migrate` | Applies existing migrations only (`prisma migrate deploy`) |
| `npm run db:seed` | Creates the demo teachers, classes and students (safe to re-run: a teacher who already has data is skipped) |
| `npx prisma migrate dev --name <name>` | After editing `prisma/schema.prisma`: creates and applies a new migration |

## Tests

```bash
npm run test:unit    # Vitest, no database needed
npm run test:e2e     # Playwright (API and UI), needs the test database
```

One-time setup for the e2e tests:

1. Create a second empty database and set `DATABASE_URL_TEST` in `.env`. The e2e run never touches `DATABASE_URL`.
2. Install the browser: `npx playwright install chromium`
3. Prepare the test database: `npm run db:test:setup` (migrates and seeds it). After the seed data changes, use `npm run db:test:reset` instead: it wipes the test database first (and never touches `DATABASE_URL`).
4. **Stop `npm run dev` before running the e2e tests.** Next.js allows one dev server per project folder, and the tests start their own on port 3100.

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Front-end | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | One project for UI and API, server components, fast styling with built-in dark mode and RTL support |
| Back-end | Next.js route handlers (`app/api/...`) and a `proxy.ts` | Simple REST endpoints next to the UI; the proxy guards every route |
| Database | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`) | Relational data (teacher, class, student, assignment), typed queries, versioned migrations |
| Validation | zod | One schema validates request bodies and gives per-field error messages |
| Authentication | JWT in an `httpOnly` cookie (`jose`), passwords hashed with Argon2 (`@node-rs/argon2`) | Stateless sessions, and the ID number (the "password") is never stored in plain text |
| Tests | Vitest (unit) and Playwright (API + UI e2e) | Fast unit tests for the services, real-browser tests for the full flows |

## How authentication works

- The teacher signs in with **name + ID number**. The ID number is the password and is stored only as an Argon2 hash.
- A successful sign-in sets a signed 24-hour JWT in an `httpOnly`, `SameSite=Lax` cookie. It contains only the teacher's id.
- Unknown names and wrong ID numbers return the same error, and both cost the same time (no user enumeration).
- [`proxy.ts`](./proxy.ts) protects everything except `/auth` and the auth API. It verifies the token's signature and expiry; without a valid session, pages redirect to `/auth` and API calls get `401`.
- Pages and handlers then call `getSessionTeacher()` ([`services/auth.service.ts`](./services/auth.service.ts)), which also checks the teacher still exists in the database. Data queries will use this teacher id, never an id sent by the client.
- If a cookie is validly signed but its teacher no longer exists (for example after a database reset), the page redirects to `/api/auth/session-expired`, which clears the cookie. Without this, `/auth` and `/dashboard` would redirect to each other forever.

### Auth API

| Method and path | Auth | Description |
|---|---|---|
| `POST /api/auth/login` | public | Body `{ name, idNumber }`. `200` with `{ teacher }` and the session cookie, `400` with field errors, `401` for wrong credentials |
| `POST /api/auth/logout` | public | Clears the session cookie. `200` |
| `GET /api/auth/me` | session | `200` with `{ teacher: { id, name } }`, `401` otherwise |
| `GET /api/auth/session-expired` | public | Clears the cookie and redirects to `/auth` |

### Students API

| Method and path | Auth | Description |
|---|---|---|
| `GET /api/students` | session | `200` with `{ students: [{ id, name, phone, class: { id, name } }] }`, sorted by name. Only the signed-in teacher's students; `401` otherwise |

The teacher id always comes from the verified session, never from the request, so a teacher cannot read another teacher's students.

## Data model

- **Teacher**: name (unique), password hash
- **Class**: name, belongs to a teacher (unique per teacher)
- **Student**: name, phone, belongs to a teacher and to a class
- **Assignment**: title, due date, status (`TODO` / `SUBMITTED`), optional grade (empty until graded), belongs to a student

All ids are UUID v7. A class that still has students cannot be deleted.

## Project structure

```
app/                 Pages (page.tsx) and route handlers (route.ts) only
  (root)/auth        Sign-in page
  (root)/dashboard   Dashboard with the students table (server-rendered, skeleton while loading)
  api/auth/...       Auth endpoints
  api/students       Students endpoint
components/          UI components, grouped by feature (auth, dashboard, students, ui)
hooks/               Client-side state and logic (useSignIn, useSignOut, useBottomSheet)
services/            Server services (auth.service.ts) and client API services
schemas/             zod schemas
types/               Shared TypeScript types
constants/           Shared constants (demo teacher, auth paths, student action links)
lib/db.ts            Prisma client
prisma/              Schema, migrations and seed
proxy.ts             Route protection
tests/               Playwright e2e tests
scripts/             Helper scripts (test database setup)
```
