# NextGen Coders Team Workspace

Internal training/attendance site for NextGen Coders (nonprofit teaching coding to Middle Georgia students; many volunteers are high schoolers). Contact: nextgencoderswr@gmail.com. Public site: https://www.nextgencoderswr.com. Package name: `instructor-courses`.

## Working rules (from the user)
- **Edit this folder in place.** Never create new project folders, copies or zips. The project root is the folder containing `package.json`: `C:\Users\caigr\Downloads\ngc-team-workspace\ngc-team-workspace` (the zip extracted with a doubled folder name; do not "fix" that by moving things).
- Never touch or delete `data/` (live accounts/courses/completions) or `.env.local` (AUTH_SECRET). Both are gitignored.
- The user is not deeply technical: give exact copy-paste commands, one at a time, and tell them when `npm install` is needed (only if a package is added).
- Keep `HOW-TO-RUN.txt` accurate when behavior or logins change.

## Run
`npm install` (first time), `npm run dev`, open http://localhost:3000. `scripts/setup-env.mjs` runs automatically before dev/build/start and creates `.env.local` (random AUTH_SECRET, `ADMIN_USERNAME=admin`, `ADMIN_INITIAL_PASSWORD=nextgencodersadmin`) on first run only.

## Stack
Next.js 16 (App Router, `proxy.ts` instead of middleware), React 19, TypeScript 5.9. No UI library, no DB server, no test runner. Styling in `app/globals.css`. Path alias `@/`.

## Architecture
- **Storage:** `lib/db.ts` has two modes behind async `readDB(...keys)` / `writeDB(db)`: with `DATABASE_URL` (or `POSTGRES_URL`) it uses Neon Postgres (table `kv`, one jsonb row per top-level key; REQUIRED on Vercel, whose disk is read-only); without it, the JSON file `data/db.json` (local dev). `readDB("accounts")` loads only those parts; `writeDB` saves only parts that changed since they were read. Always `await` both. A new DB seeds the admin + sample course; demo accounts (`volunteer`, `officer`, `seniorlead`, passwords `ngc-<role>`) are created only in file mode. `scripts/import-db.mjs` (`npm run import-data`) copies data/db.json into Neon once. `scripts/setup-env.mjs` skips itself on Vercel. Vercel limit: ~4.5 MB per request body. `lib/store.ts` is an older localStorage helper still used by the `course-types` page (not server-backed yet).
- **Auth:** `lib/auth.ts` HMAC-signed cookie `ngc_session` (8h). `proxy.ts` redirects unauthenticated `/dashboard/*` to `/`. `lib/session.ts`: `getUser()` re-checks the DB each request, `guard(adminOnly?)` for API routes (`if ("res" in g) return g.res`), `requireAdminPage()` for admin pages, `todayET()` for America/New_York dates.
- **Passwords are encrypted, not hashed** (`lib/crypto.ts`, AES-256-GCM keyed from AUTH_SECRET) because the owners wanted admins to be able to view them. Known weakness; planned to move to hashing + reset flow.
- **Roles & permissions:** built-in roles Admin, In Training, Volunteer, Officer, Senior Lead (`BUILT_IN_ROLES`) plus custom roles admins make on `/dashboard/roles` (stored in `db.customRoles`, API `/api/roles`, `/api/roles/[id]`; helpers in `lib/roles.ts`, client hook `lib/useRoles.ts`). A role is just its name; `PERMISSIONS` in `lib/types.ts` lists what can be paired to a role (`editGuides`, `viewAttendance`). Admin has all, Senior Lead has both, others none; custom roles get what the admin ticks. Check on the server with `guardPerm(perm)` / `requirePermPage(perm)` / `permsFor(user)` (`lib/session.ts`); `/api/me` returns `permissions` for the UI. Add a new permission by adding it to `PERMISSIONS` and guarding the route. A custom role can't be deleted while accounts use it; renaming follows through accounts, courses and guides. Admins are excluded from attendance and Redo.
- **Courses:** `Course` -> pages -> blocks (see Features). `lib/validate.ts` sanitizes all course input (`sanitizeCourse`) and `stripAnswers` removes quiz answers before sending to learners. Videos: YouTube only, converted to nocookie embeds (`lib/video.ts`). Pass mark is `PASS_PERCENT = 80`. Quiz grading is server-side in `app/api/courses/[id]/submit`. `lib/db.ts` `migrate()` upgrades older data.json shapes on read.
- **Redo:** admin "please redo this course" flag, no penalty (`/api/redos`).
- **Attendance:** `/api/attendance`. Admins edit anyone/any date; others only their own row for today. Sign-in/out store ISO times.
- **Quiz Builder skill:** `skills/ngc-quiz-builder/SKILL.md` (also zipped in `public/ngc-quiz-builder-skill.zip`) makes Claude output quiz JSON for the course editor's "Import from Claude" box. If you change the import format in `lib/validate.ts` (`parseQuizImport`), update the skill and re-zip it.
- Constants (contact email, sign-in link `https://tinyurl.com/nextgen-attendance`, app name) live in `lib/contact.ts`.

