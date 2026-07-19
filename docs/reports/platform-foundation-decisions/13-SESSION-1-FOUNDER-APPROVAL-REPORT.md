# Session 1 Founder Approval Report

## 1. Session date

2026-07-18

## 2. Decisions approved

The founder approved ten decisions:

- PLT-01 — Authoritative product description
- PLT-02 — Meaning of group-first and launch boundary
- PLT-03 — Initial domains and future extensibility
- PLT-04 — Position of individual challenges
- IDP-01 — Profile field classification and audience matrix
- IDP-02 — Privacy-toggle and consent semantics
- ACT-01 — Canonical cross-domain activity event
- ACT-02 — Ownership of raw events and derived totals
- KNW-01 — Authoritative runtime catalogue and local fallback purpose
- ADM-01 — Admin roles, trusted commands and auditability

The remaining 27 decisions are Pending.

## 3. Approved platform identity

> Tiizi is a group-first challenge and motivation platform that helps people pursue meaningful goals together through measurable activities, mutual encouragement and shared progress.

## 4. Approved meaning of group-first

Group challenges are the primary product model for Version 2. Personal profiles, preferences, analytics, settings and related features support group participation; they do not constitute an individual-challenge mode. Architecture and documentation must prioritize group participation, group accountability and shared progress.

## 5. Individual-challenge future-only position

Individual challenges are excluded from Version 2 launch. They are neither an active runtime type nor a promised capability. They may be recorded only as a possible future governed capability, requiring a separate product, lifecycle, permissions, analytics and implementation decision process. Their future possibility creates no current launch, runtime, acceptance, architecture or migration obligation.

## 6. Initial domains

Fitness and Wellness are the Version 2 launch domains. Wellness may govern hydration, recovery, mindfulness, sleep, mobility, healthy routines and general wellbeing without treating each as a separate top-level domain. Platform contracts must remain sufficiently domain-neutral for later governed domains, but unimplemented domains must not be presented as active.

## 7. Privacy foundation

The approved visibility classes are Public, Authenticated-discoverable, Shared-group, Private and Privileged-operational. Minimal disclosure and deny-by-default access apply. Health, body, contact, birth-date and private preference data must not be broadly readable. Privacy controls must be enforceable or truthfully relabelled. Consent must record its version, applicable terms/privacy version, time, source and user identity.

## 8. Activity and data-ownership foundation

Version 2 will govern one canonical platform activity-event contract with Fitness and Wellness extensions. Legacy `workouts` and `wellnessLogs` may remain temporarily only through explicit compatibility or migration mappings.

> The participant owns the submission intent. A trusted backend owns acceptance, authoritative activity events, progress, completion, rankings and projections.

The client must not author authoritative challenge totals, participant aggregates, completion status, leaderboard rank, recap results, verification status or derived analytics.

## 9. Catalogue authority

One governed runtime catalogue authority is approved. Local files may be versioned development or test fixtures, controlled seed/bootstrap inputs, or explicitly approved packaged fallback assets. They must never silently override or act as equal production authorities. Production fallback behavior must be explicit, observable and governed.

## 10. Admin trust principles

The founder approved one canonical platform role model, least privilege, trusted backend commands for high-impact transitions, immutable audit records for sensitive actions, and the principle that UI gating is not authorization. Direct browser writes require explicit approval in a documented permission and risk matrix.

## 11. Documents now unblocked

The following are unblocked for drafting at the approved scope:

- Tiizi Platform Constitution — product identity, group-first principle and launch boundary
- Version 2 Launch Scope Statement
- Group-first Challenge Scope and Individual Future-Capability Position
- Fitness and Wellness Launch-Domain Boundary

The entity ownership, privacy, security, knowledge runtime and admin standards are materially advanced but not fully unblocked; pending lifecycle, taxonomy, role and operational decisions still apply.

## 12. Remaining decisions

Twenty-seven decisions remain Pending. Review resumes with Session 2:

- GRP-01 through GRP-04
- CHL-01 through CHL-04

Later sessions cover ACT-03/04, ranking and streaks, remaining knowledge decisions, social/moderation/notifications/motivation, support/donations, analytics and operations.

## 13. Change-scope confirmation

This session record changes governance documentation only. No application code, Firebase rules, tests, configuration, data, production environment, deployment, migration, commit or push was changed or performed.
