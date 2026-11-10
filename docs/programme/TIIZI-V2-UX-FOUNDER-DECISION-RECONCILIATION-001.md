# TIIZI-V2-UX-FOUNDER-DECISION-RECONCILIATION-001

**Status:** PROPOSED FOUNDER DECISION RECORD & IMPLEMENTATION BRIEFING  
**Authority:** Founder — 10 November 2026  
**Repository:** `Fkenogo/tiizi_challenges`  
**Execution:** Decision reconciliation and implementation briefing — **NO IMPLEMENTATION IN THIS PR**  
**Source Baseline:** `origin/main` `ae089c09f89f7acec77935a8d5bda93a6404ffce`  
**Companions:**
- [`TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md`](TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md)
- [`TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md`](../reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md)
- [`TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`](../product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md)
- [`TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`](TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md)

---

## Executive Summary & Founder Correction

The recent UX Continuity Audit (`V2-UX-CONTINUITY-AUDIT-001`) incorrectly treated activity sharing as indefinitely deferred and treated member age/gender collection as permanently excluded from the Tiizi platform.

On 10 November 2026, the Founder issued the following formal correction:
1. **Activity sharing was previously reviewed and accepted**, including UI layout corrections.
2. **Members must have options to share recorded activities to permitted feeds** (Challenge Feed / permitted Group context).
3. **Members must be able to copy a shareable link for use on external channels.**
4. **Age and gender are required capabilities of the Tiizi member profile and onboarding experience.**
5. **Profile photo selection must be offered during onboarding, remain strictly skippable, and remain editable through Profile.**

This document executes the required three-part reconciliation:
- **Task A — Recover Previous Decisions:** Complete historical audit of repository code, programme records, and commits.
- **Task B — Reconcile Product Authority:** Bounded Founder Decision record superseding conflicting older documentation while strictly preserving privacy, safety, and domain invariants.
- **Task C — Implementation Briefing (NO IMPLEMENTATION):** Actionable technical architecture, schema requirements, API contracts, frontend touchpoints, and security boundaries for subsequent work packages (Packages B and C).

---

# Task A — Recover Previous Decisions

A thorough audit of git commit history, legacy source trees, and programme records identifies the exact provenance of these capabilities:

