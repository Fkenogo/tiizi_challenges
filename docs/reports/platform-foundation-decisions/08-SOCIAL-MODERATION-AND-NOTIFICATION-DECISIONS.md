# Social, Moderation, Notification and Motivation Decisions

Feed, notification and motivation behavior need platform policies distinct from challenge ranking.

<a id="soc-01"></a>

## SOC-01 — Feed ownership, retention, departure and sharing

**Decision ID:** SOC-01
**Decision title:** Feed ownership, retention, departure and sharing
**Owning domain:** Social/privacy
**Priority:** P1 (PD-014; OQ-14)

**Why the decision is needed:** A group feed mixes participant events, derived summaries and personal attribution.

**Current repository evidence:** Functions create immutable client feed projections; group members read them. Sharing has no durable governed entity; correction/delete reconciliation is incomplete.

**Current documented intent:** No community-content lifecycle standard was found.

**Conflict or gap:** Who owns a feed item, what survives departure, and what may be shared outside the group are undecided.

**Options:**

- A — Group context owns feed visibility; attributed users retain privacy/correction rights; feed items survive departure as governed history; external sharing requires explicit policy and redaction.
- B — Departing users automatically delete every historical feed item.
- Unsafe — Any member may publicly share private-group content by default.

**Recommended default:** Option A.

**Reason for recommendation:** It preserves group history without treating derived content as unrestricted public content.

**Consequences of approval:** Feed, privacy, retention and sharing standards can be drafted.

**Consequences of deferral:** Departure and correction produce inconsistent history.

**Documents blocked by this decision:** Feed Content Lifecycle; Privacy Policy; Sharing Specification.

**Implementation areas affected:** Feed projections, group access, share UI, account deletion.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="soc-02"></a>

## SOC-02 — Reactions, comments, replies, moderation and appeal

**Decision ID:** SOC-02
**Decision title:** Reactions, comments, replies, moderation and appeal
**Owning domain:** Social/moderation
**Priority:** P1 (PD-014; OQ-15)

**Why the decision is needed:** Community engagement needs conduct, removal and due-process rules.

**Current repository evidence:** Members can react/comment/reply; authors can delete some content. No unified moderator removal/appeal flow is traced.

**Current documented intent:** No approved community conduct or moderation standard exists.

**Conflict or gap:** Edit window, deletion representation, moderator roles, evidence retention and appeals are undefined.

**Options:**

- A — Authors may edit/delete within governed limits; group admins moderate group content; platform moderators handle policy violations and appeals; removals retain an auditable tombstone.
- B — Authors alone control content; platform intervenes only by deleting accounts.

**Recommended default:** Option A.

**Reason for recommendation:** It supports group stewardship while retaining platform safety accountability.

**Consequences of approval:** Moderation UI, roles and audit requirements become specifiable.

**Consequences of deferral:** Abuse handling remains inconsistent and unauditable.

**Documents blocked by this decision:** Community Conduct Policy; Moderation Operations Standard; Social Content Lifecycle.

**Implementation areas affected:** Feed subcollections, group admins, platform moderation, reports, notifications.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="ntf-01"></a>

## NTF-01 — Notification scope, authority and lifecycle

**Decision ID:** NTF-01
**Decision title:** Notification scope, authority and lifecycle
**Owning domain:** Notifications
**Priority:** P1/P2 (PD-017; OQ-13)

**Why the decision is needed:** Notifications should represent trusted events, not arbitrary client-authored messages.

**Current repository evidence:** In-app notifications are a bounded array embedded in `users`; no push/email delivery backend or delivery acknowledgment is traced.

**Current documented intent:** Admin notification templates exist; future channels are not governed.

**Conflict or gap:** Event source, read/delivery states, retention and channel launch scope are undecided.

**Options:**

- A — V2 launch supports trusted in-app notification events with unread/read/dismissed/expired states; push/email are future channels using the same event identity and consent.
- B — Add push/email to launch scope now, requiring provider, consent, retry and unsubscribe governance.

**Recommended default:** Option A.

**Reason for recommendation:** It establishes a truthful foundation without claiming unavailable delivery channels.

**Consequences of approval:** Notification lifecycle and template governance can proceed.

**Consequences of deferral:** Notifications remain mutable user-document metadata.

**Documents blocked by this decision:** Notification Product/Lifecycle Standard; Consent Standard; Operations Runbook.

**Implementation areas affected:** Notification service/schema, functions, settings, admin templates.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="mot-01"></a>

## MOT-01 — Daily goals, streaks, milestones, recognition and rewards

**Decision ID:** MOT-01
**Decision title:** Daily goals, streaks, milestones, recognition and rewards
**Owning domain:** Motivation/product
**Priority:** P1 (PD-016, PD-023)

**Why the decision is needed:** Motivation mechanisms must be coherent and separate from competition ranking.

**Current repository evidence:** Daily goals, challenge streaks and profile metrics exist separately. No XP wallet, reward balance or redemption system exists.

**Current documented intent:** V2 knowledge model explicitly excludes reward points; approved direction emphasizes mutual encouragement and shared progress.

**Conflict or gap:** Which launch mechanisms are canonical and whether badges/rewards are informational or economic are undecided.

**Options:**

- A — Launch motivation includes progress feedback, streaks, milestones, social recognition and optional non-economic badges; ranking values are never rewards.
- B — Add XP/redeemable rewards, requiring a separate economy, fraud and liability decision pack.
- C — Remove all recognition beyond raw progress.

**Recommended default:** Option A.

**Reason for recommendation:** It matches current product direction without inventing a points economy.

**Consequences of approval:** Motivation terminology and notification triggers can align.

**Consequences of deferral:** Ranking/scoring residue may become accidental gamification policy.

**Documents blocked by this decision:** Motivation and Recognition Framework; Product Terminology; Analytics Event Dictionary.

**Implementation areas affected:** Home, profile, feed, notifications, ranking fields.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