## Features (current)
- **Design:** solid colors only (no gradients), low motion, emoji tiles/buttons. Don't add typing effects, code windows, confetti or shimmer. Buttons are one family (`.btn`, `.btn-sm`, `.btn-block`); links that look like buttons use the same classes. Status colors come from `StatusPill` / `.pill`.
- **Programs:** only Python, JavaScript, CSP (code.org) and Scratch (scratch.mit.edu) (`PROGRAMS` in `lib/types.ts`). Never add Java/C++ examples.
- **Course visibility:** a course with no roles and no assignedTo is open to everyone (optional). Otherwise it is *required* for the listed roles (`roles`) and individually assigned people (`assignedTo`), and hidden from everyone else. Logic: `isVisibleTo` in `lib/status.ts`.
- **Completion:** a passing submission is "Awaiting confirmation" until an admin confirms it (`confirmedAt`). Status per person per course = `courseStatus()` (todo / notpassed / awaiting / completed / redo), based on the latest passing attempt.
- **Minimum time spent** (`minMinutes`, replaced the old time limit): server enforces it with a signed start token (`signPayload` in `lib/auth.ts`); the player disables Submit until it's met. Admin preview bypasses.
- **Blocks:** text (rich HTML, sanitized by `lib/sanitize.ts` on save and display), image, video, file (document to download), quiz (single or "select all that apply", up to 6 options, `correct` is `number[]`), upload (learner file, required), response (learner text, required). Files are base64 data URLs capped at 3 MB with an allow-list of types (no html/svg).
- **Builder** (`courses/[id]/edit`): pages outline (drag to reorder), click-to-edit blocks with inserter + drag handles, settings sidebar (status, program, min time, roles + individual assignment), Edit/Preview toggle, Ctrl+S. Preview is inline; "Open full player" goes to the player, whose admin bar has "Back to editor".
- **Submissions tab** (admin): see quiz answers vs key, written responses, uploaded files (`/api/submissions/[id]`, file download route), confirm/unconfirm.
- **Program Guides** (`/dashboard/program-guides`): everyone reads; roles with editGuides (Admin, Senior Lead, custom) write (rich text + attached documents). Author or admin can delete. Each guide has `roles` + `assignedTo` (empty both = Everyone); the editor has a "Who can see this guide" picker. Enforced server-side by `canSeeGuide` (`lib/types.ts`) in the guides list, single-guide and file routes; Admins and Senior Leads always see all guides. Admins also get "Import PDF or Word" in the guide editor (`/api/guides/import`, mammoth for .docx, unpdf for text PDFs; fills the draft, saves nothing).
- **Schedule** (`/dashboard/schedule`): admin builds the days in "Edit schedule": "Add day" (with "repeat every week until <date>" on one or more weekdays chosen from dropdowns, "Add another day" for several per week), per-row editing, and "Import from Claude" (last button; skill `ngc-schedule-builder` is downloaded from inside that window). Nobody marks attendance inside the app: the Student Attendance Link (tinyurl, for parents) handles that. There is a **Mark Absent** button at the top and on each upcoming day; it only opens `ABSENT_FORM_URL` (the Google Apps Script form link set in `lib/contact.ts`; there is no admin UI for it). Old in-app attendance records stay in db.json (`attendance`, unused).
- **Instructor Attendance** (`/dashboard/attendance`, roles with the viewAttendance permission; others are redirected to Schedule): lists every instructor account and their attendance status, matched by name/email to rows of a Google Sheet read by `/api/attendance-sheet`. The sheet link is intentionally blank: set `ATTENDANCE_SHEET_URL` in `lib/contact.ts` or `.env.local` (Google hosts only, `lib/links.ts`). Status column = header containing status/attendance/present; otherwise the last filled cell of the row.
- **Class Email** (`/dashboard/class-email`, admin only): instructors with an email on their account are added automatically (accounts without one are skipped), more addresses can be pasted, rich-text message (same `RichText` editor), one **Send Email** button (two-step confirm) that posts to `/api/send-email`, which sends each person their own copy through Resend's batch API. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are blank in `.env.example` on purpose; until set the API answers 503 "Email sending isn't set up yet".
- **Program Guides** header lists the tools: JavaScript (code.org), CSP (code.org), Scratch (scratch.mit.edu), Python (cs50.dev).
- **Look:** the login screen intentionally keeps its original styling (scoped under `.page` in globals.css), the nav uses the original filled pill, no sharp yellows anywhere (amber/warn tokens are very pale), and motion is small fade/lift animations that switch off for `prefers-reduced-motion`. The admin dashboard shows no stats. There is no Tip of the Day. The top-right has only Settings and Sign out (no name/role text). The top bar has only Dashboard, Instructor Courses, Schedule and Program Guides; every other page is reached from the dashboard "Go to" list. The dashboard has a "Coming up" date strip (no "What we teach" tiles). The logo text keeps the original system font.
- **Course publishing:** every course row in the admin list has Publish course / Unpublish (PATCH `/api/courses/[id]`), and the builder top bar has the same button. The Claude skill downloads live only inside the Import windows.
- **Claude skills:** `skills/ngc-lesson-builder`, `skills/ngc-quiz-builder` and `skills/ngc-schedule-builder` (folders + `.zip` each). Admin-only download via `/api/skills/[name]` (zips are NOT in public/). If you edit a SKILL.md, rebuild its zip (must be a real zip with `<name>/SKILL.md` inside; use Python `zipfile`, GNU `tar` makes a tar not a zip). Import formats are parsed by `parseLessonImport` / `parseQuizImport` in `lib/validate.ts`.

