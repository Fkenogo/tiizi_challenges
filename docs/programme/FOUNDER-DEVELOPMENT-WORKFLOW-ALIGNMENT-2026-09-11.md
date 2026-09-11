# Tiizi V2 — Founder Development Workflow Alignment & Stage G Architecture Reconciliation

**Status:** Founder Direction Recorded / Architecture Reconciliation Required  
**Effective date:** 11 September 2026  
**Authority:** Founder  
**Scope:** Development workflow, Founder preview, Stage G architecture entry condition

## 1. Founder development workflow

Tiizi adopts a **local-first Founder review workflow** for active product development.

Routine Founder product review is part of normal development and should use the committed GitHub state locally where practical. A hosted Preview environment is not required merely to make ordinary product progress visible.

Default loop:

1. implement the authorised bounded change;
2. run appropriate local/automated validation;
3. commit and push to GitHub;
4. make material product-facing work locally reviewable by the Founder;
5. address material feedback;
6. continue the authorised programme.

Hosted environments are reserved for cases where hosting, remote access, integration realism, pre-release validation or deployment rehearsal is itself material.

## 2. Stage F / implementation architecture observation

Stage F Technical Architecture Mapping records a retained Firebase/React architecture under MTAIP-001 and states that Firestore remains the primary data store, Firebase Authentication remains the identity provider, and infrastructure migration is not authorised.

Recent V2 implementation, however, has introduced PostgreSQL-backed V2 domain/runtime structures and provider-neutral authority seams, with Firebase/Firestore used at bounded integration points in parts of the new implementation.

Those two facts must be reconciled before Stage G materially expands implementation.

This record does **not** decide the reconciliation by inference.

## 3. Required architecture reconciliation

Before Stage G authorises substantial additional implementation, Tiizi should establish a concise current-state architecture position answering:

- Which system is authoritative for V2 Challenge/domain state?
- Which state remains authoritative in Firestore?
- What is PostgreSQL's intended permanent versus transitional role?
- What identity/group authority remains with Firebase and what passes through provider-neutral seams?
- Does the implemented architecture remain within the approved MTAIP-001 interpretation, or is a bounded Founder architecture amendment required?

The result should describe the architecture actually intended to continue, not force implementation back to an older diagram merely for documentary consistency.

## 4. Provider and infrastructure principle

Architecture drives infrastructure. Existing providers are retained where they fit the target architecture; they are not retained merely because they were selected historically.

At the same time, this decision does not authorise a broad Firebase migration, PostgreSQL expansion, new auth provider, new hosting platform or infrastructure rewrite.

Any such change must arise from the architecture reconciliation and applicable Founder authority.

## 5. Review proportionality

Review depth must be proportional to consequence.

Stronger review remains appropriate for constitutional/domain authority, security boundaries, derived-truth correctness, migrations, irreversible state changes, major architecture decisions and production/deployment changes.

Routine UI work, bounded reversible corrections, local preview, documentation synchronisation and low-risk implementation should not automatically inherit the same review burden.

Governance should protect product truth and material risk without becoming the primary output of Stage G.

## 6. Effect

Stage F remains approved and closed as recorded. This document does not reopen Stage F product decisions.

It creates one bounded Stage G entry requirement: reconcile the approved architecture description with the V2 implementation direction before further architecture-dependent work materially expands.
