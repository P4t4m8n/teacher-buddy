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

The seed also creates demo classes and students in Hebrew (4 classes and 10 students for `דנה כהן`). It adds a second teacher, `יוסי מזרחי` (ID number `111222333`) with one class and two students, so you can check that a teacher only sees their own students. A third teacher, `נעמה שרון` (ID number `444555666`), and a fourth, `רונית אביב` (ID number `777888999`), exist for the automated tests that create data, so those tests never change the demo teachers' data. The seed data is in [`prisma/seed-data.ts`](./prisma/seed-data.ts).

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

The tests that create students use two dedicated teachers (`נעמה שרון` and `רונית אביב`), so the demo teachers' data is never changed. Before every run, `tests/global-setup.ts` deletes everything those two teachers gained in earlier runs and keeps their seeded students. It refuses to run unless the database name in `DATABASE_URL_TEST` contains "test". It then warms up the dev server (loads the pages once in a browser, creating no data), because the first requests would otherwise all wait for the pages to compile at the same time and time out.

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Front-end | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | One project for UI and API, server components, fast styling with built-in dark mode and RTL support |
| Back-end | Next.js route handlers (`app/api/...`) and a `proxy.ts` | Simple REST endpoints next to the UI; the proxy guards every route |
| Database | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`) | Relational data (teacher, class, student, assignment), typed queries, versioned migrations |
| Validation | zod | One schema validates request bodies and gives per-field error messages |
| Authentication | JWT in an `httpOnly` cookie (`jose`), passwords hashed with Argon2 (`@node-rs/argon2`) | Stateless sessions, and the ID number (the "password") is never stored in plain text |
| Rich text | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`), `sanitize-html` on the server | The assignment description is written in a rich text editor (bold, italic, headings, lists). Only those formats are enabled, and the server cleans the saved HTML with the same allowlist |
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
| `POST /api/students` | session | Body `{ name, phone, classId }`. `201` with `{ student }` (same shape as the list items). `400` with field errors, `401`, `404` if the class does not exist or is not the teacher's, `409` if the teacher already has a student with the same name and phone |
| `GET /api/students/[id]` | session | `200` with `{ student: { id, name, phone, class: { id, name } } }`. `401`, or `404` if there is no such student, it belongs to another teacher, or the id is not a uuid (all three answer the same, so ids cannot be probed) |
| `PUT /api/students/[id]` | session | Body `{ name, phone, classId }`, all three required (the same rules and phone format as `POST`). `200` with `{ student }`. `400` with field errors, `401`, `404` if the student is not found (same cases as `GET`) or the class does not exist or is not the teacher's, `409` if another of the teacher's students already has that name and phone. The student is checked before the class, and the student's assignments are kept |
| `DELETE /api/students/[id]` | session | `200` with `{ id }`. Deletes the student and their assignments for good (the database cascades the delete). `401`, or `404` in the same cases as above |

Validation for `POST /api/students`: the name is trimmed, 2-60 characters, letters, spaces, apostrophes and hyphens only. The phone is an Israeli number, trimmed, accepted with or without the hyphen (`050-1234567`, `0501234567`, `03-1234567` and `031234567` are all valid). It is saved in one format: `xxx-xxxxxxx` for 10 digits (`050-1234567`) and `xx-xxxxxxx` for 9-digit landlines (`03-1234567`), so the same phone is always the same text. A teacher cannot have two students with the same name and phone: the database has a unique index on `(teacherId, name, phone)`, so this also holds when two identical requests arrive at the same moment (one is created, the others get `409`). Two different teachers can each have a student with the same name and phone.

### Assignments API

An assignment is given to one or more students. Each student has their own part of it: a status, the uploaded file and a grade (see "Data model").

