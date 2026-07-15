# Phase 18I-4E — Seeded/Orphaned challengeMembers Cleanup Script

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Context:** Follow-up to Phase 18I-4D; seeded/orphaned `challengeMembers` docs remain a row-source contamination risk even after leaderboard name-scope was fixed.

---

## 1. Problem

Phase 18I-4D confirmed that leaderboard rows come from `challengeMembers where challengeId == X` — the correct collection. However, if that collection contains:

- **Seeded docs** written by `seedAppData.ts` / `seedBaselineData.ts` (tagged with `seedTag: 'tiizi_seed_v1'` or prefixed `seed_`)
- **Orphaned docs** whose referenced challenge, user, or groupMembers document no longer exists

…those rows will still appear in the leaderboard, showing `Member XXXXXX` fallback names and inflating participant counts.

The existing `cleanupSeedData.ts` did **not** include `challengeMembers` in its collection list.

---

## 2. Fix

### New script: `scripts/cleanupSeededChallengeMembers.ts`

Performs two passes over all `challengeMembers` docs:

**Pass 1 — Seed detection** (no extra Firestore reads, purely field/ID inspection):
| Signal | Check |
|--------|-------|
| `seedTag === 'tiizi_seed_v1'` | doc has `seedTag` field matching the seed tag |
| doc ID | starts with or contains `seed_` / `seed-` |
| `challengeId` field | starts with or contains seed pattern |
| `userId` field | starts with or contains seed pattern |
| `groupId` field | starts with or contains seed pattern |

**Pass 2 — Orphan detection** (parallel Firestore reads for non-seed docs):
| Check | Condition |
|-------|-----------|
| `challenges/{challengeId}` | doc must exist |
| `users/{userId}` | doc must exist |
| `groupMembers/{groupId}_{userId}` | doc must exist (if groupId is set) |

**Output format** per candidate:
```
  docId:       <id>
  userId:      <userId>
  challengeId: <challengeId>
  groupId:     <groupId>
  reason:      <human-readable reason>
```

**Execution model:**
- Default: dry-run — prints all candidates, deletes nothing
- `--execute` flag: prints candidates then batches-deletes in chunks of 400

---

## 3. NPM Scripts Added

| Script | Command | Effect |
|--------|---------|--------|
| `npm run audit:seeded-challenge-members` | `tsx scripts/cleanupSeededChallengeMembers.ts` | Dry-run only |
| `npm run cleanup:seeded-challenge-members` | `tsx scripts/cleanupSeededChallengeMembers.ts` | Dry-run only |
| `npm run cleanup:seeded-challenge-members -- --execute` | `tsx scripts/cleanupSeededChallengeMembers.ts --execute` | **Deletes** |

---

## 4. Dry-Run Output

The audit script requires `GOOGLE_APPLICATION_CREDENTIALS` (firebase-admin service account). It could not be run against the live database in this session because the credential is not set in the local environment.

**To run the audit:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export FIREBASE_PROJECT_ID=tiizi-app   # or set in .env
npm run audit:seeded-challenge-members
```

Expected output structure:
```
────────────────────────────────────────────────────────────
cleanupSeededChallengeMembers — mode: DRY-RUN
project: tiizi-app  |  seedTag: tiizi_seed_v1
────────────────────────────────────────────────────────────

Fetched N challengeMembers docs.
Checking M non-seed docs for orphans…

────────────────────────────────────────────────────────────
CANDIDATES FOR DELETION (K total)
────────────────────────────────────────────────────────────

[SEEDED — X]
  docId:       seed_member_abc123
  userId:      seed_user_001
  challengeId: seed_challenge_001
  groupId:     seed_group_001
  reason:      userId is seed-like: seed_user_001

[ORPHANED — Y]
  docId:       <real-id>
  userId:      <real-uid>
  challengeId: <deleted-challenge-id>
  groupId:     <real-group-id>
  reason:      orphan — challenge doc does not exist: challenges/<deleted-challenge-id>

{
  "mode": "dry-run",
  "projectId": "tiizi-app",
  "seedTag": "tiizi_seed_v1",
  "totalChallengeMembers": N,
  "candidateDeleteCount": K,
  "breakdown": { "seeded": X, "orphaned": Y }
}

⚠️  DRY-RUN COMPLETE — nothing was deleted.
   Review the candidate list above, then re-run with --execute to delete.
```

---

## 5. Safety Invariants

1. **No deletion by default** — dry-run is the only mode unless `--execute` is passed
2. **Batched deletes** — 400 docs per batch (Firestore limit)
3. **Env validation** — fails immediately without `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`
4. **No production writes without explicit review** — two-step: run audit, review output, then run with `--execute`

---

## 6. Files Changed

| File | Change |
|------|--------|
| `scripts/cleanupSeededChallengeMembers.ts` | New script |
| `package.json` | Added `audit:seeded-challenge-members` and `cleanup:seeded-challenge-members` scripts |
| `scripts/testScoringGuards.ts` | Added guards 18I-4E-1 through 18I-4E-10 |

---

## 7. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4E-1 | Deletion is gated behind `--execute` flag |
| 18I-4E-2 | Script prints `DRY-RUN COMPLETE` and returns early without `--execute` |
| 18I-4E-3 | `challengeMembers` collection is targeted |
| 18I-4E-4 | `seedTag === 'tiizi_seed_v1'` is detected |
| 18I-4E-5 | `seed_` ID prefix pattern is detected |
| 18I-4E-6 | `challengeId`, `userId`, `groupId` are all checked for seed patterns |
| 18I-4E-7 | Challenge doc existence is checked (orphan detection) |
| 18I-4E-8 | User doc existence is checked (orphan detection) |
| 18I-4E-9 | `groupMembers` doc existence is checked (orphan detection) |
| 18I-4E-10 | Both npm scripts are registered in `package.json` |

---

## 8. Next Steps (Operator Action Required)

1. Set `GOOGLE_APPLICATION_CREDENTIALS` to the Firebase Admin service account JSON path
2. Run `npm run audit:seeded-challenge-members` — review the candidate list
3. If the output looks correct, run `npm run cleanup:seeded-challenge-members -- --execute`
4. Verify with `npm run audit:seeded-challenge-members` again — count should be 0

**Do not run `--execute` without first reviewing the dry-run output.**

---

## 9. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 5.03s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4E-1…10)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
npm run audit:seeded-challenge-members    → ⚠️  Requires GOOGLE_APPLICATION_CREDENTIALS
                                              (env guard confirmed working — exits with clear error)
```
