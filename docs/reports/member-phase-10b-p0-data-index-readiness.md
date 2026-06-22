# Phase 10B-P0 - Production Data / Index Readiness Verification

Date: 2026-06-14  
Scope: Catalog, template, challenge discovery, picker, and invite migration readiness  
Mode: Verification only. No app code, Firestore rules, indexes, or production data were changed.

## Status

**GO**

Production data is ready for the Phase 9B/9D member-facing catalog, template, challenge discovery, and picker flows based on dry-run evidence:

- Required Phase 9B/9D indexes are present in `firestore.indexes.json`.
- Firestore indexes dry-run completed successfully.
- Catalog/template dry-run found **0 pending writes**.
- Discovery fields dry-run found **0 pending writes**.
- Invite migration readiness is clean: **7 legacy invite codes**, **7 migrated invite records**, **0 missing mappings**, **0 orphaned invite records**.

Important distinction: this audit confirms the index definitions are present locally and deployable. If these index definitions have not already been deployed and finished building in Firebase, Kenogo still needs to deploy indexes before relying on the updated discovery/catalog queries in production.

## Index Readiness

### Required indexes found in `firestore.indexes.json`

| Flow | Collection | Required index shape | Present |
| --- | --- | --- | --- |
| Exercise picker | `catalogExercises` | `isPublished ASC, status ASC, visibility ASC, sortName ASC` | Yes |
| Exercise picker filtered | `catalogExercises` | `isPublished ASC, status ASC, visibility ASC, tier_1 ASC, sortName ASC` | Yes |
| Exercise picker filtered | `catalogExercises` | `isPublished ASC, status ASC, visibility ASC, tier_1 ASC, tier_2 ASC, difficulty ASC, sortName ASC` | Yes |
| Suggested challenge templates | `challengeTemplates` | `category ASC, isPublished ASC, status ASC, visibility ASC, sortName ASC` | Yes |
| Wellness templates | `wellnessTemplates` | `templateSource ASC, isPublished ASC, status ASC, visibility ASC, sortName ASC` | Yes |
| Wellness templates category | `wellnessTemplates` | `templateSource ASC, isPublished ASC, status ASC, visibility ASC, category ASC, sortName ASC` | Yes |
| Wellness templates category/difficulty | `wellnessTemplates` | `templateSource ASC, isPublished ASC, status ASC, visibility ASC, category ASC, difficulty ASC, sortName ASC` | Yes |
| Wellness activity picker | `wellnessActivities` | `isPublished ASC, status ASC, visibility ASC, sortName ASC` | Yes |
| Wellness activity picker category | `wellnessActivities` | `isPublished ASC, status ASC, visibility ASC, category ASC, sortName ASC` | Yes |
| Wellness activity picker category/difficulty | `wellnessActivities` | `isPublished ASC, status ASC, visibility ASC, category ASC, difficulty ASC, sortName ASC` | Yes |
| Wellness activity popular | `wellnessActivities` | `isPublished ASC, status ASC, visibility ASC, popular ASC, sortName ASC` | Yes |
| Group challenge lists | `challenges` | `groupId ASC, status ASC, startDate DESC` | Yes |
| Browse public challenges | `challenges` | `status ASC, visibility ASC, startDate DESC` | Yes |
| Browse public challenges compatibility | `challenges` | `status ASC, groupVisibility ASC, startDate DESC` | Yes |
| General active challenges | `challenges` | `status ASC, startDate DESC` | Yes |
| Public groups | `groups` | `status ASC, isPrivate ASC, createdAt DESC` | Yes |
| Challenge leaderboard summaries | `challengeLeaderboards` | `challengeId ASC, groupId ASC, score DESC` | Yes |

### Firebase index dry-run

Command:

```bash
firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges
```

Result:

```text
✔ cloud.firestore: rules file firestore.rules compiled successfully
✔ Dry run complete!
```

No missing or invalid local index definitions were detected by the dry-run.

## Backfill Dry-Run Results

### Catalog/template fields

Command:

```bash
npm run backfill:catalog-template-fields
```

Initial sandbox run failed because `tsx` could not create an IPC pipe under the sandbox:

```text
Error: listen EPERM: operation not permitted .../tsx-501/...pipe
```

The same read-only dry-run was rerun outside the sandbox and completed successfully.

Result summary:

