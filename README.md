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

The seed also creates demo classes and students in Hebrew for `דנה כהן`, and demo assignments for her with every status (not submitted, submitted, checked with a grade). She starts with 4 classes, 10 students and 4 assignments, and the seed then **adds** 35 more students (in 2 new classes and 3 of the existing ones) and 41 more assignments, so she has **45 students and 45 assignments**: each list has 3 pages of 20, so the pagination can be seen. The added part is made by code in [`prisma/seed-data.ts`](./prisma/seed-data.ts) (`DEMO_EXTRA`), has nothing random, and is added on top of an existing database too: run `npm run db:seed` again and only what is missing is added, so there is no need to reset the database. The class `י'1` stays empty on purpose. Each submitted part has a small sample PDF, so the file can be opened and previewed, and a part never has a status that its file and grade do not allow. It adds a second teacher, `יוסי מזרחי` (ID number `111222333`) with one class, two students and one assignment, so you can check that a teacher only sees their own data. A third teacher, `נעמה שרון` (ID number `444555666`), and a fourth, `רונית אביב` (ID number `777888999`), exist for the automated tests that create data, so those tests never change the demo teachers' data. The seed data is in [`prisma/seed-data.ts`](./prisma/seed-data.ts).

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
| `npm run db:seed` | Creates the demo teachers, classes, students and assignments (safe to re-run: classes are skipped for a teacher who already has some, and assignments for a teacher who already has some, so a database from before the assignments get them too). The extra demo data of `דנה כהן` (see above) is added on top, and only what is missing |
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

The test database is seeded **without** the extra demo data of `דנה כהן` (`scripts/test-db-setup.ts` sets `SEED_EXTRA_DEMO_DATA=false`): many tests count her 10 students and 4 assignments, so they need that small, fixed set. The pagination tests make a teacher of their own with 45 students and 45 assignments (see below). The tests that create students use two dedicated teachers (`נעמה שרון` and `רונית אביב`), so the demo teachers' data is never changed. The search and sort tests, and every other test that only reads, use the demo teacher. The pagination tests create a teacher of their own with 45 students and 45 assignments (`createBulkTeacher` in `tests/helpers.ts`), and remove it afterwards (the global setup also removes one that a stopped run left). The lists show 20 rows per page and the write teachers have more than that by the end of a run, so a test that needs the row it made looks for it by searching, as a teacher would (`findInList`, `listAddress`). A test that signs in with a wrong ID number sends its own `x-forwarded-for` (`clientHeaders()` in `tests/helpers.ts`), so its failed tries count against its own address and never against the sign-ins of the other tests (see "Limit on failed sign-ins"). Before every run, `tests/global-setup.ts` deletes everything those two teachers gained in earlier runs and keeps their seeded students. It refuses to run unless the database name in `DATABASE_URL_TEST` contains "test". It then warms up the dev server (loads the pages once in a browser, creating no data), because the first requests would otherwise all wait for the pages to compile at the same time and time out.

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

### Limit on failed sign-ins

A client that signs in with a wrong name or ID number **5 times in 15 minutes** is refused (`429` with a Hebrew message and a `Retry-After` header, in seconds) until the 15 minutes from its first failure are over. This slows down guessing of ID numbers.

- The count is per **client address and name**, so one teacher who forgot their ID number does not lock out the others, and another name from the same address is not refused. A name that does not exist counts the same as a wrong ID number, so the limit tells nothing about which names are real.
- A refused client is answered **before** the database is read or a hash is checked, so guessing costs the server nothing. Even the right ID number is refused while the client waits, and trying again while refused does not make the wait longer.
- A successful sign-in clears the count. A request with an invalid body (`400`) is not counted.
- The address is the first value of `x-forwarded-for` (then `x-real-ip`). Behind a proxy that sets it (Vercel, nginx) this is the visitor; when running locally every visitor is one address ("unknown").
- Limits of this simple version, on purpose: the counts are kept **in the memory of the server process**, so they are forgotten when the server restarts, and they are not shared if the app runs on several servers or serverless instances. A real deployment would keep them in a shared store such as Redis. The memory is capped (expired entries go first, then the oldest), so it cannot grow without end. It is only as strong as the proxy that sets `x-forwarded-for`: a client that can send its own header can change address.
- The code is in [`lib/rateLimit.ts`](./lib/rateLimit.ts) (the limiter, with an injectable clock so the window is unit-tested), [`lib/loginAttempt.ts`](./lib/loginAttempt.ts) (the address and the key) and `signIn` in [`services/auth.service.ts`](./services/auth.service.ts). The numbers are in [`constants/auth.constant.ts`](./constants/auth.constant.ts).

