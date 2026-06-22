# Phase 10C-P5C-FINAL — Browse Challenges Permission Denial Root Cause Audit

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — root cause identified, no production code changed

---

## Executive Summary

The Browse Challenges permission-denied error is caused by a **Firestore security rules `get()`/`exists()` call budget violation**, not a logic error in the rule conditions. The `canReadChallenge` rule evaluates `isGroupMember(data.groupId)` — which makes `exists()` + `get()` calls to the `groupMembers` collection — **before** the field-based visibility check in every list query. Firebase enforces a hard limit of **10 total `exists()`/`get()` calls per list query request** across all documents in the result set. Any query returning more than ~3–5 documents exceeds this limit and returns `permission-denied`.

The P5C rules change (replacing `isApprovedPublicGroup` with field checks) was correct in direction but **fixed the wrong branch**: it removed the `get()` call in the third OR branch while leaving `isGroupMember` — which also makes `get()` calls — in the second OR branch, evaluated first.

---

## 1. Query Trace — BrowseChallengesScreen

`BrowseChallengesScreen` calls `useVisibleChallengesPage(25, ['active'])` → `challengeService.getVisibleChallengesForUserPage(uid, { pageSize: 25, statuses: ['active'] })`.

This function executes **three query groups** in sequence:

### Query A — Public by `visibility`
```
collection("challenges")
  .where("status", "==", "active")
  .where("visibility", "==", "public")
  .orderBy("startDate", "desc")
  .limit(25)
```
**Index required**: `status ASC, visibility ASC, startDate DESC` ✓ (exists in `firestore.indexes.json` line 270–276)

### Query B — Public by `groupVisibility`
```
collection("challenges")
  .where("status", "==", "active")
  .where("groupVisibility", "==", "public")
  .orderBy("startDate", "desc")
  .limit(25)
```
**Index required**: `status ASC, groupVisibility ASC, startDate DESC` ✓ (exists in `firestore.indexes.json` line 278–285)

### Query C — Member-group challenges (only if user is in groups)
```
collection("challenges")
  .where("groupId", "in", [<userGroupIds>])
  .where("status", "==", "active")
  .orderBy("startDate", "desc")
  .limit(25)
```
**Index required**: `groupId ASC, status ASC, startDate DESC` — standard composite, should exist.

The first call `getActiveMembershipGroupIds(userId)` queries `groupMembers where userId == uid`. This collection uses `allow read: if isAuthenticated()` — no `get()` calls, no issue.

---

## 2. Firestore Rule Path — `canReadChallenge`

**Match path**: `match /challenges/{challengeId} { allow read: if canReadChallenge(resource.data); }`

`allow read` covers both `get` (single-document) and `list` (query) operations under the same rule.

**Current rule (post-P5C)**:
```
function canReadChallenge(data) {
  return isAuthenticated()                               // [A] no get() calls
    && data.groupId is string                            // [B] field check, no calls
    && (
      canModerateChallenges()                            // [C] no get() calls
      || isGroupMember(data.groupId)                    // [D] ← 1 exists() + 1–2 get() calls
      || (
        data.status == 'active'
        && (data.visibility == 'public'
            || data.groupVisibility == 'public')         // [E] field checks, no calls
      )
    );
}
```

**`isGroupMember` definition**:
```
function isGroupMember(groupId) {
  return isAuthenticated()
    && exists(/databases/(default)/documents/groupMembers/$(groupId + '_' + request.auth.uid))
    // ↑ 1 exists() call
    && (
      get(/databases/(default)/documents/groupMembers/$(groupId + '_' + request.auth.uid)).data.status == 'active'
      // ↑ 1 get() call
      || get(/databases/(default)/documents/groupMembers/$(groupId + '_' + request.auth.uid)).data.status == 'joined'
      // ↑ potentially 1 more get() call (if first get() returns a non-matching status)
    );
}
```

Per document, `isGroupMember` makes **1–3 `exists()`/`get()` calls** (1 `exists` always, 1–2 `get` depending on status value).

---

## 3. The Actual Failure Mechanism

**Firebase hard limit**: For list queries, the total number of `exists()` and `get()` calls across **all documents in the entire result set** is capped at **10**. This is not a per-document limit.

**Evaluation order in OR**: Firebase security rules use standard left-to-right short-circuit evaluation. For a regular authenticated non-moderator user:

1. `[C] canModerateChallenges()` → `false` (no calls)
2. `[D] isGroupMember(data.groupId)` → **evaluated**: 1–3 calls per document
3. `[E] field check` → only reached if `[D]` is false; 0 calls

