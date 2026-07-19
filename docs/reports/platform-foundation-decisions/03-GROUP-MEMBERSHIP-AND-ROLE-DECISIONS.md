# Group, Membership and Role Decisions

Group governance is foundational because active challenges are group-scoped.

<a id="grp-01"></a>

## GRP-01 — Canonical group role vocabulary and authority

**Decision ID:** GRP-01
**Decision title:** Canonical group role vocabulary and authority
**Owning domain:** Groups/security
**Priority:** P1 (PD-009; OQ-04)

**Why the decision is needed:** Role names must carry one meaning across UI, services and rules.

**Current repository evidence:** Storage uses owner/admin/member; some UI labels administrators as “Coach”. Creator checks and group-role checks vary.

**Current documented intent:** No approved group-role dictionary exists.

**Conflict or gap:** Coach may be a social title, an authorization role, or an accidental label.

**Options:**

- A — Authorization roles are Owner, Administrator and Member; Coach is optional display metadata with no implicit permission.
- B — Make Coach a distinct permission-bearing role and define its exact capabilities.

**Recommended default:** Option A unless coaching authority is an explicit launch requirement.

**Reason for recommendation:** It matches existing storage and avoids granting authority through presentation labels.

**Consequences of approval:** A single permission matrix can govern UI, services, callables and rules.

**Consequences of deferral:** Role drift can cause inconsistent access.

**Documents blocked by this decision:** Group Authorization Standard; Product Terminology Standard; Security Matrix.

**Implementation areas affected:** Group types/screens, callables, rules, admin moderation.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="grp-02"></a>

## GRP-02 — Ownership transfer and owner departure

**Decision ID:** GRP-02
**Decision title:** Ownership transfer and owner departure
**Owning domain:** Group lifecycle
**Priority:** P1 (PD-008; OQ-03)

**Why the decision is needed:** A group cannot safely lose its only accountable owner.

**Current repository evidence:** Leave exists; ownership transfer was not traced.

**Current documented intent:** No documented rule exists.

**Conflict or gap:** Owner leave, inactivity, suspension and succession are unresolved.

**Options:**

- A — Owner cannot leave until ownership is transferred to an eligible active member; platform admin can perform audited recovery.
- B — Auto-transfer to the longest-serving administrator under a documented rule.
- C — Allow owner departure and orphan the group; unsafe.

**Recommended default:** Option A.

**Reason for recommendation:** It preserves deliberate consent and clear accountability.

**Consequences of approval:** Owner leave and recovery flows can be specified.

**Consequences of deferral:** Groups can become stranded or rely on ad hoc admin intervention.

**Documents blocked by this decision:** Group Lifecycle Standard; Admin Operations Standard.

**Implementation areas affected:** Membership service, group settings, callables, rules, audit logs.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="grp-03"></a>

## GRP-03 — Group and membership lifecycle, including history

**Decision ID:** GRP-03
**Decision title:** Group and membership lifecycle, including history
**Owning domain:** Groups/data retention
**Priority:** P1 (PD-008; OQ-05, OQ-14)

**Why the decision is needed:** Archive/deactivation/deletion and leaving must have consistent access consequences.

**Current repository evidence:** Groups use active/inactive plus moderationStatus; members use joined/active/pending/rejected/left/expelled. Deactivated groups are blocked by current guards.

**Current documented intent:** No platform group lifecycle standard exists.

**Conflict or gap:** Archive, delete, historical challenge/feed visibility and reactivation are undefined.

**Options:**

- A — Canonical group states: active, archived, deactivated, deleted-marker; membership states: pending, active, left, removed. Preserve immutable history with policy-based read access.
- B — Use hard deletion for groups and memberships, accepting broken historical references.

**Recommended default:** Option A; map legacy values explicitly during migration.

**Reason for recommendation:** It supports shared history, moderation and recovery.

**Consequences of approval:** Lifecycle and migration documents gain target vocabularies.

**Consequences of deferral:** Status aliases and inconsistent access persist.

**Documents blocked by this decision:** Group and Membership Lifecycle; Retention Policy; Legacy Compatibility Register.

**Implementation areas affected:** Groups, members, challenges, feeds, discovery, admin.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="grp-04"></a>

## GRP-04 — Invitations, join requests, removal and appeal

**Decision ID:** GRP-04
**Decision title:** Invitations, join requests, removal and appeal
**Owning domain:** Groups/community safety
**Priority:** P1 (PD-014)

**Why the decision is needed:** Entry and removal affect privacy, safety and due process.

**Current repository evidence:** Callables support invite creation/redeem/revoke and request approve/reject. Admin service can expel; no appeal/withdraw/reapply policy is traced.

**Current documented intent:** Private groups support invitation or approval.

**Conflict or gap:** Invite forwarding, expiry, repeat requests, reason visibility, removal authority and appeal are undecided.

**Options:**

- A — Invitations are bounded/expiring; requests are withdrawable; owner/admin may remove with reason; platform moderation handles appeals and abuse.
- B — Group decisions are final with no appeal, except platform safety escalation.

**Recommended default:** Option A for platform removal/moderation; group admission decisions need not guarantee appeal unless abuse is alleged.

**Reason for recommendation:** It balances group autonomy with platform safety.

**Consequences of approval:** Invite and moderation lifecycles become governable.

**Consequences of deferral:** Users and operators lack consistent recovery paths.

**Documents blocked by this decision:** Membership and Invitation Lifecycle; Community Conduct Policy; Moderation Runbook.

**Implementation areas affected:** Invite callables, join UI, group audit logs, reports, notifications.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