| Method and path | Auth | Description |
|---|---|---|
| `GET /api/assignments` | session | `200` with `{ assignments: [{ id, title, dueDate, studentCount, submittedCount }] }`, latest due date first. Only the signed-in teacher's assignments, without the description or the students (`submittedCount` is the students whose status is not `TODO`); `401` otherwise |
| `POST /api/assignments` | session | Body `{ title, description?, dueDate, studentIds }`. `201` with `{ assignment }` (see below). `400` with field errors, `401`, `404` if any student does not exist or is not the teacher's (nothing is created) |
| `GET /api/assignments/[id]` | session | `200` with `{ assignment: { id, title, dueDate, description, students: [{ studentId, name, className, status, submittedAt, grade, file }] } }`, students ordered by name. `file` is `null` or `{ name, kind, url }` (the bytes are never in this response). `401`, or `404` if there is no such assignment, it belongs to another teacher, or the id is not a uuid (all three answer the same) |
| `PUT /api/assignments/[id]` | session | Body `{ title, description?, dueDate, studentIds }`, the same rules as `POST`. Replaces the four fields and returns `200` with `{ assignment }`. A student who stays keeps their file, grade and status, a new student starts as `TODO`, and a removed student loses their part. `400` with field errors, `401`, `404` if the assignment is not found (same cases as `GET`) or a student does not exist or is not the teacher's, `409` if a removed student already submitted (a file and a grade are never lost this way). It is one transaction: any error means nothing was changed |
| `DELETE /api/assignments/[id]` | session | `200` with `{ id }`. Deletes the assignment together with every student's part and file (the database cascades the delete); the students are not touched. `401`, or `404` in the same cases as `GET` |
| `PUT /api/assignments/[id]/students/[studentId]/file` | session | The teacher uploads the checked assignment of one student. Body is `multipart/form-data` with one field, `file`. `200` with `{ student }` (the part, in the shape of the `students` items above). `400` with a field error for no file, an empty file, a file over 4 MB or a type that is not allowed, `401`, `404` if there is no such assignment, it belongs to another teacher, the student is not in it, or an id is not a uuid (all answer the same), `413` if the request is far over the limit (it is refused before it is read) |

Upload rules for `PUT …/file`: the file is a PDF or an image (PNG, JPEG, WebP), up to 4 MB (4 MB is under the 4.5 MB request limit of Vercel). The type is read from the first bytes of the file, never from its name or from the type the browser says, so a text, HTML or SVG file with a `.pdf` name is refused, and the saved type is the real one. The name is cleaned (a path, control characters and direction marks are dropped, and it is cut to 255 characters). The first file makes the student's part `SUBMITTED` and sets the date to the day of the upload (Israel time). A new file for a part that already has one replaces it and keeps the status: a `CHECKED` part stays `CHECKED` with the same grade, and the teacher decides if the grade should change. Two uploads for the same student at once leave one file. The status, the grade and the date are never taken from the form. The file is saved in the database as bytes, in its own table, so the lists never load it.

Validation for `POST /api/assignments`: the title is trimmed, 2-100 characters, with at least one letter or digit. The description is optional (up to 20,000 characters) and is cleaned on the server before it is saved: only what the editor makes is kept (paragraphs, `h2`/`h3`, bold, italic, bullet and numbered lists, line breaks), with no attributes, so scripts, event handlers and links cannot be saved even if the request does not come from the editor. The due date is a real `yyyy-mm-dd` day between the years 2000 and 2100. `studentIds` has 1-500 uuids; a student chosen twice counts once. The assignment and its students are created in one statement. The status of every student starts as `TODO`, and is never taken from the request. `submittedAt` is the day of the upload in Israel time.

The teacher id always comes from the verified session, never from the request, so a teacher cannot read, change, delete or add to another teacher's students or classes, or read another teacher's assignments.

### Classes API

| Method and path | Auth | Description |
|---|---|---|
| `GET /api/classes` | session | `200` with `{ classes: [{ id, name }] }`, sorted by name. All of the signed-in teacher's classes, including classes with no students; `401` otherwise |

### Error responses

Every error the API returns has the same shape, and its message is in Hebrew: `{ "error": "<Hebrew message>" }`, plus `"fields": { "<field>": ["<Hebrew message>"] }` for a `400` validation error.

| Status | Meaning |
|---|---|
| `400` | The body is not valid JSON, or a field failed validation (with `fields`) |
| `401` | No valid session, or wrong credentials on login |
| `404` | The thing asked for does not exist (or belongs to another teacher) |
| `409` | The thing already exists |
| `500` | An unexpected failure. The client only gets a generic message; the details are logged on the server |

