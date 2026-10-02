# TIIZI Challenge Founder Experience Review 001 — Correction Pass 002

Status: **Founder-directed implementation candidate; Review 001 remains OPEN**
Baseline commit: `7e542689a3ac80cb73a3faa10d96d31df55bd5dc`
Branch: `impl/tiizi-challenge-founder-experience-review-001`

This record implements the Founder dispositions for Challenge cover, Support a Cause, Support Tiizi, wizard placement, and the NOW/S8 boundary. It does not close the review or authorize merge/deployment.

## Challenge cover Product Truth

Challenge owns an optional canonical `cover_id` from the governed Challenge cover catalogue (`challenge-1` through `challenge-8`). The server allowlists the identifiers; the client renders local governed gradients. Arbitrary URLs, remote image uploads, and provider-specific upload/storage are outside this contract. Legacy rows with no cover render a deterministic type treatment. Group cover IDs remain Group-owned; Challenge has a distinct catalogue and does not alter Group cover semantics.

Creation Step 3 requires selection. The same reference is returned by Challenge reads and drives the discovery thumbnail, detail hero and Review & Create preview. Run Again creates a new Challenge identity and may copy the cover reference; it copies no Challenge identity or historical state.

## Support a Cause — approved configuration truth

Support a Cause is optional and defaults off. When enabled at creation, the Challenge is created in `establishment` with a distinct Cause approval state `pending_approval`. It cannot activate/go live until a Platform Operator approves it. Cause configuration comprises title, description, purpose, beneficiary, beneficiary-owned external payment destination reference, approval status, approving authority, decision timestamp/reason, and an append-only decision audit. No unnecessary fundraising target is included because the current governing contribution authority does not require it for this configuration slice.

The whole Challenge waits: a Challenge with Cause enabled remains in ordinary `establishment` even if its scheduled start arrives. The separate Cause state does not alter the Challenge status vocabulary. Activation is blocked by a database guard until Cause status is approved; approval makes the Challenge eligible for ordinary schedule/lifecycle activation. Creator revision after `revision_required` resubmits as `pending_approval`. Beneficiary/destination changes after approval invalidate the approval and require review again. Removing Cause is available only before go-live and permits the ordinary Challenge lifecycle. Cause approval/rejection never edits the Challenge performance configuration. Tiizi does not custody or escrow Cause funds.

Platform Operator identity is supplied through a fail-closed API authority dependency. The current product has no assembled Operator decision UI or configured operator-role source in this API runtime; that UI/role wiring is a separate bounded assembly requirement. An unconfigured authority returns 503; an unauthorized actor returns 403. Neither condition weakens activation gating.

## Support Tiizi — approved configuration truth

Support Tiizi is optional and defaults off. Challenge stores only the enablement flag. The destination is Platform-owned and resolved outside the Challenge; the creator cannot enter or change it. Enabling Support Tiizi requires no per-Challenge Operator approval. It does not affect joining, participation, Activity acceptance, progress, Race position, Streaks, results, or recognition.

## Wizard and lifecycle boundary

The existing seven-step flow remains. Step 3 — Challenge Details contains title, description, governed cover selection, and progressive disclosure for optional **Support a Cause** and **Support Tiizi**. Both are off by default. Cause fields appear only when enabled; Support Tiizi never exposes a destination editor. Review & Create displays the selections, Cause beneficiary, approval requirement, and financial-independence statement. Financial controls are never named with bare “Contribution”, which remains Activity-progress terminology.

Challenge-side work includes schema, destination ownership/reference, persistence, API validation, Cause decision authority, approval audit, activation enforcement, review rendering, and reads. S8 remains responsible for payment initiation, mobile-money interaction, confirmation/verification, participant transaction/event records, history, retry/failure, and reconciliation. Participation and Activity processing do not call or depend on S8.

## Run Again isolation

Run Again always creates a new Challenge ID. Cover may copy. Social Cause configuration and Support Tiizi are reset off in the new draft; a Cause, if reconfigured, starts pending approval. No Cause approval/audit, contribution/payment record, participant data, progress, results, or recognition carries forward.

## Implementation boundary and status

This is a candidate implementation record; final code/test/browser evidence and any runtime Operator-authority limitations are stated in the Correction Pass 002 return report. No Challenge progress surface is redesigned. Review 001 remains open for Founder review.
