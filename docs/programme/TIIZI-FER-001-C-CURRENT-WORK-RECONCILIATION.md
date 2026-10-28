# TIIZI-FER-001-C — Current Work Reconciliation (PR #107)

**Status:** PROPOSED NOTE — documentation only. Read-only analysis; PR #107 is **not** merged, modified or closed by this note.
**Verified:** `origin/main` `542052c12ca7910a297da89f28ae01120b220980`; Master Programme v2.80; open PRs: **#107** (`feat/v2-experience-recovery-001` @ `9e5477b008b2d5f0f759acf5770de9486f66e6e6`, "Experience Recovery 001 — first-run orientation, community entry, Support Tiizi information journey") and **#94** (`docs/ci-efficiency-alignment-001` @ `ab50718`, CI efficiency; unrelated, not touched). Companions: [A](TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md), [B](TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md).

## 1. PR #107 at a glance

23 files, +759/−6 (against the PR merge-base; a direct diff against `542052c` shows more because #106 files appear removed), base `542052c`, state MERGEABLE; a read-only `git merge-tree` of main and the PR head produced a clean tree (no textual conflicts). The PR's own merge-base predates #106 (FEF-TLC-001 activation), which merges cleanly. **The risk is semantic overlap and a version-number collision, not textual conflict.**

## 2. File-by-file disposition against the recovery baseline

| PR #107 file(s) | Verdict | Notes |
|---|---|---|
| `onboarding/orientationContent.ts` | **Conflicts (count), copy partly reusable** | Five slides (welcome, community, challenges, activity, begin). Baseline B.1 requires **four**; its slide 4 must include "encourage one another"; slide 5 invite entry is extra. No WhatsApp/migration wording found. |
| `onboarding/V2OrientationScreen.tsx`, `V2FirstRunGate.tsx`, `routes.tsx` (`welcome`) | **Conflicts (placement)** | Route is inside the protected scope, so slides appear **after** sign-in and only for members with zero Groups on the Today route. Baseline and the Founder (Q6, **resolved**) require four slides on a **public** route **before registration**. Skip/exit and generic (non-WhatsApp) invite entry are consistent. |
| `onboarding/orientationState.ts` | **Reusable** | Per-device `localStorage` seen-flag, storage-error guarded, no schema or backend. Re-offers on a new device — acceptable interim. |
| `public/onboarding/{welcome,community,challenges,activity,begin}.jpg` | **Unverified provenance** | PR says they derive from committed design exports (`stitch_tiizi_revamp/`); rights/provenance must be confirmed. They are static assets, not the media capability. |
| `support/supportContent.ts`, `V2SupportTiiziScreen.tsx` (`/v2/support`), `V2SupportTiiziCard.tsx` | **Reusable shell; content conflicts with B.6** | Information-only: free/voluntary, separate from cause, "contributions not open yet", no amounts/provider/totals/phone/WhatsApp wording (verified). Missing: amounts, frequency intention, recipient/holder disclosure, non-payable placeholders. **Contains a live `mailto:` to `support@tiizichallenges.com` labelled "Founder-confirmed"** — baseline §G lists the support contact as unconfirmed and §B.6 forbids active contact actions in development. |
| `profile/V2ProfileScreen.tsx` (+3), `member/MemberShell.tsx` (+2), `i18n/V2Locale.tsx` (+2) | **Overlaps / will be re-merged** | Adds Support card and two account-sheet entries ("Support Tiizi", "How Tiizi works"). Baseline B.5 replaces the avatar sheet with a full Profile page (P1a). Small, easy to drop. |
| `today/V2TodayScreen.tsx` (+3) | Minor overlap with P3 | "How Tiizi works" button in the empty state; P3 redesigns empty states. |
| `groups/V2GroupsScreen.tsx` (+7) | **Reusable** | `?tab=discover` parameter; harmless. |
| `scripts/testV2OrientationGuards.ts`, `package.json` (+1), `.github/workflows/ci.yml` (+2) | **Must be rewritten with the content** | The guard pins five slides and the information-only support copy; it would reject the four-slide / placeholder design. The new script line and CI step are the only CI changes; no dependency changes. |
| `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` (+21, new §17) | **Conflicts with A (FDR-00/01/02/04)** | Records the Founder's rejection of the first-time experience but states FD-PILOT-01 unchanged, Interests/Goals not authorized, contribution execution not authorized, and five slides. A supersedes those statements, notably FDR-00: FD-PILOT-01 is no longer authority for a reduced experience. |
| `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (+3/−2) | **Version collision** | Bumps 2.80→2.81 and adds a change-log row asserting information-only and unchanged FD-PILOT-01. A also proposes a row; whichever merges second takes the next version. Its text must be reconciled with A. |

## 3. Reusable, overlapping, conflicting — summary

- **Reuse (cherry-pick or re-implement):** `orientationState.ts` seen-flag pattern; the skippable slide layout (not the five-slide content); `?tab=discover`; the information-only Support screen layout/card (after removing `mailto:` and adding B.6 content).
- **Overlap:** `routes.tsx`, `MemberShell.tsx`, `V2ProfileScreen.tsx`, `V2TodayScreen.tsx`, locale keys — all files P1a/P3/P8a will edit. Landing #107 first would force re-work; landing P1a first would force #107 to rebase.
- **Conflict:** slide count and placement; the `mailto:`; the two documentation edits; the CI guard.
- **Does not touch:** engines, API, schemas, migrations, Group/Challenge code.

## 4. Recommendation (for Technical Lead and Founder)

1. **Do not merge #107 as is.** Leave it open and unmodified until Gate 0.
2. After Founder approval of A, **supersede #107 by P1a + P8a**, carrying over only the reusable items above; then close #107 with a pointer (Founder/Technical Lead decision; not done here).
3. **Drop #107's two documentation edits**; the single Gate 0 disposition replaces them.
4. Confirm provenance/rights of the five onboarding images before any reuse; confirm the support address (or remove it) under A §Q5.
5. Treat the version number 2.81 as unassigned until merge order is known.

## 5. Other current-work observations

- The primary checkout was reported stale/dirty and was **not altered**; this work used an isolated worktree off `origin/main`.
- Stale scratch worktrees under `/private/tmp` (several marked prunable) exist; not touched.
- PR #94 is open and unrelated; do not merge incidentally.

**Disposition:** PROPOSED. No merge, close, code or deployment action taken or implied.
