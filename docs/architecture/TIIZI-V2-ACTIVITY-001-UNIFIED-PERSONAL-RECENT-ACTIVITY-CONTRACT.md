# TIIZI-V2-ACTIVITY-001 — Unified Personal Recent Activity Contract

- **Status:** Assessment and Contract Proposal Only (STOP for Founder review)
- **Repository:** `Fkenogo/tiizi_challenges`
- **Baseline:** `8d489bcd3517ccb5d37bae731d403dd27598607b` (`origin/main`)
- **Branch:** `docs/tiizi-v2-activity-001`
- **Authority & Scope:** Read-only architectural assessment and contract proposal. No feature implementation, no database migrations, no production changes, and no disturbance to Founder Preview.

---

## 1. START-01 Receipt

| Field | Value |
| --- | --- |
| Task authority & observation time | `TIIZI-V2-ACTIVITY-001`, observed `2026-11-27T14:32:00+02:00` |
| Refreshed `origin/main` SHA | `8d489bcd3517ccb5d37bae731d403dd27598607b` |
| Working branch / HEAD / merge-base | `docs/tiizi-v2-activity-001` at `8d489bcd3517ccb5d37bae731d403dd27598607b` (isolated worktree `.worktrees/v2-activity-001`; clean working tree) |
| Dirty files / other worktrees | Root workspace `/Volumes/PRODUCTION/Projects/tiizi_revamp` has unrelated dirty/untracked work at `5a01239` and is untouched; isolated worktree used |
| Applicable contracts & authorities | `AGENTS.md` (V1 exclusion boundary, `/api/*` namespace, PostgreSQL-only V2 authority, FEF-TLC-001, PRG-01/ECCL-005); `api/migrations/001`, `003`, `004`, `005`, `012`, `019`, `025`, `029`, `032`; `api/src/memberRecentActivity.ts`; `api/src/today.ts`; `api/src/memberProfileSummaries.ts`; `src/v2/member/V2RecentActivityScreen.tsx`; `src/v2/today/V2TodayScreen.tsx`; `src/v2/profile/V2ProfileChallengeHistoryScreen.tsx` |
| **START FROM** | `origin/main` (`8d489bcd3517ccb5d37bae731d403dd27598607b`) |
| **DO NOT START FROM** | Archived Product V1 (`/app/*`, `src/features/**`, legacy Firestore collections) or stale local `main` (`5a01239`) |
| Task-relevant active routes | `/v2/today`, `/v2/activity`, `/v2/challenges/:challengeId`, `/v2/groups/:groupId`, `/v2/profile/challenges`, `GET /api/me/activity`, `GET /api/today` |
| Preview artifact SHA / environment | `UNKNOWN` (documentation-only proposal; Founder Preview untouched) |
| Overall START-01 status | **PASS** (authorized for read-only assessment and documentation-only PR) |

---

## 2. Source-of-Truth Evidence Matrix

All V2 domain authority resides in PostgreSQL (`AGENTS.md` §2). Archived Product V1 Firestore collections are excluded (`AGENTS.md` §1).