**The critical fact**: Firebase's rules engine does **not** statically pre-evaluate which OR branch is guaranteed by the query's WHERE constraints. It evaluates branches left-to-right at runtime per document. Because `[D]` comes before `[E]`, `isGroupMember` is always evaluated — even for documents where `[E]` would trivially be true.

**Call budget exhaustion**:

| Query | Documents returned | Calls per doc (min) | Total calls (min) | Result |
|-------|-------------------|--------------------|--------------------|--------|
| Query A (public, 5 docs) | 5 | 1 | 5 | ✓ under limit |
| Query A (public, 11 docs) | 11 | 1 | 11 | ✗ EXCEEDS 10 → permission-denied |
| Query C (member-group, 4 docs) | 4 | 1 | 4 | ✓ under limit |
| Query C (member-group, 11 docs) | 11 | 1 | 11 | ✗ EXCEEDS 10 → permission-denied |

Since the limit applies per `getDocs()` call, **a single query returning > 10 documents causes the entire request to fail**.

The first query to return > 10 documents fails. Since `Promise.all` is used to run Queries A and B in parallel, if either exceeds the limit, the promise rejects, `isError` becomes `true`, and "Access restricted" is shown.

---

## 4. Why `isApprovedPublicGroup` Appeared to Be the Root Cause

The P5 audit correctly identified that `isApprovedPublicGroup` caused Browse failures, but for a slightly different reason than stated. The call budget problem existed with the old rule too — `isApprovedPublicGroup` made 1 `exists()` + 1 `get()` calls per document in addition to `isGroupMember`'s calls, making the budget exhausted even faster (2–5 calls per document, burst to 10 with only ~2–5 documents). With `isApprovedPublicGroup` removed, the per-document cost dropped, but `isGroupMember` alone still exhausts the 10-call budget once the query returns > ~5–10 documents.

---

## 5. Field Presence on Production Documents

### `visibility` and `groupVisibility` on challenge documents

These fields were added to `createChallengeWithCreatorMembershipCore` and are guaranteed for all challenges created via the callable (current code path). However, **challenges created before this field was added do not have these fields**.

| Field | Required by rule? | Required by query? | Guaranteed at creation (current code)? | Present on legacy records? |
|-------|------------------|-------------------|----------------------------------------|---------------------------|
| `visibility` | YES — by branch [E] | YES — Queries A/B filter on it | YES | **UNKNOWN** — likely absent on pre-callable challenges |
| `groupVisibility` | YES — by branch [E] | YES — Query B filters on it | YES | **UNKNOWN** — likely absent on pre-callable challenges |
| `groupId` | YES — by [B] outer AND | NO | YES | **UNKNOWN** — may be absent on very old records |
| `status` | YES — by [E] | YES | YES | **UNKNOWN** — may default to absent |

