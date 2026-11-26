# TIIZI-V2-UX-008 — START-01 starting-point receipt

**Task:** TIIZI-V2-UX-008 — New-member Today and responsiveness
**Authority:** Founder direction recorded in the Founder walkthrough of 26 November 2026, plus the
task assignment text (New-member Today; Discovery image diagnosis; Responsiveness diagnostics).
**Observation time:** 2026-11-26, 14:05–15:45 EAT (repository observations taken in this session).
**Repository:** `Fkenogo/tiizi_challenges`, local clone `/Volumes/PRODUCTION/Projects/tiizi_revamp`.
**PRG-01 tool:** `node scripts/prg01LocalReconciliation.mjs` was executed in the working worktree
before any edit (exit 0; output `SOURCE_ONLY_RECONCILED`). Its diagnostic success is not an
authorization to code; the facts below are the basis for that judgement.

---

## 1. Refreshed remote state

| Fact | Value |
| --- | --- |
| `git fetch origin` result | Up to date; no new remote refs |
| `origin/main` SHA | `0f23e3d008f93db7c639175639666a9f81797da1` |
| `origin/main` subject | `Merge pull request #191 from Fkenogo/feat/v2-ux-007` — "TIIZI-V2-UX-007: Today Covers, Image Performance, Group Save UX and Profile Simplification" |
| Approved UX-007 baseline in the assignment | `0f23e3d008f93db7c639175639666a9f81797da1` |
| Comparison | **IDENTICAL** — the refreshed remote `main` IS the approved baseline |

## 2. Working branch, HEAD, merge-base