### 1. Activity Sharing & External Sharing Provenance
- **Pre-Beta / V1 Precedent (`ShareTiiziCard`):** Commit [`930c7377826bb1cdc407747b4fc6b2e08eb8bf52`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/src/components/ShareTiiziCard.tsx) introduced `ShareTiiziCard.tsx`. It implemented standard native sharing via `navigator.share` (title, text, install URL) with automatic fallback to clipboard copy via `navigator.clipboard.writeText` and a 2-second visual feedback state (`Copied!` / `Link copied!`).
- **V2 Challenge Feed Product Truth (`CF-01` v0.2, 2026-10-10):** Documented in [`docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md). CF-01 established:
  - **S1 (Accepted participant activity):** Explicit share of accepted activity name, member's own accepted value, unit, and display name.
  - **S2 (Streak milestone):** Explicit share of member's own streak milestone (qualifying schedule pending).
  - **S3 (Race finish / personal result):** Explicit share of own member-level race outcome (excluding numeric position).
  - **Invariants:** Explicit action only; preview before publishing; self-only; default is unshared; withdrawable at any time; never auto-broadcasts routine logs; no member free-text captions.
- **FER-001 Baseline & Audit Drift:** In [`TIIZI-FER-001-A`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/programme/TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md) §3.5 and §5 (Q4), external social sharing was classified as "OPEN — separate decision; outside CPE." In the recent continuity audit, this was mistakenly interpreted as "activity sharing is deferred entirely." In reality, internal explicit sharing was *already accepted* in CF-01, and external Copy Link was a planned extension.

### 2. Age & Gender Collection Provenance
- **Pre-Beta / V1 Implementation:** Verified in commits [`930c737`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/src/features/Profile/EditProfileScreen.tsx) and [`16e633b`]:
  - `EditProfileScreen.tsx` and `ProfileCompletionScreen.tsx` actively collected:
    - **Birthday:** `birthday: string` (YYYY-MM-DD), with associated privacy toggle `showBirthdayToFriends: boolean` (default: true).
    - **Gender:** Governed pill options: `['Female', 'Male', 'Non-binary', 'Prefer not to say', 'Self describe']`, with conditional free-text input for `genderSelfDescribe`.
- **V2 Early Governance & Data Minimization:** In [`TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/programme/TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md) and [`TIIZI-MC-2-PROFILE-FOUNDATION-READINESS-001.md`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/programme/TIIZI-MC-2-PROFILE-FOUNDATION-READINESS-001.md), under strict interpretation of IDP-01 (minimal disclosure), birthday and gender were categorized as non-essential attributes and excluded from `members` table schema. In `TIIZI-FER-001-A` §FDR-01, consequence (c) stated "no health, body, birth or contact fields added to account creation."
- **18+ Adult Eligibility:** In [`TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md) §16.5 item 2, the Founder affirmed Tiizi as an adult-only (18+) community. However, FD-PILOT-01 reduced this to an unrecorded/self-declared checkbox without formal age capture. The audit incorrectly treated this as a permanent exclusion of age data rather than a phased pilot concession.

### 3. Profile Photo Selection Provenance
- **Pre-Beta / V1 Implementation:** `ProfileCompletionScreen.tsx` and `EditProfileScreen.tsx` supported photo selection via local image file picker, rendering instant preview with upload to storage.
- **V2 Experience Recovery Baseline:** In [`TIIZI-FER-001-A`](file:///Volumes/PRODUCTION/Projects/tiizi_revamp/.worktrees/v2-ux-recovery-a-001/docs/programme/TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md) §FDR-03, the Founder confirmed: optional Profile image (onboarding or Profile), optional Group cover, optional Challenge cover; gradients/initials remain default and fallback; no member is forced to upload.
- **Audit Defect:** The audit noted that current `V2ProfileScreen.tsx` and onboarding flows displayed avatar initials only, assuming media upload was canceled. It was not canceled; it was sequenced into shared media capability P6.

---

# Task B — Reconcile Product Authority

This section constitutes the binding Founder Decision record establishing current product authority.

## 1. Supersession Register

| Older Position / Document | Conflict | Reconciled Founder Decision (Effective Immediately) |
|---|---|---|
| `TIIZI-FER-001-A` §3.5 bullet 5 & §5 Q4 ("External social sharing is outside CPE") | Treated external share / Copy Link as open/deferred. | **SUPERSEDED.** Activity sharing is restored for CPE. Upon logging an activity, members receive an immediate confirmation with dual sharing controls: (1) **Share to Feed** (permitted Challenge/Group feed), and (2) **Copy Link** (external sharing via Web Share API or clipboard URL). |
| `TIIZI-FER-001-A` §FDR-01 consequence (c) ("no health, body, birth or contact fields") & `TIIZI-MC-2` | Excluded age/birth and gender from member profile and onboarding. | **SUPERSEDED IN PART.** Age (or date of birth confirming 18+ eligibility) and Gender (governed inclusive categories) are **REQUIRED** profile attributes and **must be collected during onboarding** (or profile completion for returning members). |
| `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001` §16.5 item 2 (self-declaration checkbox only) | Relied purely on a checkbox without collecting member age. | **AMENDED.** Member age (or date of birth) must be captured to validate 18+ adult eligibility at registration/onboarding. Stored securely under member privacy protection. |
| Audit Report finding on Profile Photo (treated as deferred) | Assumed avatar initials are permanent for V2 pilot. | **RECONFIRMED (FDR-03).** Profile photo selection is offered during onboarding, is strictly skippable, and is editable/clearable anytime in Profile. Gradients/initials remain the fallback default. |

## 2. Distinction of Product Capabilities & Feed Invariants

To eliminate past ambiguities, the platform enforces strict conceptual boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACTIVITY LOGGING CONVERGENCE                          │
│                                                                             │
│  [Member Logs Activity] ──> [Server Validates & Accepts Activity Record]    │
│                                           │                                 │
│                                           ▼                                 │
│                   [Immediate Logging Confirmation Modal]                    │
│                                   │                                         │
│         ┌─────────────────────────┴─────────────────────────┐               │
│         ▼                                                   ▼               │
│  [Share to Feed]                                     [Copy Link / Share]    │
│  (Member-controlled, internal)                       (External channel)     │
│  - Permitted Challenge Feed                          - Web Share API        │
│  - Never automatic / default off                     - Clipboard fallback   │
│  - Canonical CF-01 S1 card                           - Deep link to preview │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Member-Controlled Sharing vs Automatic Platform Events:**
   - **Automatic Platform Events (A1–A6):** Server-generated, actor-free (or display-name only) structural transitions (e.g., Challenge started, goal milestone reached, results ready). Handled by server outbox/workers.
   - **Member-Controlled Sharing (S1–S3):** Requires explicit member intent. Default is ALWAYS unshared. Logging an activity NEVER automatically publishes a feed item or broadcasts to other members.
   - **Post-Logging Share Modal:** Displays upon successful activity acceptance:
     - Prominent success feedback (reps/metric recorded, points earned, streak increment).
     - Explicit button: **Share to Challenge Feed** (creates S1 event with preview).
     - Explicit button: **Copy Link / Share External** (copies verified challenge/activity link).
     - Dismiss / Continue button (returns to Challenge/Today without sharing).
2. **Privacy, Visibility & Access-Control Boundaries:**
   - **Private Groups / Private Challenges:** External share links to private challenges or private group activities MUST NOT expose private data. Unauthenticated or non-member viewers hitting an external link see only a generic invitation/landing card ("Join [Challenge Name] on Tiizi") and are required to sign in and request to join the Group.
   - **Internal Feed Target:** A member can only share an activity to the specific Challenge Feed in which the activity was recorded, and only if they maintain active participation.
3. **Age & Gender Privacy Rules:**
   - **Age / Date of Birth:** Used strictly for: (1) 18+ eligibility verification, and (2) aggregate demographic reporting / age-group ranking (if authorized in future). It is **PRIVATE BY DEFAULT**; exact birth date is NEVER displayed to other members or exposed via public API.
   - **Gender:** Inclusive governed list: `Female`, `Male`, `Non-binary`, `Prefer not to say`, `Self describe` (with optional description). Private by default; members may choose whether to display gender on their profile.
   - **Non-Discrimination:** Age and gender NEVER restrict challenge discovery, joining, activity logging, or scoring.

---

# Task C — Implementation Briefing (NO IMPLEMENTATION IN THIS PR)

This briefing provides the technical blueprints for subsequent implementation packages (Packages B and C). **No code changes or migrations from this section are authorized or implemented in this PR.**

## 1. Post-Logging Confirmation & Sharing Specification (Package B)

### 1.1 UI / UX Workflow
1. When `V2LoggingSection.tsx` receives `acceptanceStatus: "accepted"` from `POST /api/challenges/:id/activities`:
   - Instead of merely resetting form fields, mount the accessible `V2LoggingConfirmationModal`.
   - Card displays:
     - Activity icon, activity name, logged quantity + unit (e.g., "50 Reps").
     - Earned challenge contribution and updated streak status.
     - Action 1: `Share to Feed` button. Opens preview drawer confirming what will appear (actor display name, activity name, quantity, unit; no GPS, no raw notes, no timestamps).
     - Action 2: `Share / Copy Link` button. Triggers `navigator.share({ title, text, url })` on supported mobile devices; falls back to `navigator.clipboard.writeText(url)` on desktop, displaying "Link copied to clipboard!" toast.
     - Action 3: `Done` button to dismiss.

### 1.2 Feed Publishing Contract (`POST /api/challenges/:id/feed/shares`)
- **Payload:**
  ```json
  {
    "activityRecordId": "uuid",
    "target": "challenge_feed",
    "idempotencyKey": "uuid"
  }
  ```
- **Validation:**
  - Authenticated user must be the owner of `activityRecordId`.
  - Activity record must belong to `challengeId` and have `acceptance_status = 'accepted'`.
  - Viewer must satisfy the active Feed Audience Predicate (current group member + challenge participant).
  - Enforces CF-01 limit: exactly one active Share per member per accepted activity.
  - Return: 201 Created with the created `challenge_feed_events` projection.

---

## 2. Member Profile & Onboarding Specification (Package C)

### 2.1 Database Schema Evolution (New Migration: `028_member_demographics_and_media.sql`)
```sql
-- Evolutionary additions to members table
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS birth_date DATE NULL,
  ADD COLUMN IF NOT EXISTS age_declared_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS gender_custom VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS gender_visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(16) NOT NULL DEFAULT 'initials';

-- Guard: 18+ eligibility constraint on birth_date
ALTER TABLE members
  ADD CONSTRAINT check_member_adult_eligibility
  CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE - INTERVAL '18 years');

