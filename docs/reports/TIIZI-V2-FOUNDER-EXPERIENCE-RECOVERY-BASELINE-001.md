# TIIZI — V2 Founder Experience Recovery Baseline 001

**Prepared:** 28 October 2026  
**Status:** Founder-reviewed experience consolidation; **engineering reconciliation and formal programme recording pending**. This is not a deployment, migration, merge or pilot launch authorization.  
**Coordination:** Founder works directly with Tiizi Technical Lead; FEF-TLC-001 team roles support implementation and review.  
**Repository baseline for reconciliation:** `Fkenogo/tiizi_challenges`, last verified `main` `542052c12ca7910a297da89f28ae01120b220980`; Master Programme v2.80. Refresh before work. PR #107 is a separate unmerged candidate at last verified head `9e5477b008b2d5f0f759acf5770de9486f66e6e6`.

## A. Non-negotiable delivery approach

- Product experience is Founder-led. Historic package acceptance does not automatically constitute current integrated-journey acceptance.
- Preserve functioning V2 Group/Challenge engines, APIs, authentication and logging sheet. Do not reuse archived V1 implementation or create a second data authority.
- Audit and correct the *integrated* experience page by page; demonstrate on mobile with coherent disposable data; record a precise Founder acceptance outcome for each page.
- One Master Programme remains authoritative for sequence/status. Maintain one lightweight traceable findings-and-acceptance register derived from it (not a competing roadmap).
- Every feature must be marked: preserve/verified, correction required, implementation missing, deferred by applicable decision, or needs Founder decision. No blanket “complete” from CI alone.
- This baseline communicates reviewed product direction; reconcile conflicts with older decisions in one bounded Founder disposition before coding affected changes. Unresolved items are not silently approved.

## B. Founder-reviewed page baseline

### 1. Welcome, registration and first entry

**Welcome:** Four concise, swipeable, skippable slides preceding registration: (1) Tiizi is a voluntary group fitness/wellness accountability platform; (2) join or create Groups; (3) Together, Race and Streak Challenges explained in plain language; (4) log activities, track progress, encourage one another. Avoid tying app features to migration from WhatsApp: the initial cohort is simply early users.

**Registration:** display name, email/password or Google sign-in, essential eligibility/legal acknowledgements as applicable; no long personal questionnaire in account creation.

**Personalization:** Interests selectable 0–5; Goals selectable 0–3. Each step independently **skippable**, and both may be edited/cleared later in Profile. Explain recommendation benefits without making them eligibility gates. Do not collect unnecessary health/body/birth/contact fields. This explicitly conflicts with the previous mandatory no-skip Member Completion rule and must be reconciled.

**Discovery:** Groups + Challenges tabs immediately after optional personalization. Suggestions prioritize current Interests/Goals within the existing discoverable/authorized set; always offer general browsing even if preferences are absent or no match is found. Neither membership nor participation is automatic. A selected Challenge hosted by a Group the member has not joined guides them through the Group's actual join/approval process and then back to the chosen Challenge's separate Join action. Standard invite-code entry is available but not WhatsApp-specific. A member can always continue to Today.

**Onboarding media:** Optional profile-image upload or skip; initials/default avatar if absent. Profile photo may be added later. Shared media implementation remains outstanding.

### 2. Today

**Agreed:** Challenge-first, personal greeting, **Your Ongoing Challenges**. When a Streak Challenge has an outstanding daily requirement, show a compact reminder immediately below greeting; place pending Streak cards first. After completion show acknowledgement rather than a repeated prompt. If several Streaks are due, compactly summarize and provide navigation. All due/completed/missed states come from the canonical Streak engine—never invented by UI. Challenge cards present different engine truths: Together = shared progress; Race = own result/valid ranking; Streak = current streak and today status. Retain quick access to Group, community activity, discoverable opportunities, and useful differentiated empty states for no Group / Group but no Challenge / participating member.

**Logging:** Preserve existing same-screen Log Activity bottom sheet. Link from Today with correct Challenge context; confirm submission and authoritative refresh; do not double submit. Existing activity/unit/date handling is the starting point. Avoid another logging engine or form.

