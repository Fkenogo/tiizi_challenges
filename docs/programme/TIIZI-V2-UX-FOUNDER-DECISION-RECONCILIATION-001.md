# TIIZI-V2-UX-FOUNDER-DECISION-RECONCILIATION-001

**Document Type:** Founder Decision Record & Implementation Briefing  
**Status:** PROPOSED — FOR TECHNICAL LEAD AND FOUNDER REVIEW  
**Authority:** Founder Direction — 10 November 2026  
**Repository:** `Fkenogo/tiizi_challenges`  
**Scope:** Decision reconciliation and implementation briefing — **NO IMPLEMENTATION IN THIS PR**  
**Source Baseline:** `origin/main` `ae089c09f89f7acec77935a8d5bda93a6404ffce`  
**Companions:**
- [`TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md`](TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md)
- [`TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md`](../reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md)
- [`TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`](../product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md)
- [`TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`](TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md)

---

## 1. Executive Summary & Purpose

The recent UX Continuity Audit (`V2-UX-CONTINUITY-AUDIT-001`) incorrectly treated activity sharing as indefinitely deferred and treated member age/gender collection as permanently excluded from the Tiizi platform.

On 10 November 2026, the Founder clarified the product direction:
1. **Activity sharing was previously reviewed and accepted**, including UI layout corrections.
2. **Members must have options to explicitly share recorded activities to the Challenge Feed** (Group Feed is reserved for approved automatic lifecycle events and collective milestones; members do not publish individual logs to Group Feed).
3. **Members must be able to copy a shareable link for use on external channels.**
4. **Age and gender are required capabilities of the Tiizi member profile and onboarding experience.**
5. **Profile photo selection must be offered during onboarding, remain strictly skippable, and remain editable through Profile.**