| Event | Source Table & Identifier | Authoritative Member Identity | Authoritative Event Timestamp | Event Type | Visibility & Authorization | Historical Reconstruction | Correction / Deletion / Withdrawal / Rejoining Implications |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Group creation** | `groups` (`group_id` UUID PK) | `groups.original_creator_member_id` (nullable UUID FK -> `members.member_id`) | `groups.created_at` (`TIMESTAMPTZ`) | `group_created` | Owner-only (`original_creator_member_id = auth.memberId`). Visible even if Group later becomes private or member is no longer Steward. | **Partial.** `029_group_original_creator.sql` added `original_creator_member_id` without backfill. Pre-029 Groups have `NULL` and **cannot** be fabricated from `steward_member_id` or earliest membership. | `original_creator_member_id` is immutable once set (trigger `groups_original_creator_guard`). Groups are never deleted in V2. |
| **Group membership joined** | `group_memberships` (composite unique `(group_id, member_id)`) | `group_memberships.member_id` | `group_memberships.joined_at` (`TIMESTAMPTZ`), valid **only** when `status IN ('active', 'joined')` (or `status = 'left'` if previously active; see limitations) | `group_joined` | Owner-only (`member_id = auth.memberId`). | **Partial / Mutable.** Because `UNIQUE (group_id, member_id)` is enforced, `joinGovernedGroup` (`postgresGroupAuthority.ts`) uses `ON CONFLICT DO UPDATE`. Rejoining overwrites prior `joined_at` and clears `left_at`. Pending/rejected rows carry a default `joined_at` without ever having been approved. | If a member is `pending` or `rejected`, they never joined and must **not** emit `group_joined`. If a member leaves and rejoins, only the latest episode's `joined_at` survives in `group_memberships`. |
| **Group membership left** | `group_memberships` (composite unique `(group_id, member_id)`) | `group_memberships.member_id` | `COALESCE(group_memberships.left_at, group_memberships.updated_at)` when `status = 'left'` | `group_left` | Owner-only (`member_id = auth.memberId`). | **Partial / Mutable.** Only preserved while `status = 'left'`. If the member later rejoins, `left_at` is reset to `NULL` (`postgresGroupAuthority.ts:222`). | Leaving sets `status = 'left', left_at = now()`. Rejoining erases `left_at` from the current row. |
| **Challenge creation** | `challenges` (`challenge_id` UUID PK) | `challenges.created_by_member_id` (NOT NULL UUID FK -> `members.member_id`) | `challenges.created_at` (`TIMESTAMPTZ`, immutable) | `challenge_created` | Owner-only (`created_by_member_id = auth.memberId`). | **Complete.** `created_by_member_id` and `created_at` are immutable (`challenges_guard_mutation` trigger in `004_phase_c2a_challenges.sql`). | `DELETE` is blocked by trigger. Challenge lifecycle transitions (`establishment -> active -> ended`) do not alter creation provenance. |
| **Challenge participation joined** | `challenge_participations` (`participation_id` UUID PK) | `challenge_participations.member_id` | `challenge_participations.joined_at` (`TIMESTAMPTZ`, immutable) | `challenge_joined` | Owner-only (`member_id = auth.memberId`). | **Complete.** Modeled as append-only episodes (`004_phase_c2a_challenges.sql`). Each join/rejoin inserts a new row with a unique `participation_id`. | `DELETE` is blocked. Rejoining creates a new episode row without overwriting prior episodes. |
| **Challenge participation exited (withdrawn / removed)** | `challenge_participations` (`participation_id` UUID PK) | `challenge_participations.member_id` | `challenge_participations.exited_at` (`TIMESTAMPTZ`, non-null when `status IN ('withdrawn', 'removed')`) | `challenge_withdrawn` / `challenge_removed` (or `challenge_exited` with `exitReason`) | Owner-only (`member_id = auth.memberId`). | **Complete.** Only `active -> withdrawn/removed` is allowed; `exited_at` and `exit_reason` are immutable once set. | Withdrawal is blocked once Challenge is ended/finalized (`challengeParticipations.ts:230`). Exited episodes remain historical even if the member rejoins later. |
| **Accepted Activity events & corrections** | `challenge_activity_records` (`event_id` UUID) + `member_activity_events` (`event_id` UUID PK) | `member_activity_events.member_id` (and `challenge_participations.member_id`) | Display timestamp: `display.occurred_at`; ledger timestamp: `effective.recorded_at` (and `application.accepted_at`) | `activity_logged` | Owner-only (`member_id = auth.memberId`). Only events with a matching `challenge_activity_records` row qualify. | **Complete.** `member_activity_events` is append-only; corrections/reversals insert new rows with `supersedes_event_id` (`003_phase_c1_events.sql`). `challenge_activity_records` is immutable. | Preserves existing `memberRecentActivity.ts` recursive lineage: `updated` shows effective value + `effective.recorded_at`; `reversed` shows originally accepted value + `effective.recorded_at` with `revisionState: 'reversed'`. |
| **Challenge finalization & participation finals** | `challenge_participation_finals` (`participation_id` UUID PK) joined to `challenge_finalizations` (`challenge_id`) & `challenges` | `challenge_participation_finals.member_id` | `challenge_participation_finals.finalized_at` (`TIMESTAMPTZ`) | `challenge_finalized` | Owner-only (`member_id = auth.memberId`). | **Complete.** Both `challenge_finalizations` and `challenge_participation_finals` are immutable (`challenge_finalizations_immutable` trigger in `012_ebc04_ending_finalization_rebuild.sql`). | Immutable once written. Multiple episodes for the same Challenge (if exited and rejoined) each have their own `participation_id` final row. |

