# Task 3 — CRIT-4: durationDays Backfill

**Date:** 2026-06-23  
**Branch:** fix/p0-pre-deploy-blockers  
**Mode:** ✅ APPLIED — 30 writes committed

---

## 1. Audit Summary

| Metric | Count |
|--------|-------|
| Total challenges fetched | 30 |
| **Will be updated** | **30** |
| Already correct (skipped) | 0 |
| Invalid/missing dates (skipped) | 0 |

All 30 challenges are missing `durationDays` entirely (`currentDurationDays = (none)`). No challenge had the field set. No dates were invalid or missing — all 30 have parseable `startDate` and `endDate`.

---

## 2. Calculation Method

```
durationDays = Math.round((endMs - startMs) / oneDay) + 1
```

Inclusive: June 1 → June 7 = **7 days**, not 6. Same-day challenge = **1 day**.

`Math.round` handles sub-millisecond float drift from ISO timestamps that include time-of-day components (e.g. `2026-01-21T01:21:47.019Z`).

---

## 3. Challenges to Update

| id (prefix) | Name | Status | Type | startDate | endDate | Will set durationDays |
|-------------|------|--------|------|-----------|---------|----------------------|
| 1S7cXHuHkwAO | Pushup mania2 | active | collective | 2026-06-06 | 2026-07-05 | **30** |
| 49ekaMejGaOf | 7-Day Daily Hydration Challenge | active | streak | 2026-06-19 | 2026-06-25 | **7** |
| 9j0Op19Sr2A8 | 7 day squat + Pushup madness | active | streak | 2026-06-08 | 2026-06-14 | **7** |
| HemE5n36hd2x | 16-Hour Daily Fast (Beginner) | active | streak | 2026-02-28 | 2026-03-21 | **22** |
| K4eBvaSLKe4y | 30-Day Pushup Duel | active | competitive | 2026-06-06 | 2026-07-05 | **30** |
| RXnDF61eiP2h | Pushup mania | active | collective | 2026-02-28 | 2026-04-01 | **33** |
| RuEmriT3uAAz | 14-day squats marathon | active | streak | 2026-05-27 | 2026-06-10 | **15** |
| Uqx8beHESmfb | Squat + Pushup 50 | active | streak | 2026-06-09 | 2026-06-29 | **21** |
| bIMrgnrblJ0a | 14-day squats marathon 2nd edition | active | streak | 2026-06-17 | 2026-06-30 | **14** |
| oV4yNrAUNMI0 | 7-day squats marathon | active | streak | 2026-06-10 | 2026-06-16 | **7** |
| pyOO8M1SIBDB | 1 Daily Social Connection | active | streak | 2026-06-19 | 2026-06-25 | **7** |
| yv1EGn1flBo8 | 8-Hour Sleep Streak | active | streak | 2026-06-06 | 2026-06-26 | **21** |
| seed_challen… (×18) | Seed data challenges | active/completed/draft | various | various | various | 15–31 |

### Live (non-seed) active challenges — full list

| id | Name | durationDays to set |
|----|------|-------------------|
| 1S7cXHuHkwAO | Pushup mania2 | 30 |
| 49ekaMejGaOf | 7-Day Daily Hydration Challenge | 7 |
| 9j0Op19Sr2A8 | 7 day squat + Pushup madness | 7 |
| HemE5n36hd2x | 16-Hour Daily Fast (Beginner) | 22 |
| K4eBvaSLKe4y | 30-Day Pushup Duel | 30 |
| RXnDF61eiP2h | Pushup mania | 33 |
| RuEmriT3uAAz | 14-day squats marathon | 15 |
| Uqx8beHESmfb | Squat + Pushup 50 | 21 |
| bIMrgnrblJ0a | 14-day squats marathon 2nd edition | 14 |
| oV4yNrAUNMI0 | 7-day squats marathon | 7 |
| pyOO8M1SIBDB | 1 Daily Social Connection | 7 |
| yv1EGn1flBo8 | 8-Hour Sleep Streak | 21 |

---

## 4. Exact Field Written Per Document

Only one field is written per document:

```
{ durationDays: <number> }
```

Written via `batch.update()` — does **not** overwrite any other field. All other challenge fields (name, status, activities, groupId, etc.) are untouched.

---

## 5. Skipped Challenges

**Already correct:** 0  
**Invalid/missing dates:** 0  

No challenges were skipped. All 30 have valid, parseable ISO dates.

---

## 6. Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 17.54s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
| `npx tsx scripts/backfillDurationDays.ts` (dry-run) | ✅ 0 writes, 30 queued |

Script-level assertions (run on every invocation):

| Assertion | Result |
|-----------|--------|
| Same-day = 1 | ✅ |
| June 1–7 = 7 | ✅ |
| June 1–30 = 30 | ✅ |
| null startDate → null | ✅ |
| null endDate → null | ✅ |
| empty string → null | ✅ |
| invalid string → null | ✅ |
| end before start → null | ✅ |

---

## 7. Dry-Run Confirmation

**Zero writes were performed.** The script exited after printing the report with:

```
🔎 DRY-RUN complete — zero writes performed.
   To apply: CONFIRM_PROJECT_ID=tiizi-challenges npx tsx scripts/backfillDurationDays.ts --apply
```

The `--apply` flag was not passed. No Firestore batch was committed.

---

## 8. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Seed data challenges also updated | Low | 18 of 30 are `seed_challenge_*` docs. They have valid dates and incorrect (missing) durationDays. Writing to them is safe and correct — they're real Firestore documents participating in queries. |
| Timestamp-offset drift | Mitigated | Seed docs use full ISO timestamps with time components (e.g. `01:21:47.019Z`). Using `Math.round` instead of `Math.ceil` means a 30-day challenge stored as `T01:21:47` → `T01:21:47` still computes exactly 30 days (not 31). |
| Completed/draft challenges updated | Intentional | `durationDays` is a fact about the challenge definition, not its current lifecycle state. Completed and draft challenges can have correct durationDays; it won't affect any member-facing UI for those. |
| No Firestore index required | N/A | This is a collection scan + individual `batch.update` — no new indexes needed. |

---

## 9. Apply — Completed

```
✅ Applied 30 write(s).
```

Post-apply dry-run confirms: **Will update: 0 / Already correct: 30 / Skipped: 0**

All 30 challenges now have `durationDays` set correctly in Firestore. A subsequent `--apply` run would be a no-op.

### Post-Apply Validation

| Command | Result |
|---------|--------|
| Post-apply dry-run | ✅ 0 remaining updates, 30 already correct |
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 3.10s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
