# Executive Summary

## What Tiizi is today

Tiizi is currently a Firebase-backed, group-first challenge and motivation application. Its strongest complete product spine is:

**identity/profile → group membership → group-scoped challenge → activity log → progress/leaderboard/feed projection → social engagement.**

The application supports public and private groups, callable invite and join-request workflows, collective/competitive/streak challenges, fitness and wellness activity logging, progress views, leaderboards, group feeds, reactions/comments/replies, profile analytics, admin screens, content catalogues, and manual support/donation-intent workflows.

It is broader than a fitness catalogue, but important platform concepts remain encoded through fitness-centric terms: `workouts` are the main fitness event, metrics and scoring normalize exercise-like quantities, profile preferences are exercise lists, and challenge compatibility assumes fitness/wellness measurements.

## Strongest implemented areas

- A large authenticated route surface with 103 screen files and explicit onboarding, group and admin gates.
- Group-first challenge scoping and a backend callable that atomically creates a challenge with creator membership.
- Server-side callable workflows for private invites and join-request approval.
- Fitness and wellness logging with transactional progress changes.
- Firestore triggers and scheduled functions for feed/summary/metric projections, counts and expiry.
- Broad admin coverage across users, groups, challenges, catalogues, content, settings and donations.
- Extensive fitness/wellness knowledge-governance documentation and current catalogue/runtime audits.

## Weakest or least governed areas

- Privacy and authorization: UI privacy settings are not reconciled with broad authenticated reads in rules.
- Data ownership: activity events, member aggregates, challenge totals and projections have overlapping writers/authorities.
- Lifecycle completeness: account deletion, ownership transfer, activity correction, challenge cancel/archive/reopen and moderation appeal are not complete governed flows.
- Async integrity: final/duplicate/corrected/deleted activity handling is not idempotent or consistently reconciled.
- Platform governance: knowledge documents are far more mature than identity, groups, social, notifications, donations, analytics, security and operations documentation.
- Operational confidence: repository code defines schedules/triggers, but deployment, IAM, retries, alerts and live collection/rules state were not inspected.

## Principal source-of-truth risks

1. Fitness runtime reads Firestore `catalogExercises`, while a local 154-record JSON and numerous legacy/static sources also exist.
2. Wellness runtime uses Firestore with a local 67-record fallback.
3. Templates are mutable Firestore records; launched challenges copy data without activity/template version provenance.
4. Challenge progress/ranking appears in challengeMembers, challenges and several function-owned projection collections.
5. User/admin roles are represented in both `admins` and `users.role`.
6. Interests/goals are both hard-coded in profile screens and admin-managed collections.
7. The book library probes three collection names.
8. Settings and donation semantics are split across multiple collections and legacy statuses.

## Priority conclusion

Four P0 discovery findings require resolution before a Version 2 platform architecture is finalized: enforced profile privacy, server ownership of activity/progress aggregates, verified access to runtime projection collections, and an approved platform entity/source-of-truth standard.

The next phase should confirm deployed state read-only and obtain founder decisions on privacy, roles/ownership, ranking/streak semantics, correction behavior, scoring terminology, donation truth language, retention and first-release domain scope. No redesign or migration should begin from documentation intent alone.
