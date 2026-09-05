---
title: "Stage F T1/T2 Consolidation Report"
document_type: "Consolidation Report"
stage: "Stage F — Product & Technical Translation"
version: "0.1"
date: "2026-09-05"
status: "Complete — Submitted for Founder Review"
reconciliation_report: "STAGE-F-FOUNDER-WORKING-BASELINE-RECONCILIATION-001 (d5f3baf)"
branch: "docs/stage-f-t1-t2-consolidation-001"
---

# Stage F T1/T2 Consolidation Report

## 1. Entry State

| Item | Value |
|---|---|
| Entry origin/main SHA | `382cafc5f358a7a58000ab03725f4b5453833e21` |
| Entry HEAD (primary worktree) | `5a012396700fde9aee8aa2b72663a2c7e5564bd3` |
| Primary worktree status | Dirty (99 paths — pre-existing code changes, not modified by this task) |
| Ahead/behind origin/main | Primary worktree behind origin/main; clean worktree based on origin/main |
| Incomplete Git operation | None |
| Worktree inventory | 8 existing worktrees + 1 new (`/private/tmp/tiizi-stagef-t1t2`) |
| Consolidation worktree | `/private/tmp/tiizi-stagef-t1t2` @ `382cafc` on branch `docs/stage-f-t1-t2-consolidation-001` |

## 2. Authority Re-Verification Result

**Result: NO SUBSTANTIVE AUTHORITY CONFLICT FOUND.**

Re-checked authority surfaces materially relevant to T1/T2:

| Authority Surface | Status | Notes |
|---|---|---|
| EOG-E1-01 (v0.2, filed 2026-09-03) | Verified | 40 sections, 10 Parts; Challenge Engine §35 boundary confirmed |
| EKG-01 (v0.1, approved 2026-09-02) | Verified | 6 Fitness + 6 Wellness categories; Knowledge Authority = Founder |
| Group domain authority | Verified | EOG-E1-01 Part I (§§2-5); CGP-04 register rows 1-6 |
| Challenge domain authority | Verified | EOG-E1-01 Part III (§§13-18); CGP-04 rows 7-10 |
| Activity / Activity Event authority | Verified | EOG-E1-01 Part IV (§§19-25); self-accountability model |
| Profile authority | Verified | EOG-E1-01 Part VI (§§30-32) |
| Visibility/privacy authority | Verified | EOG-E1-01 §§30-32; approved visibility classes |
| PAM / CGP controls | Verified | CGP-03 (documentation standard) + CGP-04 (entity-relationship register) both approved |
| Master Programme | Verified | Stage F = Not Started; 5 deliverables defined |
| ACT-03 | Preserved | Verification Authority — deferred |
| ACT-04 | Preserved | Correction Authority — deferred |
| MOT-01 | Preserved | Recognition Authority — deferred |
| Rewards deferral | Preserved | No implementation/custody/entitlement authorized |

**Conclusion:** The reconciliation report (d5f3baf) remains valid. Proceeding to drafting.

## 3. Source Inventory

### 3.1 Reconciliation Report Used

- **File:** `docs/programme/STAGE-F-FOUNDER-WORKING-BASELINE-RECONCILIATION-001.md`
- **Branch:** `recon/stage-f-founder-baselines-001`
- **Commit:** `d5f3baf`
- **Status:** Available on origin/main (merged via PR) and local recon worktree

### 3.2 Eleven Founder Working Baselines Consolidated

| # | Source File | SHA-256 (short) | Target |
|---|---|---|---|
| 1 | TIIZI-V2-STAGE-F-PRODUCT-MODEL-FOUNDER-WORKING-BASELINE-v0.1 | `6b31bbb8` | T1 Parts A-I, Y-Z |
| 2 | TIIZI-V2-STAGE-F-COLLECTIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 | `faa531b5` | T1 Part J |
| 3 | TIIZI-V2-STAGE-F-COMPETITIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 | `71562b85` | T1 Part K |
| 4 | TIIZI-V2-STAGE-F-STREAK-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1 | `866d56d8` | T1 Part L |
| 5 | TIIZI-V2-STAGE-F-SHARED-CHALLENGE-EXPERIENCE-FOUNDER-WORKING-BASELINE-v0.1 | `0df5df6d` | T1 Parts O-T |
| 6 | TIIZI-V2-STAGE-F-FUNCTIONAL-REQUIREMENTS-BASELINE-FOUNDER-WORKING-BASELINE-v0.1 | `1a966fd7` | T2 (whole) |
| 7 | TIIZI-V2-STAGE-F-LOGICAL-PRODUCT-AND-DOMAIN-MODEL-FOUNDER-WORKING-BASELINE-v0.1 | `02ee9869` | T1 Part Y |
| 8 | TIIZI-V2-CALCULATION-AND-DERIVED-TRUTH-MODEL-FOUNDER-WORKING-BASELINE | `aa570df1` | T1 Part M (Calculation Schedule) |
| 9 | TIIZI-V2-RECOGNITION-AND-ACHIEVEMENT-MODEL-FOUNDER-WORKING-BASELINE | `3bf48042` | T1 Part U |
| 10 | TIIZI-V2-CONTRIBUTION-AND-CAUSES-FUNCTIONAL-MODEL-FOUNDER-WORKING-BASELINE | `77712c92` | T1 Parts V-W |
| 11 | TIIZI-V2-NOTIFICATIONS-FEED-DISCOVERY-AND-SOCIAL-BEHAVIOUR-MODEL-FOUNDER-WORKING-BASELINE | `80fffeab` | T1 Parts O-T (governing over older feed wording) |

