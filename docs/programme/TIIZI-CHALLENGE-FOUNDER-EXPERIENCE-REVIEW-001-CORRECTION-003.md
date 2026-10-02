# TIIZI Challenge Founder Experience Review 001 — Correction 003

Status: **Founder-directed candidate; Review 001 remains OPEN**<br>
Base: `7991c3354209c95ed96b1cb3ff20df0a91ecf662`<br>
Branch: `impl/tiizi-challenge-founder-experience-review-001`

This correction binds the latest Founder preview direction to the existing
Challenge detail and accepted Activity result surfaces. It does not merge,
deploy, or close Review 001.

## Challenge participant surfaces

- Support Tiizi is read from the persisted Challenge configuration and shown
  only on an active Challenge that has it enabled. The display states that
  support is voluntary and that the destination is Platform-controlled; it
  exposes no destination editor or payment action.
- An approved Social Cause is shown only when the Challenge is active and the
  persisted Cause approval is `approved`. Participant-facing title,
  description, purpose, and beneficiary are shown. Payment destination,
  approval authority, decision audit, and operator-only reason are not exposed.
- A Cause in `pending_approval` remains visibly pending, names the Cause facts
  useful to participants, and states that Cause support is unavailable until
  approval. An approved Cause on an establishment Challenge is identified as
  approved but not available until the Challenge is active. The existing
  activation guard and absence of Activity logging while inactive are
  preserved.
- After a non-duplicate successful Activity acceptance, the existing accepted
  result remains primary and an optional, informational support prompt may be
  displayed when the active Challenge has enabled Support Tiizi and/or an
  approved Cause. This is not a payment CTA. It states that the Activity is
  already accepted, support is voluntary, and payment options are not available
  in this preview. Duplicate replays do not repeat the prompt.
- The temporary preview sentence “Payment options are not available in this
  preview yet.” must be removed or reconciled with the real participant
  execution at S8 assembly; it must not ship as permanent copy.
- Contribution remains separate from joining, Activity logging, progress,
  completion, ranking, Streaks, results, and recognition. No Support surface
  changes Activity payloads, acceptance, or derived Challenge truth.

## Contribution authority reconciliation

`TIIZI-CHALLENGE-CONTRIBUTION-RECON-001` correctly identifies the earlier
Stage-F allocation and transaction gaps, but its blanket S8 surface deferral is
superseded for the bounded read-only and post-acceptance presentation below by
the current Founder direction. `SUP-01` / `SUP-02` remain Pending in the
EOG-05 relationship-allocation matrix. This Founder decision authorizes only
the named Challenge presentation/trigger surfaces; it does not allocate
financial transaction entities, select a payment provider, or authorize
custody, transaction initiation, or verification.

| Surface | Current disposition |
|---|---|
| A. Challenge detail opportunity | Authorized and bound to persisted active Challenge configuration. |
| B. Voluntary CTA/prompt | Authorized as voluntary informational presentation; no payment action is available yet. |
| C. After-log prompt | Authorized only after a non-duplicate accepted Activity result; it cannot interrupt, roll back, or alter the accepted Activity. |
| D. Amount selection | Not implemented. Requires S8 contribution policy and binding; no amount is persisted or chosen here. |
| E. Payment initiation | Not implemented; S8 execution seam required. |
| F. External destination handoff | Not implemented. Cause destinations remain beneficiary-owned; Support Tiizi remains Platform-controlled. No destination or payment URL is exposed by this surface. |
| G. Payment confirmation | Not implemented; S8 transaction authority required. |
| H. Verification | Not implemented; self-report is not verification under T1 W.10. |
| I. Transaction/history | Not implemented; requires S8 event and participant-history model. |
| J. Retry/failure | Not implemented; requires S8 payment state and failure policy. |
| K. Reconciliation | Not implemented; requires S8 financial reconciliation authority and audit. |
| L. Contribution reporting/visibility | Not implemented. Any later self-reported total must follow T1 W.11 (`community-reported`, never unverified “Amount Raised”) and FR-V2-174 privacy/consent. |

The S8 payment provider remains deferred by FR-V2-162. Social Cause custody
or escrow remains unauthorized by T1 W.9. S8 is a sequenced implementation
dependency for payment execution, not an indefinite deferral: it must be
addressed while Challenge assembly context remains active.

## Next bounded work and sequence

1. Complete Challenge Founder Experience corrections and Founder review.
2. Assemble a Platform Operator Social Cause approval experience and configured
   fail-closed authority provider for the existing decision API. This bounded
   assembly is recorded in `TIIZI-CHALLENGE-SOCIAL-CAUSE-OPERATOR-APPROVAL-ASSEMBLY-001.md`;
   the local Development Founder preview exercised the audited approval path.
   Do not bypass the database activation guard or silently approve preview
   records.
3. Bind the Support surfaces to an authorized S8 contribution execution model:
   settle authority allocation for SUP-01/SUP-02; decide amount and consent
   policy; provide payment initiation/handoff, confirmation and verification,
   transaction records/history, retry/failure, privacy, reporting, and
   reconciliation. Preserve Platform control of Tiizi's destination and
   beneficiary ownership of Cause destinations.
4. Complete final Challenge acceptance after these bounded dependencies.

## Challenge background pilot disposition

Founder accepts the governed local curated gradients for the pilot. The
persisted Challenge `cover_id` remains canonical and allowlisted. Participant
and creator UI calls this a **Challenge background** to avoid implying uploaded
photography. No upload, arbitrary URL, storage provider, image processing, or
moderation was added.

**CHALLENGE IMAGE COVER UPLOAD — POST-PILOT ENHANCEMENT.** This future
enhancement is not a Challenge pilot-readiness blocker.

## Challenge description presentation

The full canonical description remains unchanged. The Challenge hero is
bounded to three visual lines; a `Read more` control opens the full text in the
existing accessible sheet primitive. Short descriptions do not show the
control. The hero itself never expands from this action.
