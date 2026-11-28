# TIIZI-V2-ACTIVITY-001 — Unified Personal Recent Activity Contract

- **Status:** **COMPLETE / FOUNDER ACCEPTED / CLOSED** (`TIIZI-V2-ACTIVITY-005`, 2026-11-28). Phase 1 contract (`CONTRACT-CORR-001`, D1–D5 Founder-approved 2026-11-27, PR #196) and implementation slices `ACTIVITY-002` (PR #197), `ACTIVITY-003` (PR #198), and `ACTIVITY-004` (PR #199, head `07899184ee8a1a0fcceb667697a4ddc51e2cf81c`, merge `150435afd8b17bd12ca3b8c96a4e620529c19d0f`, post-merge CI `46120627797`) are Founder-accepted in browser walkthrough on 2026-11-28. See [`TIIZI-V2-ACTIVITY-005-FOUNDER-ACCEPTANCE-AND-CLOSURE-001.md`](../programme/TIIZI-V2-ACTIVITY-005-FOUNDER-ACCEPTANCE-AND-CLOSURE-001.md). Preserved limitations from §2 remain binding.
- **Repository:** `Fkenogo/tiizi_challenges`
- **Baseline:** `8d489bcd3517ccb5d37bae731d403dd27598607b` (`origin/main`)
- **Branch:** `docs/tiizi-v2-activity-001`
- **Authority & Scope:** Documentation-only assessment and contract proposal. No feature implementation, no database migrations, no production changes, no Founder Preview changes, and no automatic merge.

---

## 1. START-01 Receipt

| Field | Value |
| --- | --- |
| Task authority & observation time | `TIIZI-V2-ACTIVITY-001` (`CONTRACT-CORR-001`), observed `2026-11-27T15:11:00+02:00` |
| Refreshed `origin/main` SHA | `8d489bcd3517ccb5d37bae731d403dd27598607b` |
| Working branch / HEAD / merge-base | `docs/tiizi-v2-activity-001` at `334bfaf6ccfea88aab471d421656b37a53732248` (merge-base `8d489bcd3517ccb5d37bae731d403dd27598607b`, isolated worktree `.worktrees/v2-activity-001`) |
| Dirty files / other worktrees | Root workspace `/Volumes/PRODUCTION/Projects/tiizi_revamp` has unrelated dirty/untracked work at `5a01239` and is preserved untouched |
| Applicable contracts & authorities | `AGENTS.md` (V1 exclusion boundary, `/api/*` namespace, PostgreSQL-only V2 authority, FEF-TLC-001, PRG-01/ECCL-005); `api/migrations/001`, `003`, `004`, `005`, `012`, `019`, `025`, `029`, `032`; `api/src/postgresGroupAuthority.ts`; `api/src/memberRecentActivity.ts`; `api/src/today.ts`; `api/src/memberProfileSummaries.ts`; `src/v2/member/V2RecentActivityScreen.tsx`; `src/v2/today/V2TodayScreen.tsx`; `src/v2/challenges/V2LatestChallengeContribution.tsx`; `src/v2/profile/V2ProfileChallengeHistoryScreen.tsx` |
| **START FROM** | `docs/tiizi-v2-activity-001` (`334bfaf6ccfea88aab471d421656b37a53732248`) over `origin/main` (`8d489bcd3517ccb5d37bae731d403dd27598607b`) |
| **DO NOT START FROM** | Archived Product V1 (`/app/*`, `src/features/**`, legacy Firestore collections) or stale local `main` (`5a01239`) |
| Task-relevant active routes | `/v2/today`, `/v2/activity`, `/v2/challenges/:challengeId`, `/v2/groups/:groupId`, `/v2/profile/challenges`, `GET /api/me/activity`, `GET /api/today` |
| Preview artifact SHA / environment | `UNKNOWN` (documentation-only proposal; Founder Preview untouched) |
| Overall START-01 status | **PASS** (authorized for documentation-only contract finalization) |

---

## 2. Founder Dispositions — APPROVED (2026-11-27)

Founder expressly approved D1–D5 on 2026-11-27 in the Tiizi project conversation after reviewing PR #196. This authorizes the Phase 1 product direction and contract merge, not production changes or migrations. Technical Lead and independent Reviewer approved the preceding exact head `3731082bc014c585bbda93a12b5328e1b82e44a2` **with documented limitations**: Group history is partial; concurrent source changes have no cross-request snapshot/duplicate-skip guarantee; inaccessible private entities receive only safe generic labels or are omitted. Those limitations remain binding.

| ID | Proposed Decision | Status |
| --- | --- | --- |
| **D1** | Use a read-only union over existing authoritative PostgreSQL records for Phase 1. | **APPROVED — Founder 2026-11-27** |
| **D2** | Integrate finalized Challenge outcomes (`challenge_finalized`) into the unified timeline and retire the separate Today `Recent results` section (`#today-results`) once the replacement is verified. | **APPROVED — Founder 2026-11-27** |
| **D3** | Display up to three (`3`) latest meaningful events on Today (`/v2/today`). | **APPROVED — Founder 2026-11-27** |
| **D4** | Never infer the creator of a historical Group where `groups.original_creator_member_id` is `NULL`. | **APPROVED — Founder 2026-11-27** |
| **D5** | Defer append-only Group membership event recording (e.g., `group_membership_events`) to a separately authorized future slice. | **APPROVED — Founder 2026-11-27** |

---

## 3. Source-of-Truth Evidence Matrix

All V2 domain authority resides in PostgreSQL (`AGENTS.md` §2). Archived Product V1 Firestore collections are excluded (`AGENTS.md` §1).

| Event | Source Table & Identifier | Authoritative Member Identity | Authoritative Event Timestamp | Event Type | Visibility & Authorization | Historical Reconstruction | Correction / Deletion / Withdrawal / Rejoining Implications |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Group creation** | `groups` (`group_id` UUID PK) | `groups.original_creator_member_id` (nullable UUID FK -> `members.member_id`) | `groups.created_at` (`TIMESTAMPTZ`) | `group_created` | Owner-only (`original_creator_member_id = auth.memberId`). | **Partial.** `029_group_original_creator.sql` added `original_creator_member_id` without backfill. Pre-029 Groups have `NULL` and **cannot** be inferred from `steward_member_id` or earliest membership. | Immutable once set (`groups_original_creator_guard` trigger). Groups are never deleted in V2. |
| **Group membership joined** | `group_memberships` (`UNIQUE (group_id, member_id)`) | `group_memberships.member_id` | `group_memberships.joined_at` (`TIMESTAMPTZ`), **only** when membership transition is accepted (see §4) | `group_joined` | Owner-only (`member_id = auth.memberId`). | **Partial / Mutable.** `ON CONFLICT (group_id, member_id) DO UPDATE` overwrites prior `joined_at` on rejoin. `pending`/`rejected` rows carry a default `joined_at` without ever joining. | Pending/rejected rows never emit `group_joined`. Founding owner row (`role = 'owner'`, `joined_at = groups.created_at`) is suppressed when `group_created` is emitted. |
| **Group membership left** | `group_memberships` (`UNIQUE (group_id, member_id)`) | `group_memberships.member_id` | `COALESCE(group_memberships.left_at, group_memberships.updated_at)` when `status = 'left'` | `group_left` | Owner-only (`member_id = auth.memberId`). | **Partial / Mutable.** Preserved only while `status = 'left'`. Rejoining resets `left_at = NULL` (`postgresGroupAuthority.ts:222`). | Leaving sets `status = 'left', left_at = now()`. Rejoining erases `left_at` from the current row. |
| **Challenge creation** | `challenges` (`challenge_id` UUID PK) | `challenges.created_by_member_id` (NOT NULL) | `challenges.created_at` (`TIMESTAMPTZ`, immutable) | `challenge_created` | Owner-only (`created_by_member_id = auth.memberId`). | **Complete.** `created_by_member_id` and `created_at` are immutable (`challenges_guard_mutation` trigger). | `DELETE` is blocked. Lifecycle transitions do not alter creation provenance. |
| **Challenge participation joined** | `challenge_participations` (`participation_id` UUID PK) | `challenge_participations.member_id` | `challenge_participations.joined_at` (`TIMESTAMPTZ`, immutable) | `challenge_joined` | Owner-only (`member_id = auth.memberId`). | **Complete.** Append-only episode rows (`004_phase_c2a_challenges.sql`). Rejoining inserts a new `participation_id`. | `DELETE` is blocked. Each join/rejoin creates a distinct historical episode. |
| **Challenge participation exited** | `challenge_participations` (`participation_id` UUID PK) | `challenge_participations.member_id` | `challenge_participations.exited_at` (`TIMESTAMPTZ`, non-null when `status IN ('withdrawn', 'removed')`) | `challenge_exited` (`exitReason`: `'withdrawn' \| 'removed'`) | Owner-only (`member_id = auth.memberId`). | **Complete.** Only `active -> withdrawn/removed` is allowed; `exited_at` and `exit_reason` are immutable. | Withdrawal is blocked once Challenge is ended/finalized (`challengeParticipations.ts:230`). Exited episodes remain historical after rejoining. |
| **Accepted Activity & corrections** | `challenge_activity_records` (`event_id`) + `member_activity_events` (`event_id` UUID PK) | `member_activity_events.member_id` | Authoritative ledger time: `effective.recorded_at` (with `application.accepted_at`); `display.occurred_at` preserved as `performedAt` | `activity_logged` | Owner-only (`member_id = auth.memberId`). Must join to `challenge_activity_records`. | **Complete.** Append-only; corrections/reversals insert new rows with `supersedes_event_id` (`003_phase_c1_events.sql`). | Preserves `memberRecentActivity.ts` lineage: `updated` shows effective value + `effective.recorded_at`; `reversed` shows originally accepted value + `effective.recorded_at` with `revisionState: 'reversed'`. |
| **Challenge finalization & participation finals** | `challenge_participation_finals` (`participation_id`) + `challenge_finalizations` | `challenge_participation_finals.member_id` | `challenge_participation_finals.finalized_at` (`TIMESTAMPTZ`) | `challenge_finalized` | Owner-only (`member_id = auth.memberId`). | **Complete.** Both final tables are immutable (`challenge_finalizations_immutable` trigger in `012_ebc04_ending_finalization_rebuild.sql`). | Immutable once written. Multiple episodes for the same Challenge each retain their own `participation_id` final row. |

---

## 4. Group Membership Truth & Event-Eligibility Rules

`group_memberships` enforces `UNIQUE (group_id, member_id)` (`001_phase_a_foundation.sql:38`) and `joined_at TIMESTAMPTZ NOT NULL DEFAULT now()`. In `api/src/postgresGroupAuthority.ts`:
- `joinGovernedGroup` inserts `joined_at = now()` even when `status = 'pending'` (line 220–221).
- `ON CONFLICT (group_id, member_id) DO UPDATE` overwrites `joined_at` when `EXCLUDED.status = 'active'`, preserves the prior `joined_at` when `EXCLUDED.status = 'pending'`, and clears `left_at = NULL`, `rejected_at = NULL` (line 222).
- `leaveGovernedGroup` only allows `active`/`joined` members (non-Steward) to transition to `status = 'left', left_at = now()` (line 232–234).
- `reviewPendingMembership` transitions `pending -> active` (`joined_at = now(), approved_at = now(), approved_by_member_id = actor`) or `pending -> rejected` (`rejected_at = now(), rejected_by_member_id = actor`) (line 268–280).

**Core Rule:** An existing `joined_at` column value is **not** proof of membership. Only an accepted membership state/transition qualifies:

| Scenario | Current `groups` / `group_memberships` State | Emitted Timeline Event(s) | Authoritative Timestamp | Rule & Rationale |
| --- | --- | --- | --- | --- |
| **1. Group creation** | `groups.original_creator_member_id = M` AND `group_memberships` (`role='owner', status='active', joined_at = groups.created_at`) | `group_created` only (suppress `group_joined`) | `groups.created_at` | Same-transaction establishment; prevents duplicate "Created Group" + "Joined Group" cards for the creator. |
| **2. Direct join (open Group)** | `group_memberships.status IN ('active', 'joined')` (and not suppressed founding owner) | `group_joined` | `group_memberships.joined_at` | `joinGovernedGroup` sets `status='active'`, `joined_at=now`, `approved_at=now`. |
| **3. Pending approval** | `group_memberships.status = 'pending'` | **None** | N/A | Request is unapproved; `joined_at` is a non-null column artifact, not a join. |
| **4. Approved membership** | `group_memberships.status = 'active'` with `approved_at IS NOT NULL` | `group_joined` | `group_memberships.joined_at` (set to `now()` on approval alongside `approved_at`) | Accepted transition from `pending -> active`. |
| **5. Rejected request** | `group_memberships.status = 'rejected'` | **None** | N/A | Request was denied; `joined_at` is a stale `INSERT` artifact. |
| **6. Left membership** | `group_memberships.status = 'left'` | `group_joined` **and** `group_left` | Join: `group_memberships.joined_at`; Leave: `COALESCE(left_at, updated_at)` | Only `active`/`joined` members can transition to `left`, so `joined_at` reflects their last active join and `left_at` reflects their exit. |
| **7. Rejoin** | Member previously `left`, then calls `joinGovernedGroup`:<br>• If open (`active`): `joined_at = new_now`, `left_at = NULL`<br>• If approval-required (`pending`): `status = 'pending'`, `left_at = NULL`, `joined_at` retains old value | • If `active`: `group_joined` at `new_now` (prior join/leave lost)<br>• If `pending`: **None** until approved | `group_memberships.joined_at` (when `active`) | **Never reconstruct lost historical episodes.** While `pending`, the stale `joined_at` must not emit `group_joined`. |
| **8. Original creator (`original_creator_member_id` set)** | `groups.original_creator_member_id = M` | `group_created` | `groups.created_at` | Authoritative provenance (`029_group_original_creator.sql`). |
| **9. Historical rows with insufficient provenance** | `groups.original_creator_member_id IS NULL` | **None** for `group_created` | N/A | **D4:** Never infer creator from `steward_member_id` or earliest membership row. |

---

## 5. Unified Chronology Decision & Compatibility Implications

### 5.1 Chronology Rule
- **Unified Timeline Ordering:** Order all unified timeline events (newest first) by **authoritative recorded / accepted event time**:
  ```sql
  ORDER BY recorded_at DESC, source_event_id DESC, event_type_rank DESC
  ```
  where `recorded_at` is:
  - `groups.created_at` for `group_created`
  - `group_memberships.joined_at` for `group_joined`
  - `COALESCE(group_memberships.left_at, group_memberships.updated_at)` for `group_left`
  - `challenges.created_at` for `challenge_created`
  - `challenge_participations.joined_at` for `challenge_joined`
  - `challenge_participations.exited_at` for `challenge_exited`
  - `effective.recorded_at` for `activity_logged`
  - `challenge_participation_finals.finalized_at` for `challenge_finalized`
- **Activity `performedAt` & Correction Semantics:**
  - `activity_logged` **preserves `performedAt` (`display.occurred_at`) as a separate field** alongside `recordedAt` (`effective.recorded_at`) and `acceptedAt` (`application.accepted_at`).
  - Corrections (`revisionState: 'updated'`) and reversals (`revisionState: 'reversed'`) retain their existing `memberRecentActivity.ts` value-resolution semantics while ordering by `effective.recorded_at` so a correction or reversal performed today surfaces at the top of the member's recent developments.
- **No Implicit Change to Activity-Only Chronology:**
  - Existing `api/src/memberRecentActivity.ts` (`GET /api/me/activity`) orders by `display.occurred_at DESC, effective.recorded_at DESC, accepted.event_id DESC` (newest *performed* first).
  - **Compatibility Implication:** Changing `GET /api/me/activity` in-place to `recorded_at DESC` would silently break existing Activity-only consumers such as `useV2LatestChallengeActivity(challengeId)` in [V2LatestChallengeContribution.tsx](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-activity-001/src/v2/challenges/V2LatestChallengeContribution.tsx), which expects the newest *performed* contribution for a Challenge. Therefore, Activity-only chronology on `GET /api/me/activity` MUST remain untouched.

---

## 6. API Compatibility Evaluation & Recommendation

| Criterion | Option A: Opt-in/Versioned Mode on `GET /api/me/activity` | Option B: Dedicated `GET /api/me/timeline` Endpoint |
| --- | --- | --- |
| **Existing Activity-only consumers** | Requires conditional query branching (`mode=unified` vs default); higher risk of accidental regression on `V2LatestChallengeContribution.tsx` or existing tests. | **Zero impact.** `GET /api/me/activity` remains 100% unchanged for Activity-only consumers (`occurred_at DESC`). |
| **Chronology separation** | Same endpoint has two different sort orders depending on a query flag. | **Clean separation:** `/api/me/activity` = `occurred_at DESC`; `/api/me/timeline` = `recorded_at DESC`. |
| **Response & cursor typing** | Overloads `MemberRecentActivityPage` / cursor versions on one route. | Dedicated `PersonalTimelinePage` and `version: 1` timeline cursor bound to `(memberBinding, recordedAt, sourceId, eventTypeRank, typesFilter, challengeId)`. |
| **Compatibility risk** | Medium. | **Lowest.** |

**Recommendation:** **Adopt Option B — Dedicated `GET /api/me/timeline`** (registered via `API_PREFIX` in `api/src/apiPrefix.ts`).

### Endpoint Contract (`GET /api/me/timeline`)
- **Auth:** `authenticatedMember(request)` derives `memberId` exclusively from verified auth. Unauthenticated requests return `401`.
- **Query Parameters:**
  - `limit?: number` (integer `1..50`, default `20`)
  - `cursor?: string` (opaque base64url JSON, max `2048` chars)
  - `types?: string` (optional comma-separated allowlist of `PersonalTimelineEventType`)
  - `challengeId?: string` (optional UUID filter; restricts to Challenge-scoped events)
- **Cursor Contract:**
  ```ts
  interface PersonalTimelineCursor {
    version: 1;
    memberBinding: string; // sha256(memberId) base64url
    recordedAt: string;    // ISO-8601 UTC microsecond precision
    sourceId: string;      // UUID
    eventTypeRank: number; // deterministic integer rank per eventType
    typesFilter: string | null; // canonical sorted comma-joined allowlist or null
    challengeId: string | null;
  }
  ```
  Any malformed, non-canonical base64url, cross-account (`memberBinding` mismatch), or filter-mismatched (`typesFilter` / `challengeId`) cursor returns HTTP `400` (`invalid_cursor`).
- **Response Item Shape (`PersonalTimelineItem`):**
  - `timelineEventId: string` (`"${eventType}:${sourceId}"`)
  - `eventType`: `'group_created' | 'group_joined' | 'group_left' | 'challenge_created' | 'challenge_joined' | 'challenge_exited' | 'activity_logged' | 'challenge_finalized'`
  - `category`: `'group' | 'challenge' | 'activity' | 'result'`
  - `recordedAt: string` (authoritative sort timestamp, ISO-8601 UTC)
  - `performedAt: string | null` (non-null only for `activity_logged`, preserving `display.occurred_at`)
  - `displayTimezone: string | null` (Challenge `timezone` for Challenge/Result/Activity fallback; `occurred_tz` for Activity; `null` for Group events -> viewer local)
  - `navigation: { kind: 'group' | 'challenge' | 'none'; path: string | null; accessible: boolean }`
  - Typed payload per category: `group?`, `challenge?`, `activity?`, `exit?`, `result?`.
- **No Public Feed Exposure:** Never reads or writes `group_feed_outbox`, `group_feed_projection`, or `challenge_feed_shares`.

---

## 7. Historical Consistency & Pagination Safeguards

1. **Read-Committed Pagination:** Keyset pagination uses `(recorded_at, source_id, event_type_rank)` and has no cross-request snapshot. For an unchanged set of source rows and unchanged filters, the deterministic total ordering and strict keyset predicate allow forward traversal without duplicates or omissions. This guarantee does not extend across source mutations between requests.
2. **Concurrent Source Changes:** A Group/Challenge join or finalization committed between requests may appear before the current cursor and therefore not appear on later pages; clients may see it after refreshing from page one. Group membership rejoin can move the current `group_joined` key and remove `group_left`; an Activity correction/reversal can move the collapsed item to a new `effective.recorded_at`; a finalization adds a new immutable result row. These changes may cause items to be absent from a traversal or appear differently across requests. No snapshot consistency or duplicate/skip guarantee is made while source records or membership eligibility change. Lost Group episodes are **never** fabricated.
3. **Activity Corrections:** The read model collapses a correction chain onto the accepted `event_id`; a correction or reversal changes the effective ordering timestamp and displayed revision state/value according to `memberRecentActivity.ts`. This does not create a second timeline item for that accepted activity, but the moved item can cross an already-issued cursor boundary.
4. **Member Exits and Rejoins:**
   - **Challenges:** Distinct immutable `participation_id` episodes preserve join/exit/final rows when present in the underlying records. Concurrent changes still receive no cross-request snapshot guarantee.
   - **Groups:** Only the current `group_memberships` row is projected; its in-place updates do not preserve all historical episodes.
5. **Historic Entity Becomes Inaccessible:**
   - If access to a private Group or Challenge has ended, the personal timeline may show only a generic event label and event category/date (for example, “Joined a Group” or “Challenge result recorded”), plus the member’s own non-sensitive event type where applicable. It must not expose the private Group/Challenge name, title, description, activity or result details, participant information, or other current private state. Set `navigation: { kind: 'none', path: null, accessible: false }`; do not resolve or emit a deep link. If the safe generic event cannot be determined without leaking private details, omit the entity-derived event.

---

## 8. Founder Experience (No UI Changes in This Proposal)

- **Today (`/v2/today`):** `V2RecentActivityPreview` displays the latest **3** meaningful events (`limit=3`) from `GET /api/me/timeline`, with `View all activity` -> `/v2/activity`. Once verified, the standalone `Recent results` section (`#today-results`) is retired in favor of `challenge_finalized` events in the unified timeline (**D2**).
- **View all activity (`/v2/activity`):** `V2RecentActivityScreen` renders the complete paginated private timeline, preserving `Performed` / `Recorded` dual-timestamp disclosure, `Updated` / `Reversed` badges, and explicit `Share ... activity` for eligible `activity_logged` items.
- **Challenge Detail (`/v2/challenges/:challengeId`):** Retains specialized Activity (`V2LatestChallengeContribution.tsx` via `GET /api/me/activity?limit=1&challengeId=...`) and Challenge Feed (`V2ChallengeFeedView.tsx`) displays unchanged.
- **Profile (`/v2/profile` -> `/v2/profile/challenges`):** Existing `V2ProfileChallengeHistoryScreen` remains accessible.

---

## 9. Updated Acceptance Test Inventory

1. **Group creation & founding owner deduplication:** Creating a Group emits `group_created` at `groups.created_at` and suppresses duplicate `group_joined` for the founding `owner` row.
2. **Direct join (open Group):** Joining an open Group emits `group_joined` at `group_memberships.joined_at`.
3. **Pending approval:** Requesting to join a private/approval-required Group (`status = 'pending'`) emits **no** `group_joined` despite `joined_at` being populated.
4. **Approved membership:** Steward approval (`pending -> active`) emits `group_joined` at `joined_at` (`approved_at`).
5. **Rejected request:** Steward rejection (`pending -> rejected`) emits **no** `group_joined` or `group_left`.
6. **Left membership:** Leaving an active Group (`status = 'left'`) emits `group_joined` (at `joined_at`) and `group_left` (at `COALESCE(left_at, updated_at)`).
7. **Group rejoin:** Rejoining an open Group emits `group_joined` at the new `joined_at` without fabricating the lost prior join/leave episode; rejoining an approval-required Group (`status = 'pending'`) emits **no** `group_joined` until approved.
8. **Pre-029 Group NULL creator:** A Group with `original_creator_member_id IS NULL` emits **no** `group_created` (never inferred from `steward_member_id`).
9. **Challenge creation & participation episodes:** Creating a Challenge emits `challenge_created`; joining, withdrawing/removing, and rejoining emit distinct `challenge_joined`, `challenge_exited`, and second `challenge_joined` events.
10. **Activity logging, correction, & reversal:** `activity_logged` orders by `effective.recorded_at`, preserves `performedAt` (`display.occurred_at`), collapses correction chains to one row per `accepted.event_id`, and preserves `updated` / `reversed` semantics.
11. **Challenge finalization:** Finalizing emits `challenge_finalized` at `finalized_at` with frozen outcome fields per `participation_id`.
12. **Inaccessible historic entity:** After access to a private Group or Challenge ends, any retained event uses only a generic label and category/date; it exposes no private entity title, description, result/activity details, participants, or current state and has `navigation.accessible = false` with no path. Omit the event if even a generic label would leak private information.
13. **Cursor ordering, pagination, & validation:** With an unchanged source set and filters, mixed events sort deterministically by `(recorded_at DESC, source_id DESC, event_type_rank DESC)` and keyset traversal has no duplicates or omissions. Concurrent membership changes, Activity corrections/reversals, or finalizations have no snapshot guarantee and can make an item move, be absent from a traversal, or appear on refresh. Malformed, cross-account, or filter-mismatched cursors return `400 invalid_cursor`.
14. **Privacy & Feed isolation:** `401` when unauthenticated; strict cross-account isolation; zero reads/writes to `group_feed_outbox`, `group_feed_projection`, or `challenge_feed_shares`.
15. **Compatibility & Today consistency:** `GET /api/me/activity` retains `occurred_at DESC` Activity-only behavior for `V2LatestChallengeContribution`; Today's 3-item preview matches the top 3 items of `GET /api/me/timeline`.
