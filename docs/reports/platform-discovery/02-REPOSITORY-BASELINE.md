# Repository Baseline

## Audit identity

| Item | Observed value |
|---|---|
| Audit date | 2026-07-18 (Africa/Bujumbura) |
| Repository | `/Users/theo/tiizi_revamp` |
| Branch | `main` |
| Commit | `9dd1b4ccbc968afa782e93f582bc64afbd8dd435` |
| Node | `v20.20.0` |
| npm | `11.11.0` |
| Initial worktree | Dirty; all changes listed below pre-dated this audit |
| Production access | Not used |

The branch and SHA were rechecked during discovery and remained stable. The dirty worktree was accepted only because this audit writes to the previously absent `docs/reports/platform-discovery/` path.

## Repository structure

| Area | Role |
|---|---|
| `src/App.tsx` | Route graph, lazy-loading, authentication/onboarding/group/admin gates |
| `src/features/` | User and admin screens |
| `src/components/` | Shared UI, route guards, feed/social components |
| `src/hooks/` | React Query adapters and UI orchestration |
| `src/services/` | Firestore/client business operations |
| `src/types/index.ts` | Shared runtime-facing entity types |
| `src/data/` | Local catalogues, presets and fallback data |
| `functions/src/` | Callable, scheduled and Firestore-triggered backend logic |
| `scripts/` | Seeds, audits, guards, maintenance and deployment helpers |
| `firestore.rules`, `storage.rules` | Backend authorization rules |
| `firestore.indexes.json` | Query indexes |
| `firebase.json`, `.firebaserc` | Firebase deployment/emulator configuration |
| `docs/` | Product, audit, implementation and governance documentation |

Measured inventory: 105 explicit route-evidence lines, 103 `*Screen.tsx` files, 55 services, 37 hooks, 10 Cloud Function source files, 101 script files, 334 Markdown files, and 28 entries under `docs/reports/knowledge-catalogue/` including its CSV inventory.

## Frameworks and operations

The client is React 18 + React Router 6 + TanStack Query 5, built with TypeScript 5.7 and Vite 5. Firebase Auth, Firestore, Functions and Storage are used from the browser. Firebase Admin and Functions v2 implement callable, scheduled and document-triggered backend work. Tailwind and Lucide provide presentation.

The root scripts contain safe build/audit commands and destructive or write-capable commands. Examples of write-risk commands not run are `seed:*`, `cleanup:*`, `reset:all-data`, and `deploy:*`. The audit used repository inspection only.

## Initial dirty worktree

The complete baseline is retained in the task transcript. It contained 33 modified tracked files and untracked pre-existing reports, scripts, and source helpers. The principal modified domains were onboarding/profile, donations, wellness-template administration, `firestore.rules`, `firebase.json`, and guard scripts. Consequently, findings in those domains describe the inspected working tree, while deployment status is unresolved.

No baseline file was reset, staged, committed, or edited.

## Evidence

- `evidence/repository-baseline.txt`
- `evidence/route-evidence.tsv`
- `evidence/runtime-source-inventory.tsv`
- `package.json`
- `functions/package.json`