**All 11 source baselines represented in consolidation.** No source file was modified.

## 4. Files Created

| File | Lines | Size | Description |
|---|---|---|---|
| `docs/programme/STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md` | 1,701 | 96 KB | T1 — Stage F Product Definition |
| `docs/programme/STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md` | 1,995 | 83 KB | T2 — Stage F Functional Requirements |
| `docs/programme/STAGE-F-T1-T2-CONSOLIDATION-REPORT-001.md` | — | — | This consolidation report |

## 5. Consolidation Architecture

**Why T1 + T2 (two documents, not one or eleven):**
- The 11 working baselines overlap heavily (each Challenge type repeats establishment/feed/recognition/extension boilerplate). Separate authority would re-create the inconsistency surface the reconciliation closes.
- Requirements (testable SHALLs) and product definition (meaning/behaviour) have different readers and different Master Programme deliverable slots.
- T1 satisfies the Master Programme "Calculation & Derived Truth" deliverable via its embedded Calculation Schedule.
- T2 satisfies the Master Programme "Functional Requirements" deliverable.

**Precedence applied:**
1. Approved/current Tiizi governance and controlled authority
2. Latest Founder position established by the reconciliation report
3. Compatible Founder Working Baseline material
4. Existing implementation only as evidence, never as product authority
5. Historical V1/V2 material only for traceability

## 6. Superseded Working Positions Removed

| Finding | Superseded Position | Replaced By |
|---|---|---|
| F-A-01 | One Activity Event → many Challenges association (Logical Model §4 ¶106, §9.3 ¶462-474, ¶597, ¶862, ¶981/1030) | Challenge-specific logging; deliberate separate logging per Challenge (Calculation §§3, 40) |
| F-B-01 | "Highest Performance" Competitive mode (Logical Model ¶545, ¶625) | Race-to-target only; no HP mode (Calculation §12) |
| F-B-02 | Competitive tie-break/non-completer ordering deferred (Competitive ¶206, ¶225, ¶528/566/596-597) | Shared position for ties; no position for non-completers (Calculation §§16-17) |
| F-C-01 | Weekly-frequency Streak (Logical Model §11.4 ¶650-660) | Daily-only Streak (Calculation §20) |
| F-C-02 | Streak late-join/timezone deferred (Streak ¶294-296, ¶649) | Late joining allowed with fixed denominator; one governing timezone (Calculation §§27-28, 30-31) |
| F-E-01 | Challenge Feed SHOULD / Activity MAY surface / comments MAY (FR-V2-128/129/133, SharedExp §26) | No Home Feed; Group Feed = single community stream; Share-to-Group explicit; no comments/replies (Notifications baseline) |
| F-GOV-01 | "Challenge Engine"/"Challenge Feed"/"leaderboard-as-standing" phrasing | Aligned to EOG-E1-01 §35 terminology |

## 7. Genuine Deferrals Preserved

All preserved deferrals confirmed present in both T1 and T2:

- **ACT-03** — Verification Authority (6 refs T1, 7 refs T2)
- **ACT-04** — Correction Authority (6 refs T1, 7 refs T2)
- **MOT-01** — Recognition Authority (8 refs T1, 8 refs T2)
- **Rewards** — implementation/custody/entitlement (preserved in both)
- **Technical IAM/RBAC** — downstream
- **Database/schema** — downstream
- **API contracts** — downstream
- **Payment-provider selection** — downstream
- **Tiizi Social Cause custody/escrow** — not authorized
- **Deployment/infrastructure** — downstream
- **V1→V2 migration** — downstream

## 8. FR Accounting Totals