---

## 3. Proposed Unified Private Timeline Contract

### 3.1 Event Categories & Member-Facing Labels

Every item in the unified timeline belongs to one canonical `eventType` and `category`:

| `category` | `eventType` | Member-Facing Title / Label Pattern | Subtitle / Context |
| --- | --- | --- | --- |
| `group` | `group_created` | `Created Group · {group.name}` | Role: Owner / Steward |
| `group` | `group_joined` | `Joined Group · {group.name}` | Role context if relevant |
| `group` | `group_left` | `Left Group · {group.name}` | Historical membership exit |
| `challenge` | `challenge_created` | `Created Challenge · {challenge.title}` | Hosting Group name (`group.name`) + Challenge type |
| `challenge` | `challenge_joined` | `Joined Challenge · {challenge.title}` | Hosting Group name (`group.name`) |
| `challenge` | `challenge_exited` | `Left Challenge · {challenge.title}` (when `withdrawn`) / `Removed from Challenge · {challenge.title}` (when `removed`) | Episode exit |
| `activity` | `activity_logged` | `Activity logged · {activityName} · {value} {unit}` (or `Reversed Activity · ...` when `revisionState === 'reversed'`) | `Performed` & `Recorded` times, `revisionState` badge (`Updated` / `Reversed`), Challenge title |
| `result` | `challenge_finalized` | `Challenge finalized · {challenge.title}` | Frozen outcome summary (e.g., `Completed`, `Position #{finalPosition}`, or `Ended · Not completed`; Streak `daysCompleted` / `bestStreak` when applicable) |

### 3.2 Deterministic Chronological Ordering

All timeline events share a single, deterministic, total-order sort key (newest first):

```sql
ORDER BY event_timestamp DESC, tie_breaker_recorded_at DESC, source_event_id DESC
```

Where each event type maps to `(event_timestamp, tie_breaker_recorded_at, source_event_id)` as follows:

| `eventType` | `event_timestamp` | `tie_breaker_recorded_at` | `source_event_id` (UUID) |
| --- | --- | --- | --- |
| `group_created` | `groups.created_at` | `groups.created_at` | `groups.group_id` |
| `group_joined` | `group_memberships.joined_at` | `group_memberships.joined_at` | `group_memberships.group_id` |
| `group_left` | `COALESCE(group_memberships.left_at, group_memberships.updated_at)` | `group_memberships.updated_at` | `group_memberships.group_id` |
| `challenge_created` | `challenges.created_at` | `challenges.created_at` | `challenges.challenge_id` |
| `challenge_joined` | `challenge_participations.joined_at` | `challenge_participations.joined_at` | `challenge_participations.participation_id` |
| `challenge_exited` | `challenge_participations.exited_at` | `challenge_participations.updated_at` | `challenge_participations.participation_id` |
| `activity_logged` | `display.occurred_at` | `effective.recorded_at` | `accepted.event_id` |
| `challenge_finalized` | `challenge_participation_finals.finalized_at` | `challenge_participation_finals.finalized_at` | `challenge_participation_finals.participation_id` |

If two distinct event types share the exact same `(event_timestamp, tie_breaker_recorded_at, source_event_id)` (e.g. `group_created` and `group_joined` at Group creation if both were emitted, or `challenge_joined` and `challenge_finalized` using `participation_id` if timestamps ever collided), an explicit `event_type_rank` tie-breaker (`ORDER BY event_timestamp DESC, tie_breaker_recorded_at DESC, source_event_id DESC, event_type_rank DESC`) guarantees a strict total order with zero ambiguity.