### 3. Groups and Group creation

**Preserve:** My Groups / Discover tabs, search, existing Group Home, Join/approval and Steward controls, and the five-step wizard. Avoid a rebuild.

**Group Details:** Enrich with Group's actual purpose/description, establishment date, member count, original creator (distinct from current Steward), Group Interests, Group Goals, selected culture/rules, joining/discoverability, and permissions. Do not fabricate unknown values. Constrain About Group sheet to mobile width/height; inner vertical scroll and reachable close control.

**Cover:** Optional real Group image upload; gradients remain default/fallback. Steward-authorized media via shared media capability.

**Wizard:** (1) Identity accepted. (2) Preserve cover/location and simplify member-facing Focus Areas to **Group Interests**; retain Group Goals as distinct desired outcomes. Existing governed Focus Area concepts/IDs and custom descriptive handling remain technical authority pending reconciliation—do **not** remove canonical fields merely because wording overlaps. Group Settings must use same selectable vocabulary rather than a free-text-only field. (3) How Group Works accepted—preserve configurable discoverability, joining and Challenge-host permission. (4) Our Culture: retain positive norms, optionally add “what we avoid” choices plus bounded creator-defined expectation; never create automatic sanctions. (5) Review/Create accepted, with minor UI polish and cover preview. Store/display establishment timestamp and creator using existing canonical fields if present, without adding redundant ones.

**Member identity:** replace generic “Tiizi member” labels with display names only in authorized Group/Challenge contexts, using approved MC-4 read projections. Review join-request and roster refresh defects.

### 4. Challenges and Challenge creation

**Preserve:** Challenges search, status/type/domain filters, listing cards, Challenge detail's domain projections and logging sheet. On Challenge Detail, show a short excerpt of long description with **Read more/less**; place Log Activity and Leave Challenge actions beneath the description rather than crowded alongside it. Add genuine cover image later; gradients remain fallback.

**Challenge Feed:** Existing CF-01 v0.2 approval is the authority; it is **not yet the Group Feed**. Separate Challenge-local automatic moments, opt-in member activity/result shares, one Kudos reaction, Steward/authorized-admin announcements. **No comments/replies initially.** Logging never auto-shares an individual's activity. External system share via native device/Copy Link is a proposed additional experience and needs exact visibility/preview rules and Founder disposition before coding; it is not the same as internal explicit Share. Streak milestone thresholds and limited administration authority have outstanding details.

**Seven-step wizard:** (1) Challenge type accepted; UI polish later. (2) Hosting Group accepted: on search focus show eligible hosting Groups, refine as text entered; joining a Group does not alone grant challenge-hosting authority. (3) Rename “Challenge Details” to **Name & Appearance**; title, description, optional cover photo with gradient fallback, distinguish Support a Cause from Support Tiizi, neither implies live payment execution. (4) Activity selection: **critical bug** opening/selecting from Activity Guide must return to same step with selected Activity and all draft wizard state intact. Existing disposable preview exposes 2 Activities despite recorded **118 published/eligible development Activities (84 Fitness, 34 Wellness)**; verify fixture publication, API eligibility, and actual library; do not modify canonical Activity definitions or assume engine is broken. (5) What Counts accepted; label repetitions as **reps** in member UI, not changing canonical metric units. (6) Duration/date presets/custom accepted. (7) Review/Edit/Create and separate “join this Challenge” choice accepted. Wider responsive UI alignment is a later polish slice.

### 5. Profile — a full member destination

**Founder selected personal-first structure:** Identity/photo → editable Interests & Goals → prominent Support Tiizi → My Tiizi Journey (Groups, ongoing/history Challenges and *only valid* engine-issued recognition) → Account/Preferences → Help & Guide.