| Category | Count |
|---|---|
| Original FR-V2 IDs (FR-V2-001 to FR-V2-206) | 206 |
| New FR IDs added | 6 |
| Total unique FR IDs in T2 | 212 |
| KEEP | 163 |
| ALIGNED WORDING | 18 |
| CONSOLIDATED | 0 |
| SUPERSEDED (with replacement pointer) | 8 |
| DOWNSTREAM | 2 |
| PRESERVED DEFERRAL | 9 |
| NEW (after FR-V2-206) | 6 |
| **Total accounted for** | **206 + 6 = 212** |
| Missing FR IDs | 0 |
| Duplicate active FR IDs | 0 |

### New FR IDs

| ID | Subject | Source |
|---|---|---|
| FR-V2-207 | Challenge-specific Activity logging | Reconciliation F-A-01 |
| FR-V2-208 | No Highest Performance mode | Reconciliation F-B-01 |
| FR-V2-209 | Daily-only Streak | Reconciliation F-C-01 |
| FR-V2-210 | Multi-Activity ALL requirement | Calculation §24 |
| FR-V2-211 | No Streak Leaderboard | Calculation §34; Recognition §16 |
| FR-V2-212 | Share to Group is explicit | Notifications baseline §§14-15 |

## 9. Validation Results

| Check | Result |
|---|---|
| All 11 source baselines represented | PASS |
| All reconciliation findings addressed | PASS |
| All 206 original FR IDs accounted for exactly once | PASS (0 missing) |
| No duplicate active FR IDs | PASS |
| No unresolved §31 item incorrectly left open | PASS (all 9 items settled or downstream) |
| No obsolete Highest Performance mode as active | PASS (only in superseded context) |
| No weekly Streak initial mode | PASS (only in superseded context) |
| No automatic cross-Challenge Activity reuse | PASS (only in "does not" / superseded context) |
| No comments/replies initial V2 | PASS (explicitly excluded) |
| No Home Feed | PASS (Home = dashboard, not Feed) |
| No Streak leaderboard | PASS (explicitly excluded) |
| No payment affecting performance | PASS (separation preserved) |
| ACT-03/ACT-04/MOT-01 not resolved | PASS (preserved as deferrals) |
| No Stage F completion claim | PASS |
| No implementation authorization | PASS |
| DRAFT marking present | PASS (10 refs T1, 37 refs T2) |

## 10. Remaining Stage F Deliverables

The Master Programme defines five Stage F deliverables:

| Deliverable | Status After This Task |
|---|---|
| 1. Functional Requirements | **DRAFT produced (T2)** — pending Founder review/approval |
| 2. Canonical Information Contract | **NOT STARTED** — Logical Model is input, not the contract |
| 3. Calculation & Derived Truth | **DRAFT produced (T1 Part M + Calculation Schedule)** — pending Founder review/approval |
| 4. Knowledge Runtime Contract | **NOT STARTED** — EKG-01 runtime expression required |
| 5. Technical Architecture Mapping | **NOT STARTED** — borders Stage G |

**Stage F is NOT complete.** T1 + T2 drafts satisfy part of Stage F. Three deliverables remain as separate Stage F work.

## 11. Latest Positions Confirmed

| Position | Confirmed in T1 | Confirmed in T2 |
|---|---|---|
| Challenge-specific Activity logging | Section G | FR-V2-207 |
| Race-to-target Competitive (no HP mode) | Section K | FR-V2-208 |
| Daily-only Streak | Section L | FR-V2-209 |
| Collective full crossing contribution | Section J | FR-V2-084/086 aligned |
| Home ≠ Feed | Section O | FR-V2-128 superseded |
| No comments/replies | Section Q | FR-V2-133 superseded |
| Recognition separation (Result ≠ Recognition ≠ Acknowledgement) | Section U | FR-V2-142/146/147 |
| Contribution/performance separation | Sections V-W | FR-V2-160/168 |

## 12. Exact Next Recommended Task

**Stage F Canonical Information Contract drafting.**

The Logical Product & Domain Model (baseline #7) provides the input entity/relationship structure, but the Canonical Information Contract is a distinct deliverable that defines the exact canonical information boundaries, field-level specifications, and information-flow contracts between domains. This is the next logical Stage F deliverable to address.

Alternatively, if the Founder prefers to review T1/T2 first before continuing Stage F work, the next task is **Founder review of T1 and T2 drafts**.

## 13. Branch, Head, and Push Status

| Item | Value |
|---|---|
| Branch | `docs/stage-f-t1-t2-consolidation-001` |
| Based on | `origin/main` @ `382cafc` |
| Worktree | `/private/tmp/tiizi-stagef-t1t2` |
| Commit | Pending (see git record section) |
| Push | Pending |

## 14. Confirmation

- No code was modified.
- No tests were modified.
- No Firestore rules were modified.
- No existing approved governance was modified.
- No source working baselines were modified (all 11 remain as untracked working evidence).
- Primary worktree was not touched.
- No force push. No merge. No PR merge. No self-approval.

---

**End of Consolidation Report**