### 3.3 Duplicate Prevention & Composite Identity

- **Unique Timeline Item ID:** Every item carries a deterministic string `timelineEventId` formatted as `${eventType}:${sourceId}` (e.g., `activity_logged:<event_id>`, `challenge_joined:<participation_id>`, `group_created:<group_id>`).
- **Group Creation vs. Creator Membership:** When a member creates a Group (`postgresGroupAuthority.ts:198-206`), both `groups` (`original_creator_member_id = memberId`) and `group_memberships` (`role = 'owner'`, `joined_at = groups.created_at`) are written in the same transaction. To prevent two nearly identical cards ("Created Group" and "Joined Group") for the same founding action, `group_joined` **MUST suppress** rows where `group_memberships.group_id` already emits `group_created` for the same `member_id` and `group_memberships.role = 'owner'` with `joined_at = groups.created_at` (unless the member is not the `original_creator_member_id`).
- **Activity Correction Lineage:** Existing recursive CTE in `api/src/memberRecentActivity.ts` collapses correction chains onto the single `accepted.event_id` (`application_rank = 1`), preventing duplicate timeline entries when an Activity is corrected or reversed.

### 3.4 Pagination & Cursor Behavior

- **Keyset Pagination:** Uses `limit` (default `20`, min `1`, max `50`) and opaque `cursor` (base64url-encoded JSON, max 2048 chars).
- **Cursor Payload (v2):**
  ```ts
  interface UnifiedTimelineCursor {
    version: 2;
    memberBinding: string; // sha256(memberId) base64url
    eventTimestamp: string; // ISO-8601 UTC with microsecond precision
    recordedAt: string;     // ISO-8601 UTC with microsecond precision
    sourceId: string;       // UUID
    eventTypeRank: number;  // integer rank for strict total order
    challengeId: string | null;
  }
  ```
- **Validation:** Canonical base64url round-trip check, `version === 2`, `memberBinding === memberBinding(auth.memberId)`, valid ISO timestamps, valid UUID `sourceId`, valid `eventTypeRank`, and `challengeId` matching the current request's `challengeId` filter. Any mismatch returns HTTP `400` (`invalid_cursor`).

### 3.5 Event-Specific Navigation

| `eventType` | Primary Navigation Target | Notes |
| --- | --- | --- |
| `group_created`, `group_joined` | `/v2/groups/${groupId}` | Navigates to Group Home. |
| `group_left` | `/v2/groups/${groupId}` (if Group is public/discoverable) or **non-navigable / disabled** if Group is private and member no longer belongs. | Server includes `navigation: { kind: 'group' | 'challenge' | 'none', path: string | null, accessible: boolean }` so the client never links into a guaranteed 403/404 dead-end without context. |
| `challenge_created`, `challenge_joined`, `challenge_exited`, `activity_logged`, `challenge_finalized` | `/v2/challenges/${challengeId}` | Navigates to Challenge detail (or finalized results view for `challenge_finalized`, which is hosted on `/v2/challenges/:challengeId`). |

### 3.6 Account Isolation

- The server derives `memberId` **exclusively** from `authenticatedMember(request)`.
- No query parameter, header, or cursor field may select or widen the target member.
- Every SQL branch filters by `member_id = $1` (authenticated `memberId`).
- React Query caches are scoped by `uid` and cleared on sign-out/account switch via `removeV2RecentActivity(queryClient, priorUid)` in `src/v2/routes.tsx`.

### 3.7 Handling of Missing, Withdrawn, or Inaccessible Entities