### Auth API

| Method and path | Auth | Description |
|---|---|---|
| `POST /api/auth/login` | public | Body `{ name, idNumber }`. `200` with `{ teacher }` and the session cookie, `400` with field errors, `401` for wrong credentials, `429` after too many wrong tries (see "Limit on failed sign-ins") |
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
| `PUT /api/assignments/[id]` | session | Body `{ title, description?, dueDate, studentIds, confirmedRemovalIds? }`, the same rules as `POST` plus the optional list. Replaces the four fields and returns `200` with `{ assignment }`. A student who stays keeps their file, grade and status, a new student starts as `TODO`, and a removed student loses their part. `400` with field errors, `401`, `404` if the assignment is not found (same cases as `GET`) or a student does not exist or is not the teacher's, `409` if a removed student already submitted and is **not** in `confirmedRemovalIds` (see below). It is one transaction: any error means nothing was changed |
| `DELETE /api/assignments/[id]` | session | `200` with `{ id }`. Deletes the assignment together with every student's part and file (the database cascades the delete); the students are not touched. `401`, or `404` in the same cases as `GET` |
| `PUT /api/assignments/[id]/students/[studentId]/file` | session | The teacher uploads the checked assignment of one student. Body is `multipart/form-data` with one field, `file`. `200` with `{ student }` (the part, in the shape of the `students` items above). `400` with a field error for no file, an empty file, a file over 4 MB or a type that is not allowed, `401`, `404` if there is no such assignment, it belongs to another teacher, the student is not in it, or an id is not a uuid (all answer the same), `413` if the request is far over the limit (it is refused before it is read) |
| `GET /api/assignments/[id]/students/[studentId]/file` | session | The stored file itself (the `url` that the assignment gives), to show in a frame or an image. `200` with the bytes. `401`, or `404` if the student has no file, the student is not in the assignment, the assignment belongs to another teacher, or an id is not a uuid (all answer the same) |
| `PUT /api/assignments/[id]/students/[studentId]/grade` | session | Body `{ grade }`: a whole number from 0 to 100, or `null` to clear the grade. `200` with `{ student }` (the part, in the shape of the `students` items above). `400` with a field error for anything else (a text, a decimal, out of range, missing), `401`, `404` if there is no such assignment, it belongs to another teacher, the student is not in it, or an id is not a uuid (all answer the same), `409` if the student has no uploaded file |

Removing a student who already submitted: the part of a removed student who uploaded a file has a file and maybe a grade, which are deleted with it and cannot be brought back, so the server refuses it (`409`) unless the teacher confirmed that student. `confirmedRemovalIds` is the list of student ids whose removal was confirmed. Only a removed student named there loses their part; a removed student who submitted and is not named (also one who submitted after the teacher opened the page) still stops the whole update with `409`, so a confirmation never deletes a submission it did not mention. An id of a student who stays, who is not in the assignment or who did not submit is ignored. The edit form asks before it sends the ids (see "Removing students who already submitted"), and a create ignores the field.

Grade rules for `PUT …/grade`: a grade needs an uploaded file, so a student who is still `TODO` cannot be graded (the database also refuses it). Saving a grade makes the part `CHECKED`, and clearing it makes the part `SUBMITTED` again; the status is worked out on the server from the file and the grade and is never taken from the request. The file and the upload date are not touched. Clearing the grade of a part that has none is a no-op that succeeds. Both `0` and `100` are valid grades.

