# Member Phase 5: Discovery Completeness

Date: 2026-06-10

## Scope

Member-facing group and challenge discovery/read paths were audited and updated for pilot readiness:

- public challenge discovery
- user-accessible challenges
- group challenge lists
- group discovery
- challenge cards on home, groups, challenges, and challenge detail screens

## Old Read Patterns Found

| Path | Old pattern | Risk |
| --- | --- | --- |
| `challengeService.getVisibleChallengesForUserPage` | Queried broad `challenges` by `status`, read group docs separately, then inferred public/private visibility client-side. | High: broad challenge pages plus extra group reads could miss public items and scale poorly. |
| `challengeService.getUserAccessibleChallenges` | Loaded every active group membership, queried all matching group challenges without sort/limit, then sorted client-side. | High for users in many groups. |
| `challengeService.getChallengesByGroup` | Queried all challenges by `groupId` without status/order/limit. | High for large groups. |
| `groupService.getGroups` | Previously exposed first-page semantics to screens as if it were a complete group catalog. | Medium: first 50 groups could hide valid public groups. |
| `GroupsScreen` | Loaded group list plus challenge list to derive active challenge counts. | Medium: discovery screen depended on a separate challenge query. |
| `BrowseChallengesScreen` | Loaded visible challenges and groups, then filtered public/private visibility client-side. | High: depended on first page of groups and could hide valid challenge cards. |
| `ChallengeDetailScreen` | Used first public groups page to validate `groupId` query params. | Medium: challenge detail could treat valid group IDs as invalid if group was not in first page. |
| discovery participant counts | Re-read `challengeMembers` to recompute counts for challenge cards. | High: cross-user membership reads should not be part of card discovery. |

## New Read Patterns Implemented

| Path | New pattern |
| --- | --- |
| Public groups | `groups where status == "active" and isPrivate == false orderBy createdAt desc limit pageSize`, with cursor pagination. |
| Public challenges | `challenges where status == ... and visibility == "public" orderBy startDate desc limit pageSize`, with cursor pagination for single-status public browsing. |
| User-accessible challenges | Reads the user's active group memberships, then bounded `groupId in [...] + status + orderBy startDate desc + limit` queries. |
| Group challenges | `challenges where groupId == ... and status == ... orderBy startDate desc limit pageSize`, with cursor pagination. |
| Challenge cards | Use `participantCount` from challenge docs directly; no challenge member scan for counts. |
| Challenge detail group lookup | Reads the exact challenge group via `useGroup(challenge.groupId)` instead of relying on the first public groups page. |

## Discovery Model Changes

Challenge docs now support denormalized visibility fields:

- `visibility: "public" | "private"`
- `groupVisibility: "public" | "private"`
- `createdAt` for legacy-compatible sorting/backfill consistency

Group docs now support:

- `visibility: "public" | "private"`
- `isPrivate: boolean`
- `status` and `reviewStatus` backfill repair for legacy docs

New group/challenge creation writes these fields immediately. Legacy docs are handled by the backfill script.

## Files Changed

- `firestore.indexes.json`
- `scripts/backfillDiscoveryFields.ts`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/features/Challenges/ChallengeDetailScreen.tsx`
- `src/features/Challenges/ChallengesScreen.tsx`
- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Groups/GroupsScreen.tsx`
- `src/hooks/useChallenges.ts`
- `src/hooks/useGroups.ts`
- `src/services/challengeService.ts`
- `src/services/groupService.ts`
- `src/types/index.ts`

## Indexes Added

- `challenges`: `status ASC`, `visibility ASC`, `startDate DESC`
- `groups`: `status ASC`, `isPrivate ASC`, `createdAt DESC`

Existing relevant indexes retained:

- `challenges`: `groupId ASC`, `status ASC`, `startDate DESC`
- `groups`: `status ASC`, `createdAt DESC`
- admin/group/report/donation/member summary indexes

## Backfill

Script: `npm run backfill:discovery-fields`

Dry-run behavior:

- reads `groups` and `challenges`
- computes missing discovery fields
- prints pending updates
- writes nothing unless `--apply` is passed
- refuses production writes unless `CONFIRM_PROJECT_ID` matches the active Firebase project

Dry-run output summary:

```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "durationMs": 2844,
  "readCounts": {
    "groups": 7,
    "challenges": 26
  },
  "writeCounts": {
    "groups": 0,
    "challenges": 0
  },
  "pendingUpdateCounts": {
    "groups": 7,
    "challenges": 26
  }
}
```

Notable pending repairs:

- Public visibility/status fields for seed public groups.
- Private visibility fields for `seed_group_trail_seekers` and `seed_group_zen_yoga`.
- `visibility`, `groupVisibility`, and some missing `createdAt` fields on challenge docs.

## Remaining Risks

- Search remains client-side over loaded rows only. A real global search should use Algolia/Meilisearch or a purpose-built indexed prefix field.
- `getUserAccessibleChallengesPage` is bounded but does not expose a true cross-group global cursor because Firestore cannot cursor naturally across many `groupId in [...]` chunks. It is pilot-safe for normal group counts, but production-scale users in many groups should move to a materialized user challenge feed.
- Legacy public/private correctness depends on running the discovery backfill before relying exclusively on `visibility` fields in production.
- Some non-primary member surfaces still use compatibility hooks (`useGroups`, `useChallenges`) that return the first bounded page for compact profile/exercise/home fallback views. They are no longer full scans but are not full-catalog views.

## Validation Results

`npx tsc -b`

- Result: pass
- Output: no diagnostics

`npm run build`

- Result: pass
- Output summary:

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1832 modules transformed.
✓ built in 3.46s
```

`firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges`

- Result: pass
- Output summary:

```text
=== Deploying to 'tiizi-challenges'...
i  deploying firestore
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
✔  cloud.firestore: rules file firestore.rules compiled successfully
✔  Dry run complete!
```

`npm run backfill:discovery-fields`

- First sandbox run failed before script execution because `tsx` could not create its local IPC pipe.
- Rerun with tool approval started the script, then exposed the old hard requirement for `GOOGLE_APPLICATION_CREDENTIALS`.
- Script was adjusted to allow Application Default Credentials for dry-run while preserving the production `CONFIRM_PROJECT_ID` write guard.
- Final result: pass, dry-run only, no writes.