- **Withdrawn / Removed Challenge Participation:** Remains visible in the member's own timeline (`challenge_exited`, prior `activity_logged`, and any `challenge_finalized` row for that episode). Navigation to `/v2/challenges/:challengeId` remains valid if the member is still in the hosting Group or the Challenge is visible; if the member also left a private hosting Group, the server sets `navigation.accessible = false` and the UI displays the historical title with a subtle "No longer accessible" note instead of a broken link.
- **Left Group (`group_left`):** Remains visible as a personal milestone. If the Group is private and the member is no longer active, `navigation.accessible = false`.
- **Null `original_creator_member_id`:** Pre-029 Groups simply do not emit `group_created`; no placeholder or inferred creator event is emitted.

### 3.8 Historical Completeness Limitations

1. **Pre-029 Group Creation:** Groups created before migration `029_group_original_creator.sql` have `original_creator_member_id = NULL`. Their creation event cannot be reconstructed historically without a separate Founder-approved backfill.
2. **Multi-Episode Group Join/Leave History:** `group_memberships` enforces `UNIQUE (group_id, member_id)` and updates rows in place on leave/rejoin (`postgresGroupAuthority.ts:220-235`). If a member joins, leaves, and rejoins the same Group, the earlier join and leave timestamps are overwritten and **cannot** be reconstructed historically under the current schema.
3. **Pending / Rejected Group Requests:** `group_memberships` inserts `joined_at = now()` even when `status = 'pending'`. Therefore, `group_joined` must **only** be emitted for `status IN ('active', 'joined')` (or `status = 'left'` when `approved_at IS NOT NULL` or `role = 'owner'`).

### 3.9 Timezone Presentation

- **`activity_logged`:** Preserves `COALESCE(display.occurred_tz, config.snapshot->>'timezone', 'UTC')` as `displayTimezone`, displaying both `Performed` (`occurredAt`) and `Recorded` (`recordedAt`) times in `displayTimezone` with explicit timezone disclosure.
- **Challenge milestones (`challenge_created`, `challenge_joined`, `challenge_exited`, `challenge_finalized`):** Use the Challenge's governing `timezone` (`challenges.timezone` / `challenge_finalizations.timezone`) as `displayTimezone`.
- **Group milestones (`group_created`, `group_joined`, `group_left`):** Groups do not carry a governing timezone column; `displayTimezone` is `null` (or `'UTC'` in API metadata with `timezoneSource: 'viewer_local'`), and the UI formats the UTC ISO timestamp in the member's local browser timezone.

### 3.10 Separation from Group and Challenge Public Feed Items

- **Strict Read/Write Isolation:** The unified personal timeline **never** reads from or writes to `group_feed_outbox`, `group_feed_projection` (`025_group_feed_publication_authority.sql`), or `challenge_feed_shares` (`032_challenge_feed_activity_shares.sql`).
- **No Automatic Feed Publication:** Creating a Group/Challenge, joining, logging Activity, or finalizing a Challenge never automatically publishes to any Group or Challenge Feed.
- **Explicit Share Later:** Only eligible `activity_logged` items (where `revisionState !== 'reversed'` and participation/challenge rules permit) retain the explicit `Share {activityName} activity` button (`V2ActivityShareChoices mode="later"`).

---

## 4. Today and History Presentation Proposal

1. **Today (`/v2/today` — `V2RecentActivityPreview`):**
   - Displays the latest **2–3 meaningful events** (recommend `V2_RECENT_ACTIVITY_PREVIEW_SIZE = 3`, slicing up to 3 items) from the unified personal timeline.
   - Retains the `View all activity` link to `/v2/activity`.
2. **Full History (`/v2/activity` — `V2RecentActivityScreen`):**
   - Renders the complete, paginated unified private timeline across Groups, Challenges, Activities, and Finalized Results.
   - Preserves `Performed` / `Recorded` dual-timestamp disclosure for Activities, `Updated` / `Reversed` badges, and `Share ... activity` for eligible Activity items.
3. **Assessment of `Recent results` in Today (`finalizedResults`):**
   - Currently, `GET /api/today` returns `finalizedResults[]` and `V2TodayScreen.tsx` renders a separate `Recent results` section (`#today-results`) showing all finalized Challenges the member joined.
   - **Recommendation:** Integrate finalized participation outcomes into the unified `Recent Activity` timeline as `challenge_finalized` events. Once `challenge_finalized` events are live in the unified timeline, **retire the separate `Recent results` section in Today** (or keep `finalizedResults` in `/api/today` as empty/deprecated) so Today stays concise and avoids showing duplicate finalized-result cards in two sections.