Serving rules for `GET …/file`: the type sent is the real type found when the file was uploaded, and only when it is one of the four types that can be uploaded; anything else is sent as a download (`attachment`) of unknown type, so a stored file can never run as a page or a script. `X-Content-Type-Options: nosniff` stops the browser from guessing another type, and `Cache-Control: private, no-store` keeps a student's work out of every cache. The real name (Hebrew too) is in `Content-Disposition` as a plain ASCII name and an encoded `filename*`.

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
| `429` | Too many wrong sign-ins. Has a `Retry-After` header |
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

### The student modal

The modal (on the assignment page and on the student page) is one form for one student's part: the checked file and the grade, with one save button. It uses the two endpoints above, and only sends what changed:

- A picked file goes first (`PUT …/file`), then the grade (`PUT …/grade`), so a student who did not submit can get a file and a grade in one save. A grade that was not touched is not sent, and a file that was not picked is not sent.
- Clearing the grade field sends `null`: the student goes back to `SUBMITTED`. A new file for a `CHECKED` student keeps the status and the grade.
- The grade field is closed until there is a file (the saved one or the one just picked), and the server refuses a grade without a file anyway.
- Everything the teacher sees as an error is the server's Hebrew message: under the grade or the file field, or as one message in the form.
- When everything was saved the modal closes and the page is refreshed (`router.refresh()`), so the row shows the new status, date and grade.
- If the file was saved and then the grade was refused, the modal stays open with the message, the page behind it is refreshed, and a new try sends the grade only (the same file is not uploaded twice).
- The modal keeps only the id of the selected row and reads its data from the page, so it shows what was just saved, never an old copy.

## Search and sorting

Both lists (the students on `/dashboard`, the assignments on `/dashboard/assignments`) can be searched and sorted. The state is **in the address**, so the server does the work, a reload or a copied link keeps it, and nothing is fetched from the client. The API endpoints are not changed.

| List | Search | Filter | Sort (`sort=`, a minus in front is descending) |
|---|---|---|---|
| Students | `q`: the name or the phone, a part of it | `class`: one class | `name` (default), `class`, `phone` |
| Assignments | `q`: the title, a part of it | none | `-dueDate` (default), `dueDate`, `title`, `students` (number of students), `submitted` (number who submitted) |

For example `/dashboard?q=050&class=<class id>&sort=-phone`.