This document provides a three-part reconciliation:
- **Part I — Recorded Founder Direction vs. Approved Baseline:** Reconciles the historical decisions and confirms product direction while strictly preserving approved invariants.
- **Part II — Authority & Invariant Register:** Clearly separates confirmed product direction, existing approved behavior, and unapproved implementation proposals.
- **Part III — Implementation Briefing (Proposals for Packages B & C):** Technical architecture and security specifications proposed for subsequent work packages (**none of which are implemented in PR #168**).

---

# Part I — Historical Provenance & Baseline Recovery

A thorough audit of git history, legacy code, and programme governance establishes the exact provenance of these capabilities:

### 1. Activity Sharing & External Copy Link
- **Pre-Beta / V1 Implementation:** In commit `930c7377826bb1cdc407747b4fc6b2e08eb8bf52`, `src/components/ShareTiiziCard.tsx` was introduced. It implemented standard native sharing via `navigator.share` (title, text, install URL) with fallback to clipboard copy via `navigator.clipboard.writeText` and a 2-second visual feedback state (`Copied!` / `Link copied!`).
- **V2 Challenge Feed Product Truth (`CF-01` v0.2, 2026-10-10):** Documented in [`docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`](../product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md). CF-01 established:
  - **S1 (Accepted participant activity):** Explicit share of accepted activity name, member's own accepted value, unit, and display name.
  - **S2 (Streak milestone):** Explicit share of member's own streak milestone (qualifying schedule pending).
  - **S3 (Race finish / personal result):** Explicit share of own member-level race outcome (excluding numeric position).
  - **Invariants:** Explicit member action only; preview before publishing; self-only; default is unshared; withdrawable at any time; never auto-broadcasts routine logs; no member free-text captions.
- **Audit Clarification:** External social sharing was previously classified in `TIIZI-FER-001-A` §5 Q4 as an open item outside CPE. The Founder confirms that internal explicit sharing and an external Copy Link must both be provided as post-logging options.

### 2. Age & Gender Collection
- **Pre-Beta / V1 Implementation:** Verified in commit `930c737`:
  - `src/features/Profile/EditProfileScreen.tsx` and `ProfileCompletionScreen.tsx` collected:
    - **Birthday:** `birthday: string` (YYYY-MM-DD), with associated privacy toggle `showBirthdayToFriends: boolean` (default: true).
    - **Gender:** Governed options: `['Female', 'Male', 'Non-binary', 'Prefer not to say', 'Self describe']`, with conditional free-text input for `genderSelfDescribe`.
- **V2 Early Governance:** In `TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md` and `TIIZI-MC-2-PROFILE-FOUNDATION-READINESS-001.md`, under strict data minimization (IDP-01), birthday and gender were excluded from initial V2 member persistence, and FD-PILOT-01 §16.5 reduced 18+ verification to an unrecorded self-declaration checkbox.
- **Founder Correction:** Age and gender are required capabilities of the Tiizi profile and onboarding experience.

### 3. Profile Photo Selection
- **Pre-Beta / V1 Implementation:** `ProfileCompletionScreen.tsx` and `EditProfileScreen.tsx` supported photo selection via local file picker with instant preview and upload.
- **V2 Baseline:** `TIIZI-FER-001-A` §FDR-03 confirmed optional Profile image upload, with gradients/initials remaining the default and fallback. The Founder reconfirms that photo selection must be offered during onboarding, remain strictly skippable, and remain editable through Profile.

---

# Part II — Authority & Invariant Register

To eliminate ambiguity, this register formally distinguishes:
1. **Confirmed Founder Product Direction** (binding direction from the Founder).
2. **Existing Approved Behaviour** (preserved baseline invariants).
3. **Implementation Proposals** (unapproved technical details awaiting Founder sign-off).

## 1. Tripartite Authority Classification

| Capability Area | Confirmed Founder Product Direction | Existing Approved Behaviour (Preserved) | Implementation Proposals (Awaiting Founder Decision) |
|---|---|---|---|
| **Activity Sharing** | Post-activity logging must offer options to explicitly share to the Challenge Feed AND copy a shareable link for external channels. Group Feed is reserved for approved automatic lifecycle events and collective milestones; members never publish individual activity logs to Group Feed. | **CF-01 v0.2 & GF-01 Invariants:** Explicit member action only; default is unshared; self-only; withdrawable; logging NEVER auto-publishes. Private entity boundaries strictly enforced. | UI wireframes for `V2LoggingConfirmationModal`; exact payload for `POST /api/challenges/:id/feed/shares`; external landing card presentation. |
| **Interests & Goals** | Preferences personalize discovery and recommendations; they never restrict general browsing, challenge participation, or scoring. | **Onboarding Requirement:** Members must select **at least one Interest (1–5)** and **at least one Goal (1–3)** during onboarding. This requirement is **PRESERVED** and is **NOT optional**. | Future revision to optional/skippable selection remains an unapproved proposal and would require an explicit separate decision. |
| **Age & Adult Eligibility** | Age is a required capability of the member profile and onboarding. Tiizi is an adult (18+) community. | **Adult Community Invariant:** Minimum age is 18. Exact birth date is **confidential and private by default**; it is NEVER displayed or exposed over public/shared APIs. | Specific capture format (exact Date of Birth vs. birth year vs. age integer); durable database audit schema vs. API-layer validation. |
| **Gender** | Gender is a required capability of the member profile and onboarding. Governed inclusive options must be provided. | **Privacy Invariant:** Gender is **private by default**. No public gender visibility is authorized. Gender never affects challenge eligibility or scoring. | Gender input policy (whether selecting a gender option is mandatory or skippable during onboarding); visibility toggle (private vs. group-only). |
| **Profile Photo** | Profile photo selection must be offered during onboarding, remain strictly skippable, and remain editable via Profile. | **Fallback Invariant:** Neutral initials/gradient avatars remain the platform default and fallback. No member is forced to upload a photo. | Shared media service configuration (Cloudflare R2 port, client image compression, maximum upload dimensions). |

## 2. Privacy & Access-Control Boundaries

1. **Private Groups & Private Challenges:**
   - External share links (via Copy Link or Web Share API) must NEVER leak private data.
   - For private Groups or private Challenges, an unauthorized or unauthenticated viewer opening a share link receives only a generic, safe landing card (e.g., *"You've been invited to a private challenge on Tiizi — Sign in or request to join the host Group to view details"*).
   - Protected titles, group descriptions, member rosters, participation details, activity records, and feed items MUST NOT be exposed in unauthenticated API responses or Open Graph metadata tags.
2. **Feed Scoping & Ownership (GF-01 & CF-01 Boundaries):**
   - **Group Feed:** Reserved exclusively for approved automatic Group and Challenge lifecycle events and collective milestones (GF-01). Members do not publish individual activity logs to the Group Feed.
   - **Challenge Feed:** Individual activity sharing belongs exclusively to the Challenge Feed where the activity was recorded (CF-01 S1) and strictly requires explicit member action.
   - **External Sharing:** Copy Link and native device sharing remain a separate member-controlled option.
   - **No Auto-Publishing:** Logging an activity never automatically publishes or broadcasts individual activity to any feed or external channel.
3. **Confidentiality of Personal Attributes:**
   - Exact birth dates are strictly confidential and private by default. They are never rendered on public profile cards, leaderboards, or feed items.
   - Gender is private by default; public exposure of gender is prohibited.

## 3. Strict Distinction of Sharing Mechanisms

The platform enforces three strictly separated sharing mechanisms. None of them may ever imply or introduce automatic broadcast of member activity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOGGING & SHARING BOUNDARIES                       │
│                                                                             │
│  [Member Logs Activity] ──> [Server Validates & Records Activity]           │
│                                           │                                 │
│                                           ▼                                 │
│                   [Immediate Logging Confirmation Modal]                    │
│                                   │                                         │
│         ┌─────────────────────────┴─────────────────────────┐               │
│         ▼                                                   ▼               │
│  [Share to Feed (Internal)]                          [Copy Link / Share]    │
│  - Member-initiated explicit action                  - Member-initiated     │
│  - Target: permitted Challenge Feed                  - Target: device/apps  │
│  - Default is OFF / unshared                         - External channels    │
│  - Strict CF-01 S1 template                          - Gated safe preview   │
│                                                                             │
│  ─── SEPARATE SYSTEM SURFACE: Automatic Platform Events (A1–A6) ──────────  │
│  - Emitted by server outbox/workers upon lifecycle transitions              │
│  - Actor-free (or display-name only) structural announcements               │
│  - NEVER broadcasts personal activity records or logs                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Part III — Implementation Briefing (Proposals for Packages B & C)

**Notice:** The following specifications are proposals for subsequent work packages. **No changes from this section are implemented, tested, or merged in PR #168.**

## 1. Post-Logging Confirmation & Sharing Specification (Package B Proposal)

### 1.1 UI / UX Flow
Upon receiving an HTTP 201 acceptance response from `POST /api/challenges/:id/activities`:
1. Form resets and displays the `V2LoggingConfirmationModal`.
2. Modal presents:
   - Success badge with recorded metric quantity and unit (e.g., "20 Reps").
   - Attainment progress and points earned (e.g., "100 Points").
   - **Share to Challenge Feed:** Triggers preview drawer displaying the governed S1 card (display name, activity name, quantity, unit; no GPS, no raw notes, no timestamp).
   - **Copy Link / Share External:** Triggers `navigator.share()` on mobile devices with fallback to `navigator.clipboard.writeText()` on desktop.
   - **Done:** Closes modal and returns to Challenge view.

### 1.2 Feed Publishing Contract Proposal (`POST /api/challenges/:id/feed/shares`)
- **Payload:**
  ```json
  {
    "activityRecordId": "uuid",
    "target": "challenge_feed",
    "idempotencyKey": "uuid"
  }
  ```
- **Validation Rules:**
  - Authenticated user must be the recorded owner of `activityRecordId`.
  - Activity record must belong to `challengeId` and carry `acceptance_status = 'accepted'`.
  - Viewer must satisfy the Feed Audience Predicate (current group member + active participant).
  - Enforces CF-01 constraint: at most one active Share per member per accepted activity record.

---

## 2. Member Profile & Onboarding Specification (Package C Proposal)

### 2.1 Durable Age-Eligibility Architecture
The previous draft suggested a database CHECK constraint: `CHECK (birth_date <= CURRENT_DATE - INTERVAL '18 years')`.
**Technical Correction:** In PostgreSQL, table `CHECK` constraints cannot reference non-immutable functions or volatile values such as `CURRENT_DATE`. Furthermore, age changes over time, meaning eligibility must be enforced durably at the point of registration.

**Proposed Architecture for Durable Enforcement:**
1. **API / Domain Validation:** When receiving birth date / age during onboarding, validate against the server wall clock:
   $$\text{Age} = \text{Date}(\text{server\_now}) - \text{Date}(\text{birth\_date}) \ge 18\text{ years}$$
2. **Immutable Audit Timestamp:** Store `age_verified_at TIMESTAMPTZ NOT NULL DEFAULT now()` when the member validates eligibility.
3. **Database Constraint:** Apply static validity bounds (e.g., `CHECK (birth_date >= '1900-01-01' AND birth_date <= CURRENT_DATE_AT_MIGRATION)`) without volatile arithmetic.

### 2.2 Unresolved Implementation Choices Awaiting Founder Decision
Before Package C is implemented, the Founder must explicitly decide:
1. **Age Capture Format:** Exact Date of Birth (YYYY-MM-DD) vs. Birth Year (YYYY) vs. Age integer.
2. **Gender Input Requirement:** Whether selecting a gender option is mandatory at onboarding (with "Prefer not to say" available) or whether the step is skippable.
3. **Gender Profile Visibility:** Whether gender is strictly internal/private or whether members may toggle visibility to group members.

### 2.3 Proposed Schema Draft (Awaiting Approval)
```sql
-- PROPOSAL ONLY: Do NOT apply in PR #168
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS birth_date DATE NULL,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS gender_custom VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS gender_visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(16) NOT NULL DEFAULT 'initials';
```

---

## 3. Programme Sequencing & Hold

- **Package A-001:** Completed, tested, verified on Founder Preview, and submitted in PR #168.
- **Packages B & C:** Deferred to future work packages. No code, schema migrations, or tests for Packages B and C are included in this PR.
- **Next Step:** Stop for Technical Lead and Founder review.
