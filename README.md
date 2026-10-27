# Teacher Buddy

A small web app for teachers to manage students, assignments and grades. The UI is in Hebrew (RTL) with light and dark themes.

> [Assignment brief](./docs/assignment.pdf)

## Demo login

| Field | Value |
|---|---|
| Name | `דנה כהן` |
| ID number | `123456789` |

The sign-in page also has a demo button that signs in with this teacher. There is no registration, as the brief allows. Teachers are created by the seed script.

The seed gives the demo teacher classes, 45 students and 45 assignments (so the lists have 3 pages), with every status and small sample files. A second teacher, `יוסי מזרחי` (`111222333`), has a little data of his own, to show that a teacher only sees their own data. Two more teachers exist for the automated tests.

## Requirements

- Node.js 22 or newer
- PostgreSQL 15 or newer

## Run it

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
# edit .env (see below), and create an empty PostgreSQL database
npm run db:setup            # migrations + demo data
npm run dev
```

Open <http://localhost:3000>. Signed-out visitors are redirected to `/auth`. For production: `npm run build`, then `npm start`.

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string of the app |
| `DATABASE_URL_TEST` | A **separate** database used only by the e2e tests (its name must contain `test`) |
| `JWT_SECRET` | Secret for signing session tokens, a long random value |
| `COOKIE_SECURE` | `true` only when served over https (Safari drops `Secure` cookies on `http://localhost`) |

### Scripts

| Script | What it does |
|---|---|
| `npm run db:setup` | Applies the migrations and seeds the demo data |
| `npm run db:migrate` | Applies the migrations only |
| `npm run db:seed` | Seeds the demo data (safe to repeat: it only adds what is missing) |
| `npm run test:unit` | Unit tests (Vitest), no database needed |
| `npm run test:e2e` | API and UI tests (Playwright), needs the test database |
| `npm run db:test:setup` / `db:test:reset` | Prepares / wipes and prepares the test database |

## Features

- **Sign-in** by name and ID number, with a cookie session. Too many wrong tries are refused for a while.
- **Students:** list with search (name or phone), class filter, sorting and pages of 20; add, edit, view and delete.
- **Assignments:** list with search, sorting and pages; create and edit with a rich text description and a multi-select of students; delete.
- **Per student:** the teacher uploads the checked assignment (PDF or image, up to 4 MB), then gives a grade from 0 to 100. The status is `לביצוע` (to do), `הוגשה` (submitted) or `נבדקה` (checked). It follows from the file and the grade and is never set by hand. A grade needs an uploaded file.
- Removing a student who already submitted from an assignment asks for confirmation first, because their file and grade are deleted.
- Not-found and error pages, and Hebrew messages for every error.

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Front end | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | One project for UI and API, server components, built-in dark mode and RTL |
| Back end | Next.js route handlers (`app/api`) and `proxy.ts` | Simple REST endpoints; the proxy guards every route |
| Database | PostgreSQL with Prisma 7 | Relational data, typed queries, versioned migrations |
| Validation | zod | One schema per request, with per-field Hebrew messages |
| Auth | JWT in an `httpOnly` cookie (`jose`), Argon2 (`@node-rs/argon2`) | The ID number is the password and is stored only as a hash |
| Rich text | Tiptap, `sanitize-html` on the server | The description is cleaned with the same allowlist the editor uses |
| Tests | Vitest and Playwright | Fast unit tests, real-browser tests for the full flows |

## How it works

- **Auth:** a successful sign-in sets a signed 24-hour JWT with only the teacher's id. `proxy.ts` checks the token on every request (pages redirect to `/auth`, the API answers `401`). Pages and handlers then check that the teacher still exists. The teacher id always comes from the session, never from the request, and every query is scoped by it.
- **Login limit:** 5 wrong tries in 15 minutes per client address and name, answered with `429` and `Retry-After`. The counts live in the server's memory, so they reset on restart and are not shared between servers. A real deployment would use a shared store such as Redis.
- **Errors:** services throw an `AppError` with a status and a Hebrew message, and every route handler passes it to `handleRouteError`. The response is `{ "error": "..." }`, plus `"fields"` for validation errors.
- **Files:** the upload type is read from the file's first bytes, never from its name. The file is stored in the database (its own table, so lists never load it) and served with `nosniff`.
- **Search and pages:** the state is in the address (`?q=&class=&sort=&page=`), and the server does the work. An invalid value falls back to the default. `%` and `_` in a search match themselves.
- **Rich text:** only paragraphs, headings, bold, italic and lists are kept, on the client and again on the server.

## Data model

Teacher, Class, Student (belongs to a teacher and a class), Assignment (title, rich text description, due date), AssignmentStudent (one student's part: status, grade, submitted date) and SubmissionFile (the uploaded bytes). All ids are UUIDs. Two database checks keep a part consistent: the grade is 0 to 100, and the status matches the file and the grade. Deleting a student or an assignment cascades to their parts and files.

## API

All endpoints need a session except sign-in. Teachers only reach their own data (anything else is `404`).

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Session |
| `GET`, `POST /api/students` | List, create |
| `GET`, `PUT`, `DELETE /api/students/[id]` | One student |
| `GET /api/classes` | The teacher's classes |
| `GET`, `POST /api/assignments` | List, create |
| `GET`, `PUT`, `DELETE /api/assignments/[id]` | One assignment (`PUT` can carry `confirmedRemovalIds`) |
| `PUT`, `GET /api/assignments/[id]/students/[studentId]/file` | Upload / read a student's file |
| `PUT /api/assignments/[id]/students/[studentId]/grade` | Set or clear a grade |

## Project structure

```
app/          pages and route handlers only
components/   UI, grouped by feature, and shared ui/
hooks/        client state and logic
services/     server services (database) and client services (fetch)
schemas/      zod schemas
lib/ helpers/ constants/ types/
prisma/       schema, migrations, seed
tests/        Playwright tests; unit tests sit next to the code (*.test.ts)
docs/         diagrams and sample upload files
```

Diagrams of the flows and of each page's components are in [`docs/architecture.md`](./docs/architecture.md) and [`docs/component-tree.md`](./docs/component-tree.md). Sample files to try an upload by hand are in [`docs/samples/`](./docs/samples).

## Tests

```bash
npm run test:unit
npm run test:e2e
```

One-time setup for the e2e tests: create a second empty database and set `DATABASE_URL_TEST`, run `npx playwright install chromium`, then `npm run db:test:setup`. Stop `npm run dev` before running them: Next.js allows one dev server per folder, and the tests start their own on port 3100. The test database is seeded without the extra demo data, because many tests count the demo teacher's 10 students and 4 assignments. Tests that create data use their own teachers, so the demo data is never changed.

## Known limits

- Classes are not managed in the app (the brief does not ask for it, and there is no admin role): they come from the seed.
- Files are stored in the database to keep the project to one service. A real version would use object storage.
- The login limit is in memory (see above).