Tapping avatar should open full **My Profile page**, not a bottom sheet containing disconnected Profile, Activity Guide, Support and How Tiizi Works destinations. Retain small sheets for narrow edits and quick actions. Reuse implemented name/email and Group/Challenge summary contracts. Email remains self-visible. Interests/Goals editable/clearable anytime and may update relevance ranking without removing browsing access. Optional photo upload during onboarding and via Profile; initials/neutral avatar otherwise. Avoid promising notification preferences, recognition or account actions that are not actually implemented; label missing capabilities in plan and implement appropriately.

### 6. Support Tiizi

**Permanent prominent Profile journey, distinct from Challenge-level “Support a Cause”.** Tiizi remains free and participation/results never depend on contributing.

**Interim voluntary manual mobile money:** Suggested **KES 500 / 1,000 / 2,000 / 5,000 / Custom**. Frequency intention **just once / occasionally (whenever able) / monthly / annually**. No automatic charging, pledges or subscriptions; no need to persist the intention initially. Present verified Kenyan recipient number, the registered account holder's exact name and transparent explanation that recipient is Founder/operator collecting on behalf of Tiizi. Copy recipient number and clear payment instructions when activated. Show separate official WhatsApp support contact for questions (support channel, not onboarding dependency). Do not assert successful payment or funds received without reconciliation. Member keeps their mobile-money proof; provide accessible support guidance. No fabricated totals, progress meters or payment receipt.

**Development-only:** Use explicit non-payable placeholders for mobile money recipient, account name and WhatsApp contact; no invented realistic phone numbers, no active copy/payment/WhatsApp actions. Founder will provide/confirm Kenyan recipient number and registered account name before pilot. A real manual payment launch additionally needs recipient disclosure, funds-handling/reconciliation and applicable legal/privacy approval. The Founder is currently designated recipient/operator; exact account identity not yet confirmed.

**Future:** Paystack is under consideration, not selected/connected. Reuse amount-selection UX when gateway is integrated. Frequency selection does **not** represent a Paystack recurring subscription. Confirm Kenya merchant eligibility, payment methods, checkout/settlement, transaction reconciliation and supported recurring behaviour before any promise.

## C. Separate confirmed working product vs remaining gaps

**Preserve with limited UI polish:** Group listing/Home, five-step Group wizard, basic hosting/member rule choices, Challenge listing/search/filters, seven-step Challenge wizard's overall structure, duration and review, canonical engines, present Log Activity sheet, Today projection foundations.

**Must verify/correct:** Activity Guide wizard state restoration, 118 Activity catalogue in working preview, member name projection, Group Details sheet overflow/content, Challenge description/actions layout, Group Settings interest selector, incomplete onboarding/Profile, new recommendation consumer, missing Profile/Group/Challenge image upload, Challenge Feed, Support Tiizi real manual contribution configuration, outstanding legal/eligibility/account controls, responsive alignment and functional end-to-end tests.

**No broad legacy restart:** enforce V2 `/v2/*` shell, `/api/*` and PostgreSQL domain authority, Firebase Auth identity only; preserve and strengthen existing automated boundary guard; archived V1 is reference-only.

## D. Authority conflicts and targeted reconciliations needed

1. Member Completion FD-MC-04/04a **mandatory no-skip** Interests/Goals is superseded in Founder product direction by **optional, independently skippable, editable/clearable** Interests (0–5) and Goals (0–3); record formal amendment before implementation. Previous FD-PILOT-01 deferral of Interests/Goals and REC-1 must be reconciled with the Founder-approved pilot experience. Preserve approved 12 Focus Area / 9 Group Goal concept baseline unless separately changed; mint required stable IDs.
2. FD-PILOT-01 deferred media, while earlier FD-MC-07 described media as pre-pilot. Founder now requests optional profile, Group and Challenge image upload. Reconcile sequencing once, then deliver shared media with authorized visibility/ownership; R2 is selected provider direction, not proof of live upload.
3. FD-PILOT-01 disables live payments and Challenge support. Founder now wants manual mobile-money **Support Tiizi** journey initially, with no actual recipient details yet; this is distinct from payments integration and from beneficiary Cause. Record specific operational/payment approval and keep execution off until verified.
4. CF-01 Challenge Feed was authorized in principle, but earlier limited-pilot scope deferred it. Founder now reiterates Challenge Feed, Kudos, positive Share and no comments. Reconcile scope with approved exact event allow-list and separately decide any external share behaviour.
5. The working preview contains inconsistent seeded Challenge title/activity/units and incomplete activity catalogue. Fix disposable environment, not canonical Product Truth. Never use preview artifacts to imply production deployment.