| Fact | Value |
| --- | --- |
| Working branch | `feat/v2-ux-008` |
| Worktree | `/Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-008` (created for this task, isolated) |
| Starting HEAD | `0f23e3d` (branch created directly from the approved baseline) |
| Merge-base with `origin/main` | `0f23e3d` — the branch has no divergence from the approved baseline |
| Dirty files in the working worktree | None at start (only the task's own edits afterwards) |

## 3. Dirty work and other worktrees — PRESERVED, NOT TOUCHED

| Path | State | Action |
| --- | --- | --- |
| `/Volumes/PRODUCTION/Projects/tiizi_revamp` (primary checkout) | branch `main` at `5a01239`, **121 dirty paths**, behind `origin/main` by 777 commits | Left untouched. Not a usable base. |
| `.worktrees/founder-preview` | detached `ad74333` | Left untouched. Superseded by the approved baseline. |
| `.worktrees/founder-preview-ux007` | detached `0f23e3d` | Left untouched. This is the UX-007 Founder Preview artifact; **not restarted, not rebuilt, not modified**. |
| `.worktrees/v2-ux-007-corr-001` | `feat/v2-ux-007` at `13876da` | Left untouched (merged content of the approved baseline). |
| ~120 further worktrees (other agents/trees, incl. `/Users/theo/.t3/…`, `/Users/theo/.codex/…`) | various | Left untouched. |

## 4. Open and stacked PRs (relevance to this task)

| PR | Title | State | Relation to TIIZI-V2-UX-008 |
| --- | --- | --- | --- |
| #191 | TIIZI-V2-UX-007 | **MERGED** (`0f23e3d`) | The accepted baseline this task must preserve |
| #150 | Add preference-aware discovery to V2 Today | OPEN, not draft, head `3aa0147` **not** in `origin/main` | **OVERLAP** — touches the same Today discovery surface. Not accepted; not a base |
| #171 | Restore V2 Today discovery and public previews | DRAFT, head `7ebe03b` not in `origin/main` | **OVERLAP** — same surface, draft only |
| #145 | Founder Preview corrections | DRAFT, head already in `origin/main` | No new content |
| #143 | Slice 5B operator Template lifecycle | OPEN, not in `origin/main` | Out of scope for this task |

**Overlap handling:** the merged baseline already contains the preference-aware Today discovery that
#150/#171 propose; this task does not adopt either branch. The unified "Suggested for you"
presentation changes the *presentation* of the merged discovery surface and must be reconciled by the
reviewer against #150/#171 before merge. Recorded here and in the delivery report.

## 5. Founder-accepted implementation and evidence

| Fact | Value | Evidence |
| --- | --- | --- |
| Accepted implementation | UX-007 media implementation: signed-URL image rendering with `assetKey`-guarded previous image, `onExpired` refresh, loading fallback; Today `coverImage` on required/joined/opportunity/upcoming items; PRIV-05 read-URL TTL capped at 60s | Merge commit `0f23e3d`; `api/test/todayCovers.test.ts`, `api/test/durableMedia.test.ts`; `src/v2/media/V2SignedImage.tsx` (UX-007 commit `13876da`) |
| Acceptance status of that implementation | Merged into `main` by the Founder-approved PR #191 | `git log origin/main`; PR #191 title |
| Governed constraints preserved by this task | PRIV-05 signed-URL lifetime ≤ 60s; R2 access restrictions; catalogue `cover_id` backgrounds; Group/Challenge cover ownership (Steward / creator-then-Steward) | `docs/programme/TIIZI-V2-MEDIA-1-DESIGN-CLOSURE-AND-GOVERNANCE-RECONCILIATION-001.md`; `api/src/r2ObjectStore.ts:31-35` |

## 6. START FROM / DO NOT START FROM

**START FROM** — `origin/main` = `0f23e3d008f93db7c639175639666a9f81797da1`, on branch
`feat/v2-ux-008`, in the isolated worktree `.worktrees/v2-ux-008`. Behaviour to preserve: the
UX-007 media implementation in full (signed-URL rendering, expiry refresh, loading states, PRIV-05
TTL cap), the governed discovery ranking and relevance rules, the governed Group-join and
Challenge-participation rules, and the governed Group/Challenge cover authority.

**DO NOT START FROM** — the primary checkout's local `main` (`5a01239`, dirty, 777 commits behind);
`.worktrees/founder-preview` (`ad74333`); the unmerged PR #150 / #171 heads; any V1 surface.

## 7. Task-relevant active routes, imports and build selection

| Fact | Value |
| --- | --- |
| Routes in scope | `/v2/today`, `/v2/groups`, `/v2/groups/:groupId`, `/v2/challenges`, `/v2/challenges/discovery/:challengeId`, `/v2/challenges/:challengeId`, `/v2/sign-in` (`src/v2/routes.tsx:110-138`) |
| API seams in scope | `api/src/today.ts`, `api/src/challengeDiscovery.ts`, `api/src/groupDiscovery.ts`, `api/src/challengeReads.ts`, `api/src/groupReads.ts`, `api/src/mediaService.ts`, `api/src/mediaRoutes.ts`, `api/src/r2ObjectStore.ts` |
| Client seams in scope | `src/v2/today/*`, `src/v2/challenges/V2ChallengeCover.tsx`, `src/v2/groups/V2GroupCover.tsx`, `src/v2/media/V2SignedImage.tsx`, `src/api/todayApi.ts`, `src/api/groupsApi.ts`, `src/api/challengeDiscoveryApi.ts` |
| Build selection | Root `npm run build` (`tsc -b && vite build`) covers `src` + `api` + `functions` workspaces, each with its own `package.json` and `node_modules` |
| V1 boundary | Product V1 stays excluded (`AGENTS.md` §1); nothing in this task touches V1 |

## 8. Preview artifact, environment and fixture identity

| Fact | Value |
| --- | --- |
| Founder Preview artifact (existing) | `.worktrees/founder-preview-ux007` at `0f23e3d` (detached). **Not running at observation time** and **not restarted** by this task. |
| Isolated preview used for this task | `.worktrees/v2-ux-008` at the task branch tip, started with `npm run preview:founder` |
| Isolated preview environment | Loopback-only: temporary local PostgreSQL cluster (`127.0.0.1:59992/tiizi_founder_preview`, disposable marker verified), Firebase Auth emulator (`127.0.0.1:19099`, project `demo-tiizi-founder-*`), real API (`127.0.0.1:4019`), Vite web (`127.0.0.1:5178`) |
| Media provider in the isolated preview | Local S3-compatible HTTPS test double (self-signed, `https://127.0.0.1:9443`) wired through the real `R2_*` configuration path. **No cloud credential, no production bucket, no R2 credential change.** |
| Fixture identity | `scripts/previewS5bSeed.ts` — Group "KILIMANJARO — S5b Today Preview" (public, `focus_tags=['Strength']`, `goal_ids=['build_strength']`); Challenges "Morning Momentum" (Streak), "Summit Steps Together" (Together), "Reps Race" (Race), "Sunrise Reset" |
| Identities | `amara@tiizi.local` — existing member with active Challenge participation; `founder1@tiizi.local` — new member, no Group or Challenge participation, saved interests/goals Strength + Build strength |
| Production / Neon / R2 preview data | **UNKNOWN on this machine.** `.env` and `.env.local` hold no `DATABASE_URL`, no `R2_*` and no Neon credential; `previewFounder` deletes inherited `DATABASE_URL`/`FIREBASE_CONFIG` by design. The Founder's Neon preview data and R2 media are therefore **not reachable** from this environment. |

## 9. Findings

**CONFIRMED**
- `origin/main` is exactly the approved UX-007 baseline `0f23e3d`; the assignment's baseline SHA and the refreshed remote SHA agree.
- The UX-007 media implementation is present in `main` and is the behaviour this task preserves.
- The primary checkout is dirty and 777 commits behind; it was and remains untouched.
- The Founder Preview artifact `.worktrees/founder-preview-ux007` exists at `0f23e3d` and was not running; it was not restarted, rebuilt or modified.
- The approved baseline already contains preference-aware Today discovery, so open PR #150 and draft PR #171 overlap the surface this task changes.

**CONFLICTED**
- None.

**UNKNOWN**
- The Founder's Neon preview database and R2 media bucket are not reachable from this machine (no credential present, and the preview refuses inherited production identifiers by design). Consequences: (a) timings measured here are **local-preview timings**, not Neon timings; (b) image availability for *persisted* covers is proven against the governed upload path with a local object-store test double, not against the Founder's R2 bucket. This is stated as an explicit limitation in the delivery report rather than papered over.

## 10. Result

**PASS WITH EXPLICIT LIMITATIONS** — for the assigned implementation work.

Authorised and proceeding:
- the new-member "Suggested for you" Today experience;
- confirmed projection/rendering image defects only;
- bounded, verified responsiveness optimizations that do not alter governed data or access rules;
- a follow-up requirement record for the unified Personal Recent Activity timeline (no implementation);
- real-Chromium E2E against an isolated preview using existing authorized preview resources only.

Not authorised and not done: merge, deployment, database migration, destructive cleanup, R2 credential
change, unrelated feature work. PR #150/#171 reconciliation is left to the reviewer.