4. **Challenge Details (`/v2/challenges/:challengeId`):**
   - Retain specialized Activity (`V2LatestChallengeContribution.tsx`, backed by `useV2LatestChallengeActivity(challengeId)`) and Challenge Feed (`V2ChallengeFeedView.tsx`) displays unchanged.
   - When `challengeId` is passed to `GET /api/me/activity`, it should either continue returning Activity-only items for backward compatibility with `V2LatestChallengeContribution.tsx`, or support an `eventTypes` filter (`eventTypes=activity_logged`).
5. **Profile History (`/v2/profile/challenges` — `V2ProfileChallengeHistoryScreen`):**
   - Remains accessible from Profile (`/v2/profile`) as the dedicated Challenge participation history list.

---

## 5. API Proposal

Extend `GET /api/me/activity` (or introduce `v=2` / `includeMilestones=true`opt-in query parameter during transition, defaulting to unified once UI is ready):

- **Endpoint:** `GET /api/me/activity` (canonical `/api/*` namespace via `API_PREFIX`)
- **Query Parameters:**
  - `limit?: number` (integer `1..50`, default `20`)
  - `cursor?: string` (opaque base64url cursor, max `2048` chars)
  - `challengeId?: string` (UUID; filters to events for one Challenge)
  - `types?: string` (optional comma-separated allowlist, e.g. `activity_logged` for `V2LatestChallengeContribution` backward compatibility)
- **Response Shape:**
  ```ts
  export type PersonalTimelineEventType =
    | 'group_created'
    | 'group_joined'
    | 'group_left'
    | 'challenge_created'
    | 'challenge_joined'
    | 'challenge_exited'
    | 'activity_logged'
    | 'challenge_finalized';

  export interface PersonalTimelineItem {
    timelineEventId: string; // `${eventType}:${sourceId}`
    eventType: PersonalTimelineEventType;
    category: 'group' | 'challenge' | 'activity' | 'result';
    occurredAt: string;      // ISO-8601 UTC (canonical sort timestamp)
    recordedAt: string;      // ISO-8601 UTC (tie-breaker / ledger timestamp)
    displayTimezone: string | null; // IANA tz or null (viewer local for Group events)
    navigation: {
      kind: 'group' | 'challenge' | 'none';
      path: string | null;
      accessible: boolean;
    };
    group?: { id: string; name: string; role?: string };
    challenge?: { id: string; title: string; challengeType?: string };
    activity?: {
      activityId: string;
      activityName: string;
      value: number;
      unit: string;
      acceptedAt: string;
      revisionState: 'current' | 'updated' | 'reversed';
    };
    exit?: {
      participationId: string;
      reason: 'withdrawn' | 'removed';
    };
    result?: {
      participationId: string;
      completed: boolean;
      completedAt: string | null;
      finalPosition: number | null;
      daysCompleted: number;
      bestStreak: number;
      finalStreak: number;
    };
  }
  ```

---

## 6. Migration Assessment

| Dimension | Option A: Read-Only Union Over Existing PostgreSQL Records | Option B: Append-Only Event Recording for Future Membership Changes |
| --- | --- | --- |
| **Schema changes** | **None.** Zero migrations. | Requires new migration (e.g. `036_group_membership_events.sql`) + write-path triggers/inserts in `postgresGroupAuthority.ts`. |
| **Write-path risk** | **Zero.** Read-only query composition. | Medium: touches Group join/leave/approve/reject/create transactions. |
| **Historical data** | Immediately surfaces all existing `challenges`, `challenge_participations`, `member_activity_events`, `challenge_participation_finals`, post-029 `groups` creations, and current `group_memberships`. | Only captures **future** Group membership transitions; still cannot reconstruct past Group leave/rejoin episodes. |
| **Founder Preview safety** | **Highest.** Cannot break existing writes or Founder Preview. | Higher risk; requires migration deployment before code can run. |