## Security (audited Nov 2026)
- **Headers/CSP:** `next.config.mjs` sets CSP (self + YouTube privacy-mode frames + `data:`/https images; inline script/style allowed because Next needs them), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS, noindex. If you add an embed, font, script or API host, add it to the CSP or it will be blocked.
- **Same-site check:** `proxy.ts` rejects non-GET `/api/*` requests whose Origin header is another website. Every route still does its own `guard*` check; never rely on the proxy alone.
- **Login throttle:** `app/api/login` keeps failed-attempt counters in the database (`db.throttle`): 10/10 min per IP, 10/15 min per username (a determined attacker can briefly lock a username; it clears itself).
- **Hosted seeding:** on a hosted DB the first visit refuses to create the admin if `ADMIN_INITIAL_PASSWORD` is the local default or under 10 characters.
- **Dependencies:** run `npm audit --omit=dev` now and then; Next was bumped to 16.4.6 for a critical advisory.
- **Modals:** use `useModal` (`lib/useModal.ts`) + `role="dialog" aria-modal`; it gives Escape, focus trap and focus return.
- **Known accepted risks:** passwords are reversible (admins can view them; see `lib/crypto.ts`); sessions are stateless 8 h cookies (a password change doesn't end an existing session); uploaded files are type-checked by declared type, not file contents; no under-18 consent or retention policy yet (needs the organization's decision).
- **Privacy:** `docs/PRIVACY-NOTICE-DRAFT.md` is an unpublished draft with `[CONFIRM]` placeholders. Don't publish it until the organization fills them in.

## Routes
Pages: `/` (login), `/dashboard` (greeting banner, progress, attendance card, tip; admin stats), `/dashboard/instructor-courses` (admins: Courses / Submissions / Progress & Redo tabs, `?tab=`; others: own courses), `/dashboard/courses/[id]` (player) and `/[id]/edit` (builder), `/dashboard/program-guides` and `/[id]`, `/dashboard/accounts` (admin), `/dashboard/schedule`, `/dashboard/attendance`, `/dashboard/settings`, `/dashboard/roles` (admin, server-backed), `/dashboard/course-types` (old localStorage page, not in the nav).
API: `accounts`, `accounts/[id]`, `assignments`, `attendance-sheet`, `schedule`, `send-email`, `completions` (summaries only), `courses`, `courses/[id]`, `courses/[id]/submit`, `guides`, `guides/[id]`, `guides/[id]/files/[fileId]`, `login`, `logout`, `me`, `people`, `redos`, `roles`, `roles/[id]`, `skills/[name]`, `submissions/[id]`, `submissions/[id]/files/[blockId]`.

## Known gaps / roadmap (user asked to start with 1, 2, 5)
1. Real database + hosting + backups (Supabase; Cloudflare can't write files; no backups today).
2. Force password change on first login (admins currently assign passwords).
3. Youth-protection tracking (background checks, mandatory-reporter training, code of conduct, parental consent under 18). Confirm requirements with MGA/board.
4. Admin safety: 2-step verification, one admin account per person, no shared login.
5. Service-hour tracking from sign-in/out times, printable hours letter/certificate, "Road to 500".
6. MGA verification queue (volunteer submits, admin verifies; officer eligibility computed from all basic courses).
7. Due dates + auto-assigned courses by role + email reminders.
8. Teaching-materials resource library.
9. Activity/audit log (important since admins can view passwords).
Later: class scheduling/swaps, CSV exports, feedback forms, privacy notice + retention rule.

## Cleanup before real launch
Delete the demo accounts (`volunteer`, `officer`, `seniorlead`), change the admin password from the default.

## Verify
No test runner exists; an ad-hoc API script was used once (login as each role, assign, submit, confirm, files, guides, attendance visibility). After changes run `npx tsc --noEmit` and `npm run build`; for UI changes check light mode, dark mode and phone width.