| Collection | Scanned | Missing status | Missing visibility | Missing isPublished | Missing sortName | Writes planned |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `challengeTemplates` | 5 | 0 | 0 | 0 | 0 | 0 |
| `wellnessTemplates` | 8 | 0 | 0 | 0 | 0 | 0 |
| `catalogExercises` | 113 | 0 | 0 | 0 | 0 | 0 |
| `wellnessActivities` | 60 | 0 | 0 | 0 | 0 | 0 |

**Conclusion:** No catalog/template backfill apply is needed.

### Discovery fields

Command:

```bash
npm run backfill:discovery-fields
```

Initial sandbox run failed for the same `tsx` IPC pipe restriction. The read-only dry-run was rerun outside the sandbox and completed successfully.

Result:

```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "readCounts": {
    "groups": 7,
    "challenges": 27
  },
  "writeCounts": {
    "groups": 0,
    "challenges": 0
  },
  "pendingUpdates": {
    "groups": [],
    "challenges": []
  }
}
```

**Conclusion:** No discovery backfill apply is needed.

### Invite migration readiness

Command:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/theo/secure-keys/tiizi-challenges-firebase-adminsdk-fbsvc-0887feecee.json FIREBASE_PROJECT_ID=tiizi-challenges npm run audit:invite-migration-readiness
```

Result:

```json
{
  "projectId": "tiizi-challenges",
  "mode": "audit-only",
  "legacyInviteCodes": 7,
  "migratedInviteRecords": 7,
  "privateLegacyInviteCodes": 2,
  "publicLegacyInviteCodes": 5,
  "missingMappings": [],
  "orphanedInviteRecords": []
}
```

**Conclusion:** Private-group invite migration is ready for member join flows. No invite migration apply is needed.

## Flow Readiness

| Flow | Status | Evidence |
| --- | --- | --- |
| Browse Challenges | GO | Discovery backfill reports 0 pending challenge/group updates; challenge discovery indexes are present. |
| Suggested Challenges | GO | `challengeTemplates` scanned 5 docs with 0 missing lifecycle/search fields. |
| Challenge Templates | GO | `challengeTemplates` index and fields are ready. |
| Wellness Templates | GO | `wellnessTemplates` scanned 8 docs with 0 missing lifecycle/search fields. |
| Exercise picker | GO | `catalogExercises` scanned 113 docs with 0 missing lifecycle/search fields. |
| Wellness activity picker | GO | `wellnessActivities` scanned 60 docs with 0 missing lifecycle/search fields. |
| Private invite join | GO | Invite migration audit found 0 missing mappings and 0 orphaned records. |

## Validation Commands

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:group-invite-backend` | PASS | `Group invite backend security tests passed` |
| `npx tsc -b --pretty false` | PASS | No TypeScript output/errors |
| `npm run build` | PASS | Vite build succeeded; only warning is Firebase chunk over 500 kB |
| `firebase deploy --only firestore:indexes --dry-run --project tiizi-challenges` | PASS | Dry-run complete; rules compiled |
| `npm run backfill:catalog-template-fields` | PASS after sandbox rerun | 0 writes planned |
| `npm run backfill:discovery-fields` | PASS after sandbox rerun | 0 writes planned |
| `npm run audit:invite-migration-readiness` | PASS with explicit credentials | 0 missing mappings, 0 orphaned records |

## Commands Kenogo Should Run Next

No backfill apply command is required based on current dry-run results.

If the Phase 9B/9D indexes in `firestore.indexes.json` are not already deployed and fully built in Firebase, run:

```bash
firebase deploy --only firestore:indexes --project tiizi-challenges
```

After indexes are confirmed built, deploy the already-reviewed app/rules as appropriate for the release:

```bash
firebase deploy --only firestore:rules,hosting --project tiizi-challenges
```

Do **not** run these unless Kenogo is ready to deploy.

## Remaining Risks Before Deployment

1. **Index build timing:** The dry-run confirms local configuration is valid, but production queries can still fail with `failed-precondition` until deployed indexes finish building.
2. **No browser smoke test in this phase:** This verification was script/build based. After deployment, manually test authenticated member flows for Browse Challenges, Suggested Challenges, Create Challenge Wizard, exercise picker, wellness picker, and private invite redemption.
3. **Existing Phase 10A non-data risks remain:** This phase does not address group member-count scans, create-challenge auto-join resilience, Home fallback read cost, report prompts, or production console logging.

## Final Decision

**GO for data/index readiness**, with one operational condition:

Confirm Phase 9B/9D Firestore indexes are deployed and fully built before considering the member discovery/catalog/picker release production-ready.