## E. Implementation sequencing proposal — subject to Technical Lead/Founder authorization

**Gate 0 — Formalize this Founder-approved experience direction** in one bounded existing-programme disposition (not a new governance framework); update derived feature/acceptance tracker. Review current PR #107 for useful UI components; do not merge or overwrite blindly.

**P1 — Foundation of first-entry & identity:** four-slide welcome; account creation; optional Interests/Goals; full-Profile shell; authenticated/authorized display names; proper account/legal gate; accessible cross-page navigation. Profile photo integration may follow shared media core.

**P2 — Discovery & relevance:** existing eligible Group/Challenge discovery, preference relevance ranked inside authorized visibility with a general fallback; Challenge-first to hosting Group join flow; avoid automatic participation.

**P3 — Today recovery:** Streak reminder and pending-first ordering, type-specific cards, ongoing naming, state-aware empty view, reuse existing Log Activity sheet.

**P4 — Groups targeted corrections:** Group Details content and modal sizing, selected-interests UI, original creator/date, culture refinements, roster refresh and no general rebuild.

**P5 — Challenge targeted corrections:** preserve listing and wizard, fix Activity Guide selection return/draft, prove 118 Activity catalogue, shorten/expand description, button arrangement, units, hosting search; verify results across three types.

**P6 — Shared media:** one controlled Cloudflare R2-backed profile/Group/Challenge media capability with fallback gradients/initials; authorize/configure development environment separately.

**P7 — Challenge Feed & engagement:** implement existing CF-01 contract including authorized Shares, Kudos and announcements; no comments. Resolve any still-pending feed details and separate optional external share decision.

**P8 — Support Tiizi activation:** visually complete interim screen with non-payable placeholders; enable actual manual transfer only after Founder verifies number/account name/contact plus operating/legal handling. Paystack integration later, separately authorized.

**Gate — Integrated Founder walkthrough and acceptance:** no package called pilot-ready by technical tests alone; record page-by-page evidence, approved SHA, and dependencies. Separate legal/data migrations/deployment and launch authorization.

The sequence is an organizing proposal, **not** approval to implement all packages at once. Shared dependencies and PR conflicts must be resolved in small, verifiable slices; avoid generating long governance cycles.

## F. FEF-TLC-001 team handling

- **Technical Lead:** works with Founder directly, owns task sequencing, acceptance recommendations and technical synthesis.
- **Programme Controller:** reconciles Master Programme, register, historical and present acceptance, dependencies.
- **Architecture & Decision Controller:** tests Product Truth, Experience Reference, privacy/visibility and V1/V2 boundaries; minimizes unnecessary new prohibitions.
- **Coding Agent:** implementation only for explicitly authorized scoped package, test/proof and preview, no self-merge.
- **Independent Code Reviewer:** review exact source SHA, proportional to risk; never self-review portrayed as independent.
- **Chief of Staff:** portfolio coordination and reporting; not a substitute for Founder/Technical Lead direct collaboration.

## G. Open decisions / information before live pilot

- Official verified Kenyan mobile-money recipient number, actual registered holder name, dedicated WhatsApp support contact, and how manual transfers are reconciled, acknowledged and accounted for.
- Legal Terms/Privacy publication and versioned acknowledgement / age declaration requirements.
- Actual profile/Group/Challenge media implementation environment and moderation/takedown.
- Remaining CF-01 streak milestone and administrator authorization specifics, plus whether/when to authorize external share.
- Verify all three Challenge types, Feed and steward join/admin journeys in disposable local preview; correct demo fixture discrepancies.
- Founder acceptance of each rebuilt integrated page and explicit launch authorization.

**End of consolidated working baseline.**
