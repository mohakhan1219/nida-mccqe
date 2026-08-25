# Dr. Nida Medical OS

Private study operating system for **Dr. Nida** — MCCQE1 preparation on the path from MBBS to a Canadian physician.

Nida opens the app on her iPhone, iPad, or laptop, logs a session in about a minute, and the Journey dashboard calculates progress, weak areas, and exam readiness from real evidence. Cursor is only for development.

## What this is

- **Today** — Punch In / Punch Out (or manual times) and optional question/test logging
- **Journey** — executive readiness, weekly targets, recommended focus, subject board
- **Review** — incorrect-review queue with 1 / 7 / 21 day intervals
- **History** — edit or delete any record; calculations update immediately
- **Settings** — catalogs, targets, readiness weights, courses, Abzi/Felipe schedule, exam date, backup
- **Ops** (`/ops`) — Mudasir’s read-only observability dashboard (hidden from Nida’s tab bar; preview banner link)

Production launches with **no fake study history**. Empty states are intentional.

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The app serves at [http://127.0.0.1:43180](http://127.0.0.1:43180).

With the placeholder env values, the app runs in **preview mode** (no login) so the UI can be developed. Preview data stays in the browser until you add real Supabase keys.

```bash
npm test
npm run build
```

## Production (Nida’s devices)

Nida must not depend on this computer or Cursor. Deploy to **Vercel** and store data in **Supabase**.

### 1. Supabase

1. Create a project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Authentication → Providers → Email **on**.
4. Disable public sign-ups (invite-only).
5. Authentication → Users → add Nida’s email and a password (role: primary is assigned automatically for the first user).
6. For a later household/admin login, create a second Auth user, then insert a `profiles` row with `role = 'admin'` and the same `workspace_id`.

Copy the project URL and anon key into Vercel env vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 2. Vercel

1. Import this git repository.
2. Set the two env vars.
3. Deploy. Optional: attach a custom domain.

### 3. iPhone / iPad Home Screen

1. Open the live URL in **Safari**.
2. Share → **Add to Home Screen**.
3. Sign in once. Punch In and saves go to Postgres, so iPad and laptop see the same record.

Password reset is on the sign-in screen.

## Readiness

Readiness is **not** “score ≥ 80”. It separates:

- **Readiness score** — volume-adjusted accuracy, recent performance, trend, coverage, weak-subject floor, mocks, review hygiene, consistency, course progress (only where targets exist)
- **Evidence confidence** — insufficient / low / moderate / high

States: Building Baseline → Not Ready Yet → Progressing → Getting Close → Ready to Book.

Ready to Book also requires enough mocks, a mock bar, non-declining mock trend, coverage, and a controlled review backlog. With no exam date, the dashboard shows readiness — not a fake countdown. After an exam date is entered in Settings, a countdown appears alongside readiness.

All numeric targets live in Settings.

## Backup

Settings → Export backup / Restore backup (JSON of sessions, assessments, reviews, settings, courses, catalogs, and schedule).

## Cost

Vercel Hobby and Supabase Free are typically **$0** for this private household app. Supabase Free may pause after 7 days of zero activity; daily use keeps it awake. Supabase Pro is optional (~$25/month).

## Stack

Next.js, Vercel, Supabase Auth, Supabase Postgres, PWA. Notion is not connected. The Excel workbook was a design reference only.
