# TIIZI MC-1 — V2 Member Bootstrap: Closure Record 001

**Status:** MC-1 — **FOUNDER ACCEPTED / MERGED / CLOSED** (implementation). This closure record is documentation only and awaits Founder review.
**Date:** 2026-10-11 · **Master Programme:** 2.66 → 2.67

## Acceptance facts
| Item | Value |
| --- | --- |
| Accepted implementation head | `b20287a5ce74d666baa8bd9f4079d1c6a2d8b3cd` |
| Pull request | #91 (https://github.com/Fkenogo/tiizi_challenges/pull/91) |
| Merge commit (main) | `c41c17eea22fb926f14d55bbecfe7a39bb4aff1c` |
| Merged at | 2026-10-11T13:38:57Z (merge commit, pinned to the accepted head) |
| Repository CI | Actions run #264, run ID 38139796235 — all six jobs COMPLETE / SUCCESS: `web`, `api`, `functions`, `api image`, `boundary`, `api contract` |
| Unresolved review threads | 0 (all nine resolved) |
| Migration | `026_member_canonical_display_name.sql` — merged as code, **NOT deployed** |
| Deployment / production access | none |
| Archived Product V1 | frozen; shared `AuthContext` and V1 `SignupScreen` unchanged from the pre-MC-1 main |

## What was accepted
`POST /api/members/bootstrap` as the single explicit, idempotent, race-safe member provisioning seam (actor from the verified token only; optional insert-only `displayName`; ordinary `member` role only; strict `401 unknown_member` everywhere else); nullable `members.display_name`; and the V2 client path (V2-only email sign-up with an immediate UID-keyed, `sessionStorage` name hand-off; identity-bound bootstrap using a captured Firebase user and explicit bearer token; UID-bound ready gate; hand-off cleared only after successful bootstrap or successful sign-out). Full contract and design: [`TIIZI-MC-1-MEMBER-BOOTSTRAP-IMPLEMENTATION-001.md`](TIIZI-MC-1-MEMBER-BOOTSTRAP-IMPLEMENTATION-001.md).

## Codex review and exact-head waiver
- Codex reviews of earlier heads produced findings across heads `b44cc57`, `15aec13`, `8ea1f4c`, `c68ebf2` and `b846b21`. Each was corrected in a later commit before acceptance; the three findings on `b846b21` (name capture before the legacy cache, hand-off cleared only after sign-out succeeds, token bound to the gate uid) were corrected in `b20287a`.
- The exact-head Codex review on `b20287a` **could not run**. Codex replied: "You have reached your Codex usage limits for code reviews."
- The Founder **waived the exact-head Codex review requirement for PR #91 only**, as an exceptional review-gate substitution (green CI #264 plus zero unresolved threads). This is **not** a standing policy change. The waiver was recorded as a PR comment before the merge, with no commit.

## Cloudflare
The Workers Builds check failed independently, repeatedly across multiple PR heads (each time within about a second), with no evidence tying it to MC-1. Repository CI stayed green. It is classified non-repository and non-gating for this acceptance. It was not investigated here and no Cloudflare deployment or configuration was changed.

## Not an MC-1 blocker: Today greeting
Because V2 sign-up no longer goes through the shared `AuthContext.signup`, the Today greeting (which reads the legacy local profile cache) may show the email-prefix fallback right after a fresh sign-up until the next reload or sign-in. The canonical name is the PostgreSQL `members.display_name`. This is display-only and **not** an MC-1 blocker. The V2 sign-up flow does not write the legacy cache.

## Carry-forward to MC-2
> Today greeting and other V2 member-name consumers must migrate from the legacy local profile cache to the governed V2 Profile / canonical member identity once MC-2 provides that read model. Do not alter archived V1 to solve this.

## Boundaries preserved
MC-2, MC-3, MC-4, MEDIA, REC-1, LIFE-1, STEW-1, CF-2+ and BG-1 are **not started**. Migration 026 requires its own governed deployment step; real multi-connection concurrency was verified only by an ad-hoc local PostgreSQL 16 proof (PGlite tests serialise requests) and remains an implementation verification note for any staging deployment.