**Recommendation:** **Option A (Read-Only Union)** is the smallest, safest first implementation. It requires no database migration, introduces zero write-path risk, preserves Founder Preview, and delivers 100% of Challenge, Activity, Result, Group creation (post-029), and current Group membership milestones immediately. Option B can be evaluated later as a separate, Founder-approved migration if multi-episode Group join/leave audit history is required.

---

## 7. Verification Plan (Acceptance Tests)

1. **Group creation & joining:** Creating a Group emits `group_created` (no duplicate `group_joined` for the founding owner row). Joining an open Group emits `group_joined`. Joining a private/approval-required Group does **not** emit `group_joined` while `status = 'pending'` or `'rejected'`, and emits `group_joined` upon Steward approval (`approved_at` / `joined_at`).
2. **Challenge creation & joining:** Creating a Challenge emits `challenge_created` with `challenges.created_at`. Joining emits `challenge_joined` with `challenge_participations.joined_at`.
3. **Activity logging & correction:** Logging an Activity emits `activity_logged` with `revisionState: 'current'`. Correcting updates the displayed value and `recordedAt` with `revisionState: 'updated'`. Reversing preserves the originally accepted value and sets `revisionState: 'reversed'`.
4. **Challenge finalization:** Finalizing a Challenge emits `challenge_finalized` for each participant episode with `challenge_participation_finals.finalized_at` and frozen outcome fields.
5. **Rejoining & historical limitations:** Withdrawing and rejoining a Challenge produces distinct `challenge_joined`, `challenge_exited`, and second `challenge_joined` events. Leaving and rejoining a Group (under Option A) reflects only the latest state without fabricating lost intermediate episodes; pre-029 Groups with `original_creator_member_id IS NULL` do not emit `group_created`.
6. **Cursor ordering & pagination:** Mixed-category events sort deterministically by `(event_timestamp DESC, recorded_at DESC, source_id DESC, event_type_rank DESC)`. Paginating across pages yields zero duplicates and zero skipped items; tampered or cross-account cursors return `400 invalid_cursor`.
7. **Member privacy & cross-account isolation:** Unauthenticated requests return `401`. Authenticated Member A never sees Member B's Group joins, Challenge creations, Activities, or Results.
8. **Today vs. full History consistency:** Today's preview (`limit=3`) matches the exact top 3 items of `/v2/activity`.
9. **No automatic Feed publication:** Generating any timeline event (including `group_created`, `challenge_joined`, `activity_logged`, `challenge_finalized`) creates **zero** rows in `group_feed_outbox`, `group_feed_projection`, or `challenge_feed_shares`.

---

## 8. Independent Review & Boundary Check

- **Scope Check:** Documentation-only PR (`docs/architecture/TIIZI-V2-ACTIVITY-001-UNIFIED-PERSONAL-RECENT-ACTIVITY-CONTRACT.md`). Zero runtime code changes, zero SQL migrations, zero production or Founder Preview changes.
- **Independent Review Status:** Pending. Per `AGENTS.md` §4 (`FEF-TLC-001`), the authoring agent cannot self-approve or claim its own changes were independently reviewed. Independent Code Reviewer and Technical Lead review are required before any implementation authorization.

---

## 9. Founder Decisions Required

1. **Approve Option A (Read-Only Union) as Phase 1:** Confirm proceeding with a read-only union over existing PostgreSQL tables without a new migration (deferring Option B `group_membership_events` unless multi-episode Group join/leave history is needed).
2. **Retire Separate `Recent results` Section in Today:** Confirm integrating `challenge_finalized` into the unified `Recent Activity` timeline and retiring the separate `Recent results` section on `/v2/today` to avoid duplicate result cards.
3. **Today Preview Count:** Confirm displaying up to **3** latest events in Today's `Recent Activity` preview (currently capped at 2).
4. **Pre-029 Group Creator Provenance:** Confirm leaving `original_creator_member_id = NULL` Groups omitted from `group_created` (no inferred backfill).