-- Guard: Governed gender options
ALTER TABLE members
  ADD CONSTRAINT check_member_gender_values
  CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say', 'self_describe'));

-- Guard: Gender visibility values
ALTER TABLE members
  ADD CONSTRAINT check_member_gender_visibility
  CHECK (gender_visibility IN ('private', 'group', 'public'));
```

### 2.2 Onboarding Journey Flow
The onboarding sequence is structured into clean, bite-sized steps:
1. **Welcome Slides (1–4):** Public static welcome (existing).
2. **Registration / Auth:** Firebase Auth (Email/Google) + display name handoff (existing).
3. **Step 1 — Adult Eligibility & Demographics (NEW):**
   - Date of Birth / Age entry with real-time 18+ validation.
   - Gender selector (Female, Male, Non-binary, Prefer not to say, Self describe).
   - Clear privacy note: *"Your age and gender are private and never shared without your permission."*
4. **Step 2 — Profile Photo (NEW, Skippable):**
   - Drag-and-drop / file selector for avatar image.
   - Clear circular crop preview.
   - Big accessible `Skip for now` button (defaults to initials avatar).
5. **Step 3 — Interests & Goals (FDR-01, Skippable):**
   - 0–5 Interests, 0–3 Goals (existing).
6. **Step 4 — Legal & Terms Acknowledgement:**
   - 18+ confirmation and versioned Terms/Privacy acknowledgement (existing).

### 2.3 Profile Management (`V2ProfileScreen.tsx`)
- Members can view and edit:
  - Display name.
  - Age / Date of Birth (with 18+ validation).
  - Gender and custom gender description.
  - Gender visibility toggle (Private vs Group).
  - Profile Photo: upload new, replace, or remove (reverting to initials avatar).

---

## 3. Dependency, Security & Invariant Matrix

| Requirement | Implementation Target | Security / Governance Boundary |
|---|---|---|
| **Activity Sharing** | Package B (`V2LoggingConfirmationModal.tsx`, `api/src/challengeFeed.ts`) | Strict CF-01 compliance: self-only, accepted activity only, withdrawable, no auto-sharing. |
| **External Link Sharing** | Package B (`ShareTiiziCard.tsx`, Web Share API, clipboard fallback) | Zero information leakage: links resolve to canonical challenge URL with metadata; private entities remain gated behind auth & membership. |
| **Age / DOB Collection** | Package C (Migration 028, `V2OnboardingDemographics.tsx`) | 18+ constraint checked at API and DB level. Private by default; never serialized in public member identity projections. |
| **Gender Collection** | Package C (Migration 028, `V2OnboardingDemographics.tsx`, `V2ProfileScreen.tsx`) | Governed vocabulary; optional self-describe field; private by default; no algorithmic discrimination. |
| **Profile Photo** | Package C / Shared Media P6 (`ObjectStore` port, Cloudflare R2 / local preview) | Strictly skippable onboarding step; initials fallback preserved; strict image MIME/size validation. |

---

## 4. Programme Alignment & Sign-Off

This document formalizes the Founder's correction and prepares the technical groundwork for Packages B and C.

**Execution Rule:**
- **No implementation of Packages B or C in this PR.**
- Package A-001 (catalogue population, timestamp precision, friendly errors) is delivered independently.
- On Founder and Technical Lead approval of this record, Package B (Post-Logging Sharing) and Package C (Demographics & Photo Onboarding) will be sequenced and implemented under separate work packages.