**Key consequence for legacy documents**:
- Documents without `visibility` are **excluded** from Query A results (Firestore doesn't return documents where the filtered field is absent or mismatched)
- Documents without `groupVisibility` are **excluded** from Query B results  
- Documents without `visibility` AND without `groupVisibility` are **invisible to Browse entirely** — they cannot be discovered at all, even after the rule fix
- These documents ARE returned by Query C (member-group query) if the user is in the same group — their field-check [E] fails, forcing `isGroupMember` evaluation, consuming the call budget

**Existing backfill script**: `scripts/backfillDiscoveryFields.ts` already handles this case. It reads groups, normalizes visibility, and backfills `visibility` + `groupVisibility` onto all challenge documents missing them. This script predates the current audit.

---

## 6. Root Cause Classification

| Category | Verdict | Description |
|----------|---------|-------------|
| A. Rule logic | **PARTIAL** | Rule branch ordering causes `isGroupMember` (with `get()` calls) to be evaluated before the field-check branch for all non-moderator users |
| B. Missing fields on existing documents | **YES** | Legacy challenges without `visibility`/`groupVisibility` are invisible to Browse and, when returned by Query C, force `isGroupMember` evaluation consuming call budget |
| C. Query/rule mismatch | **NO** | Query constraints correctly match the field-check branch [E]; the mismatch is that the ordering causes [D] to be evaluated first |
| D. Missing index | **NO** | Both composite indexes exist in `firestore.indexes.json` |
| E. Another rule dependency | **NO** | No other rule path is involved |

**Primary root cause**: OR branch ordering in `canReadChallenge`. `isGroupMember` (branch [D]) is evaluated before the field-check (branch [E]) for every document in every list query. The 10-call budget is exhausted once any query returns > ~5–10 documents.

**Secondary root cause**: Legacy challenge documents missing `visibility`/`groupVisibility` fields are invisible to public Browse queries and, when retrieved via member-group Query C, cause the call budget to be exhausted sooner.

---

## 7. Recommended Fix

### Fix 1 — Reorder OR branches in `canReadChallenge` (rules change, no deploy needed beyond rules)

Move the field-check branch [E] to position 2 (before `isGroupMember`):

```
// BEFORE (current):
canModerateChallenges()
|| isGroupMember(data.groupId)                           ← get() calls evaluated first
|| (data.status == 'active' && (data.visibility == 'public' || data.groupVisibility == 'public'))

// AFTER (fix):
canModerateChallenges()
|| (data.status == 'active' && (data.visibility == 'public' || data.groupVisibility == 'public'))  ← evaluated first
|| isGroupMember(data.groupId)                           ← only reached for non-public challenges
```

**Effect**:
- For Queries A and B (public challenges): `[E]` evaluates to `true` first (0 get/exists calls). `isGroupMember` is never reached. Query succeeds for any number of documents.
- For Query C (member-group, private challenges): `[E]` is false (no visibility constraint). `isGroupMember` is then evaluated. Stays within the 10-call budget as long as each user's groups have ≤ ~10 active private challenges total.

**Security**: No regression. The rule still requires authentication + groupId type check + (moderator OR public-field OR member). The security properties are unchanged; only the short-circuit path changes.

### Fix 2 — Run `backfillDiscoveryFields.ts` (production data write — requires authorization)

Run the existing backfill script to add `visibility` and `groupVisibility` to all legacy challenge documents. This ensures:
- Legacy public challenges become discoverable via Browse queries
- Legacy challenges in member groups have correct field values so branch [E] resolves correctly

**Script**: `scripts/backfillDiscoveryFields.ts` (already exists — no new script needed)

**Dry-run command**:
```
FIREBASE_PROJECT_ID=tiizi-challenges npx tsx scripts/backfillDiscoveryFields.ts
```

**Apply command** (requires explicit authorization before running):
```
FIREBASE_PROJECT_ID=tiizi-challenges CONFIRM_PROJECT_ID=tiizi-challenges npx tsx scripts/backfillDiscoveryFields.ts --apply
```

**Dry-run output format** (example):
```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "durationMs": 1240,
  "readCounts": { "groups": 12, "challenges": 47 },
  "writeCounts": { "groups": 0, "challenges": 0 },
  "pendingUpdates": {
    "groups": [ ... ],
    "challenges": [
      { "id": "abc123", "fields": { "visibility": "public", "groupVisibility": "public" } },
      ...
    ]
  }
}
```

---

## 8. Diagnostic Script

`scripts/diagnoseBrowseChallengesPermission.ts` — created in this audit (read-only, Admin SDK).

**What it reports**:
- Total challenge documents and how many are missing `visibility`/`groupVisibility`/`groupId`
- Count of active public vs. private challenges
- Exact queries executed by Browse screen (for Firebase Rules Playground replay)
- Rule evaluation path and call budget estimate per query
- Per-group challenge counts (to predict Query C call budget)
- Backfill status

**Run command**:
```
FIREBASE_PROJECT_ID=tiizi-challenges npx tsx scripts/diagnoseBrowseChallengesPermission.ts
```

---

## 9. Summary

| Question | Answer |
|----------|--------|
| Root cause | `isGroupMember` evaluated before field-check in `canReadChallenge` OR; exhausts Firebase's 10-call-per-list-query `get()`/`exists()` limit once query returns > ~5–10 documents |
| Affected documents | All challenges; symptom manifests when any Browse query returns > ~5–10 results |
| Recommended fix | Reorder `canReadChallenge` OR branches: field-check first, `isGroupMember` last |
| Backfill required? | YES — legacy challenges missing `visibility`/`groupVisibility` are also invisible to Browse; `backfillDiscoveryFields.ts` handles this (requires explicit authorization to run with `--apply`) |
| Code change required? | NO — the Browse query logic and error handling are correct |
| Rules change required? | YES — reorder OR branches in `canReadChallenge`; rules deploy required |

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/diagnoseBrowseChallengesPermission.ts` | Read-only Admin SDK diagnostic — field presence, call budget estimate, exact query trace |
| `docs/reports/member-phase-10c-p5c-final-browse-permission-audit.md` | This report |
