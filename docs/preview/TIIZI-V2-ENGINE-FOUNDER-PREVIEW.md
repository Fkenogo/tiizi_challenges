# Tiizi V2 Engine — Founder Preview Guide (EBC-05)

Local-only preview of the real V2 engine (EBC-01 → EBC-04 authority paths).
Nothing here deploys anything: no migrations beyond your local PostgreSQL,
no Cloud Run, no Firebase project changes, no production database contact.

## 1. Prerequisites

- Node 20+, npm.
- Docker (for local PostgreSQL) **or** any localhost PostgreSQL 15+.
- Firebase CLI (`npm i -g firebase-tools`) + a JRE for the emulators
  (auth + firestore only).
- This branch checked out; dependencies installed (`npm ci` at root and in `api/`).

## 2. One-time local setup

```bash
# 1. PostgreSQL
docker compose up -d postgres

# 2. Migrations 001 → 012 (local database only)
DATABASE_URL=postgresql://tiizi:tiizi@localhost:5432/tiizi npm run migrate --prefix api

# 3. Preview seed: 2 test members + 5 published, KCS-ready preview activities
DATABASE_URL=postgresql://tiizi:tiizi@localhost:5432/tiizi npm run preview:seed --prefix api -- --apply

# 4. Firebase emulators (leave running in its own terminal)
firebase emulators:start --only auth,firestore
```

## 3. Test identities

Seeded members map to Auth emulator UIDs:

| Preview member     | Auth emulator UID    |
|--------------------|----------------------|
| Founder One        | `preview-founder-01` |
| Founder Two        | `preview-founder-02` |

Create them once in the emulator (Auth emulator UI at
http://127.0.0.1:4000, or `firebase auth:import`), then sign in with
email/password in the app. Founder Two is for the two-member Competitive proof.

## 4. Start the preview

```bash
# Terminal A — emulators (from step 4 above)
firebase emulators:start --only auth,firestore

# Terminal B — API + web app together (visible logs, Ctrl-C stops both)
VITE_TIIZI_V2_CHALLENGES_ENABLED=true \
VITE_TIIZI_API_BASE_URL=http://localhost:4000 \
DATABASE_URL=postgresql://tiizi:tiizi@localhost:5432/tiizi \
VITE_FIREBASE_USE_EMULATORS=true \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_PROJECT_ID=tiizi-preview \
npm run preview:engine
```

Or copy `.env.preview.example` to `.env` and run `npm run preview:engine`.

Expected URLs:

- App V2 home: http://localhost:5173/app/challenges/v2
- Establish: http://localhost:5173/app/challenges/v2/new
- Groups: http://localhost:5173/app/challenges/v2/groups
- API health: http://localhost:4000/health · readiness: http://localhost:4000/ready

## 5. Walkthrough — Collective

1. Sign in as Founder One. Open V2 Groups, create a group (governed
   `POST /v1/groups` — check the API log).
2. Open New V2 challenge → Collective. Pick the group, title, dates,
   timezone. Goal e.g. `100 reps`.
3. Add Knowledge activity → `Preview Push-Up` (published only; Metric is
   locked to `repetitions`, Unit to `reps` — invalid tuples are unselectable).
4. Establish & activate. You join as creator automatically.
5. Open the challenge → Join is already done → Log Push-Up with a value.
6. Team Progress moves (e.g. `10 / 100 reps · 10%`). Log past the goal:
   the total keeps counting past 100% (bar clamps, number does not).

## 6. Walkthrough — Competitive (two members)

1. As Founder One: establish a Competitive challenge
   (`Preview Squat` with a per-activity target, e.g. `50 reps`),
   same group, activate. Competitive has no team goal — members race
   to each activity's target.
2. Share the challenge: Founder Two opens the app, joins the same group
   (Groups → Join group → paste the group ID), opens the challenge, joins it.
3. Both log squats. The Leaderboard orders by truth and shows standard
   competition ranking (shared positions, e.g. 1, 1, 3).
4. One finisher never ends the challenge: the other can keep logging.
5. Finalize locally (see §8). Detail shows “Final standings” with frozen
   ranks; a non-completer shows no rank.

## 7. Walkthrough — Streak

1. Establish a Streak challenge (`Preview Stillness`, 1+ daily activities,
   required consecutive days e.g. `5`, governing timezone shown on detail).
2. Join, log today’s activity. Detail shows Current streak, Best, Days done.
3. Missed days stay missed: late logging cannot reopen a closed day
   (log for a past closed day is rejected or lands on its own day only).
4. After the window, finalize locally: detail shows the frozen
   `final streak` alongside history. No leaderboard is ever shown.

## 8. Local ending / finalization (dev only)

There is no scheduler in the preview. Ending/finalization runs through the
existing local lifecycle CLI against your local database:

```bash
# Mark expired challenges ended + finalized (uses wall clock unless --now)
DATABASE_URL=... npm run challenge:lifecycle --prefix api -- process-expired

# Finalize one challenge explicitly
DATABASE_URL=... npm run challenge:lifecycle --prefix api -- finalize <challengeId>

# Deterministic runs for review
DATABASE_URL=... npm run challenge:lifecycle --prefix api -- process-expired --now 2026-12-31T00:00:00Z
```

Normal participant UI never exposes finalization: detail screens only
display `active` → `ended` → `finalized` with frozen results.

## 9. What to inspect

- Group Membership ≠ Challenge Participation: a group member who never
  joined shows “not joined”; joining is explicit.
- Every log travels Submission Intent → Eligibility → Acceptance →
  Evidence → Application → Engine → Derived Truth (API logs; V2 log
  screen shows accepted/rejected, never silently falls back to V1).
- Challenge days follow the Challenge timezone shown on detail — not the device.
- Ended challenges hide Join/Log actions; finalized ones show frozen truth.

## 10. Reset local preview data

```bash
# Wipes V2 domain tables on localhost ONLY (never schema_migrations), then re-seed
DATABASE_URL=postgresql://tiizi:tiizi@localhost:5432/tiizi npm run preview:reset --prefix api -- --apply
DATABASE_URL=postgresql://tiizi:tiizi@localhost:5432/tiizi npm run preview:seed --prefix api -- --apply
```

Both commands refuse non-localhost `DATABASE_URL` values and dry-run
unless `--apply` is passed.

## 11. Known bounded limitations

- Emulator-backed identity only: no production Firebase users, no new auth provider.
- Group detail is membership-scoped (name/role/status); the full legacy
  V1 Group product is untouched and out of scope.
- No scheduler: ending/finalization is CLI-driven (see §8).
- No social feed, rewards, MOT-01, ACT-03/ACT-04, diary, notifications,
  or Run Again UX — engine preview only.
- Preview seed carries 5 canonical activities; the full Knowledge
  catalogue is authored through governed Knowledge administration, not here.