In the code, services throw an `AppError` ([`lib/AppError.ts`](./lib/AppError.ts)) with a status and a Hebrew message, and every route handler's `catch` calls `handleRouteError` ([`lib/apiRoute.ts`](./lib/apiRoute.ts)). The Hebrew texts are all in [`constants/error.constant.ts`](./constants/error.constant.ts), and zod's built-in messages are switched to its Hebrew locale.

## Data model

- **Teacher**: name (unique), password hash
- **Class**: name, belongs to a teacher (unique per teacher)
- **Student**: name, phone, belongs to a teacher and to a class. Unique per teacher by name and phone
- **Assignment**: title, description (HTML from the rich text editor), due date (a date, no time), belongs to a teacher. It is given to one or more students
- **AssignmentStudent** (one student's part of an assignment): status, optional grade, when it was submitted, and the uploaded file. Unique per assignment and student
- **SubmissionFile**: the uploaded PDF or image, stored in the database as binary (`bytea`) in its own table, so lists never load the bytes

**Status of a student's assignment** is never chosen by hand, it follows from the file and the grade:

| Status | Hebrew | When |
|---|---|---|
| `TODO` | לביצוע | nothing was uploaded yet |
| `SUBMITTED` | הוגשה | the teacher uploaded the student's assignment (this happens automatically) |
| `CHECKED` | נבדקה | the teacher saved a grade (0-100) |

A grade needs an uploaded assignment. The database enforces this with two checks that the migration adds (`AssignmentStudent_status_matches` and `AssignmentStudent_grade_range`), so the rows stay consistent even if code forgets a rule. They are tested directly in `tests/assignments.schema.spec.ts`.

All ids are UUID v7. A class that still has students cannot be deleted. Deleting a student deletes that student's parts of assignments and their files (the assignment itself stays).

## Project structure

```
app/                 Pages (page.tsx) and route handlers (route.ts) only
  (root)/auth        Sign-in page
  (root)/dashboard   Dashboard with the students table (server-rendered, skeleton while loading); a link to add a student, and each row links to the student page and to edit, and has a delete button with a confirmation
  (root)/dashboard/students/new          Add-student page
  (root)/dashboard/students/[id]         Student page: the details, and the student's assignments list (name, submitted date, grade). A click opens a modal with the assignment details, the description, the checked file (PDF or image) with an upload field, and the grade (0-100, empty until checked), saved together with a save button. Hardcoded sample data for now; nothing is saved yet. A missing student, another teacher's or a malformed id all show the same not-found page
  (root)/dashboard/students/[id]/edit    Edit-student page, filled from the database; shares one form (StudentForm) with the add page
  (root)/dashboard/layout.tsx            The header, the tab bar (students | assignments) and the page frame, shared by every dashboard page
  (root)/dashboard/assignments           The teacher's assignments list (name, due date, number of students, how many submitted), with an add button
  (root)/dashboard/assignments/new       Add-assignment form: title, students (a checklist grouped by class, with a shortcut per class), due date and the rich text description (the form is built, saving is not yet)
  (root)/dashboard/assignments/[id]      Assignment page: its details, and its students with their status; a student's button opens the same modal, with the checked file, the grade and an upload field
  (root)/dashboard/assignments/[id]/edit Edit-assignment form, the same form as the add page. Everything under assignments is hardcoded sample data until the API exists
  api/auth/...       Auth endpoints
  api/students       Students endpoints (list, create, and /[id]: details, update, delete)
  api/classes        Classes endpoint
components/          UI components, grouped by feature (auth, dashboard, students, assignments, ui)
helpers/             Small pure helpers (button styles, date format)
hooks/               Client-side state and logic (useSignIn, useSignOut, useStudentForm, useDeleteStudent, useFilePreview, useModal, useDisclosure)
services/            Server services (auth.service.ts) and client API services
schemas/             zod schemas
types/               Shared TypeScript types
constants/           Shared constants (demo teacher, auth paths, student action links, Hebrew error messages)
lib/                 Prisma client (db.ts), AppError, the route helpers (apiRoute.ts), the HTML cleaner (richText.ts) and the file helpers (file.ts: type from the bytes, clean name)
prisma/              Schema, migrations and seed
proxy.ts             Route protection
tests/               Playwright e2e tests
scripts/             Helper scripts (test database setup)
```