- The search ignores case and spaces around it, and it is looked for as written: `%`, `_` and `\` are plain characters, not wildcards ([`lib/likePattern.ts`](./lib/likePattern.ts), because Prisma's `contains` does not escape them). A phone can be typed with or without the hyphen: `0501234567` finds `050-1234567`.
- The search box waits 300 ms after the last key (or Enter), so the list is not fetched on every key. A select changes the list at once. A "ניקוי" button appears when something is set and puts everything back.
- While a search or a class is on, a line says "נמצאו N מתוך M" (how many matched, on all the pages, out of all of the teacher's), and an empty result says nothing matched (different from "no students yet"). The number in the heading is always all of the teacher's.
- A value that is not valid is never an error: it becomes the default (an unknown sort, a class that is not a uuid, a repeated param, a search over 100 characters is cut, a NUL character is removed). A class of another teacher is ignored too, so nothing of another teacher can be reached this way. The parsing is in [`schemas/list.schema.ts`](./schemas/list.schema.ts).
- Everything is scoped to the signed-in teacher in the query itself. Equal values keep a fixed order (the name, then the id), so the order never changes between requests. Sorting by "submitted" is done in memory after the query (it is a filtered count that the database cannot order by); the default order stays the order of equal counts.
- The client part is one component, [`components/ui/ListFilters.tsx`](./components/ui/ListFilters.tsx), with its logic in [`hooks/useListFilters.ts`](./hooks/useListFilters.ts). A search that is still waiting for the pause is applied when the box loses the focus, so a click on a row right after typing is not taken over by the search.

### Pages

Both lists show **20 rows per page** (`PAGE_SIZE` in [`constants/list.constant.ts`](./constants/list.constant.ts)), with "הקודם", "עמוד X מתוך Y" and "הבא" under the table. Nothing is shown for a list that fits in one page.

- The page is in the address too (`?page=2`, with the search and the sort kept), and the controls are links, so a page can be reloaded, shared and used with the back button. Page 1 is not written in the address.
- A search, a filter or a sort starts again from page 1.
- A page that is not valid (`0`, a negative number, a decimal, letters, a repeated param, a number over 6 digits) is page 1, and a page past the end is the last page, so a page that emptied (its rows were deleted) is never shown empty.
- The database reads only the rows of the page (`skip` and `take`) and counts what matches with the same filter. The one exception is the sort by the number who submitted, which is made in memory (see above), so its page is cut from the sorted list there.
- The count and the rows are two queries, so while other requests add rows they can differ by those rows until the page is loaded again. The API endpoints (`GET /api/students`, `GET /api/assignments`) are not paged: they still return everything.
- The code is in [`lib/pagination.ts`](./lib/pagination.ts) (the page arithmetic), [`helpers/list.ts`](./helpers/list.ts) (the addresses) and [`components/ui/Pagination.tsx`](./components/ui/Pagination.tsx).

## Removing students who already submitted

When the teacher edits an assignment and unchecks a student who already uploaded their assignment, saving first opens a dialog "הסרת תלמידים שהגישו". It lists each of those students and what is lost (the file, and the grade if there is one), with a warning that it cannot be undone. Only the students who submitted and are removed are listed.

- "חזרה לעריכה" (or Escape) closes it and saves nothing; the form keeps what was typed and chosen.
- "הסרה ושמירה" saves with `confirmedRemovalIds` set to exactly the students that were listed. The other changes of the form are saved in the same request.
- A student who did not submit is removed without asking, and so is nobody being removed.
- The page knows who submitted when it was opened. The server is the protection, not the dialog: a student who submitted after the page was opened is not in the list, so the server refuses the save with `409` and its Hebrew message (nothing is changed), and the teacher can reload the page and see them.
- The code is in [`components/assignments/ConfirmRemovalModal.tsx`](./components/assignments/ConfirmRemovalModal.tsx), [`hooks/useAssignmentForm.ts`](./hooks/useAssignmentForm.ts) and `updateAssignment` in [`services/assignment.service.ts`](./services/assignment.service.ts).

## Error pages

- **Not found** ([`app/not-found.tsx`](./app/not-found.tsx)): any address that does not exist shows a Hebrew page with a link back to the dashboard. A student or an assignment that does not exist (or is another teacher's) has its own not-found page.
- **Error** ([`app/error.tsx`](./app/error.tsx), and [`app/global-error.tsx`](./app/global-error.tsx) for the root layout): an unexpected failure in a page shows a Hebrew page with a "try again" button. The technical message is never shown to the user.

## Scope decisions

- **Classes are not managed in the app.** The assignment asks for viewing, adding and editing students and their assignments, and a class is only a field of the student. It does not ask for managing classes, and it has no admin role. Classes are created by the seed, a teacher chooses one for a student, and `GET /api/classes` lists them. In a real version an admin role would manage the classes (and the teachers).
- **Removing a student from an assignment who already submitted** is allowed after a confirmation (see below). Without it the server answers `409`, so a file and a grade are never lost by accident.
- **Uploaded files are saved in the database** (up to 4 MB each) to keep the project to one service. A real version would use object storage.

## Architecture diagrams

All in [`docs/`](./docs), as images (click one for the zoomable SVG), with the Mermaid source under each in a collapsed part:

- [`docs/architecture.md`](./docs/architecture.md): **the app flow** (screens and navigation), the layers, the data model, the status of a student's part, and the **feature flows** (sign-in, lists, forms, files and grades, delete).
- [`docs/component-tree.md`](./docs/component-tree.md): **the component and file hierarchy of every page**: the page, the components it shows, their hooks, the client service, the API route it calls and the server services. Generated from the real imports.
- [`docs/file-usage.md`](./docs/file-usage.md): for every source file, what it uses and who uses it. Generated from the real imports.

After the code changes, regenerate the last two and redraw the images: `npx tsx scripts/generate-architecture.ts` and then `npx tsx scripts/render-diagrams.ts` (it uses the Chromium that Playwright installed for the tests, and installs Mermaid once into the temp folder, not into the project).
## Project structure

```
app/                 Pages (page.tsx) and route handlers (route.ts) only
  (root)/auth        Sign-in page
  (root)/dashboard   Dashboard with the students table (server-rendered, skeleton while loading), with search, a class filter and sorting (see "Search and sorting"); a link to add a student, and each row links to the student page and to edit, and has a delete button with a confirmation
  (root)/dashboard/students/new          Add-student page
  (root)/dashboard/students/[id]         Student page: the details, and the student's assignments list from the database (name, submitted date, grade; latest due date first). A click opens a modal with the assignment details, the description, the checked file (a PDF in a frame, or an image) with an upload field, and the grade (0-100, empty until checked), saved together with one save button (see "The student modal" below). A missing student, another teacher's or a malformed id all show the same not-found page
  (root)/dashboard/students/[id]/edit    Edit-student page, filled from the database; shares one form (StudentForm) with the add page
  (root)/dashboard/layout.tsx            The header, the tab bar (students | assignments) and the page frame, shared by every dashboard page
  (root)/dashboard/assignments           The teacher's assignments list from the database (name, due date, number of students, how many submitted), latest due date first by default, with search and sorting (see "Search and sorting") and an add button. Each row links to the assignment and to edit, and has a delete button with a confirmation; when students already submitted, the confirmation adds a stronger warning with their number, because their files and grades are deleted too
  (root)/dashboard/assignments/new       Add-assignment form: title, students (a checklist grouped by class, with a shortcut per class), due date and the rich text description. It saves through `POST /api/assignments`: the server's Hebrew messages show under each field (or as one message for other errors), the button is disabled while saving, and a save goes back to the list. After a save the form is empty again when the page is opened later, and a draft that was not saved is kept
  (root)/dashboard/assignments/[id]      Assignment page from the database: its details, and its students with their status; a student's button opens the same modal, with the checked file (a PDF in a frame, or an image), the grade and an upload field, which save the same way. A missing assignment, another teacher's or a malformed id all show the same not-found page
  (root)/dashboard/assignments/[id]/edit Edit-assignment form, the same form as the add page, filled from the database. It saves through `PUT /api/assignments/[id]` with the same messages and behaviour as the add page; removing a student who already submitted shows the server's message and changes nothing. The same not-found page for a missing, foreign or malformed id.
  api/auth/...       Auth endpoints
  api/students       Students endpoints (list, create, and /[id]: details, update, delete)
  api/classes        Classes endpoint
components/          UI components, grouped by feature (auth, dashboard, students, assignments, ui)
app/not-found.tsx, app/error.tsx, app/global-error.tsx   The app-level not-found and error pages (see "Error pages")
helpers/             Small pure helpers (button styles, date format)
hooks/               Client-side state and logic (useSignIn, useSignOut, useStudentForm, useAssignmentForm, useFormSaveState, useSubmissionForm, useDeleteStudent, useDeleteAssignment, useListFilters, useFilePreview, useModal, useDisclosure)
services/            Server services (auth.service.ts) and client API services
schemas/             zod schemas
types/               Shared TypeScript types
constants/           Shared constants (demo teacher, auth paths and limits, student action links, list params, Hebrew error messages)
lib/                 Prisma client (db.ts), AppError, the route helpers (apiRoute.ts), the HTML cleaner (richText.ts), the file helpers (file.ts: type from the bytes, clean name), the login limiter (rateLimit.ts, loginAttempt.ts) and the search helpers (likePattern.ts, phone.ts)
prisma/              Schema, migrations and seed
proxy.ts             Route protection
tests/               Playwright e2e tests
scripts/             Helper scripts (test database setup)
```
