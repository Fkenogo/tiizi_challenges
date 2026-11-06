# TIIZI — MEDIA-1 Founder Privacy Decision Brief 001

**Reference:** TIIZI-MEDIA-1-FD-ALIGN-001
**Prepared:** 2026-11-06
**Decision owner:** Founder
**Status:** **DECISION BRIEF ONLY — NO PRIVACY VALUES APPROVED BY THIS DOCUMENT**
**Repository baseline:** PR #154 merge `5722dadccd5fab18ddef2e40c284a8b5762ff2b9`
**Authority:** Member Completion Founder Disposition §§8, 10, 14, 18; MEDIA Capability Assessment §9

## 1. Purpose and boundary

Founder Disposition §8.4 and §14 reserve privacy policy, deletion, retention, takedown/reporting and budget ownership for Founder disposition. FD-1 delegates technical defaults to the Technical Lead; it does not delegate these policy choices. This brief presents options and recommendations for a later attributable Founder decision. It is not a decision registry and does not amend the Disposition or the MEDIA-1 decision authority.

No proposed timeline or control below is approved. No implementation, resource, migration, production access or deployment is authorized. Existing product scope, visibility and lifecycle decisions remain unchanged, including Profile removal at `deleted-anonymized` and Group/Challenge media following their scope lifecycle.

## 2. Decisions requested

| Decision | Recommendation for Founder consideration | Trade-offs and unresolved facts |
|---|---|---|
| **Deletion SLA** | Define an end-to-end target that distinguishes (a) immediate read suppression and cessation of new URL issuance, (b) deletion from primary object storage, and (c) expiry/purge from backups. Candidate for discussion: suppress immediately; remove primary objects within 30 calendar days after an authorized terminal trigger; expire backup copies within 90 days, with deletion tombstones replayed on restore. | Shorter targets reduce residual exposure but increase operational urgency and the chance of incomplete erasure across retries/replicas. Longer targets ease recovery but retain sensitive images longer. Legal, contract, hosting and operational requirements have not been assessed here; the Founder should consult the appropriate privacy/legal owner before selecting values. |
| **Takedown and immediate suppression** | Require a verified takedown decision to mark the asset suppressed before asynchronous deletion begins; stop issuing signed URLs immediately; keep a bounded operator process for urgent abuse/privacy reports. Candidate response objective: same-day triage, with an immediate suppression path for validated urgent cases. | Suppression prevents new access through Tiizi but cannot recall bytes already downloaded or a still-valid signed URL until expiry; cached copies may extend exposure. More aggressive auto-removal reduces exposure but increases false-positive and appeal risk. Define who can authorize a takedown, escalation/appeal, and evidence retention. |
| **Object and backup retention** | Do not retain camera originals by default. Consider retaining only a normalized, metadata-stripped master and governed display variants while the authorized Profile/Group/Challenge scope requires them. Keep database deletion tombstones long enough to prevent a restored backup from resurrecting deleted media. | A normalized master supports later re-cropping and re-encoding; retaining it increases sensitive data and storage. Retaining only final variants reduces data but may require a new upload for future crops. Backup copies improve recovery but complicate deletion guarantees and add cost. Specify separate retention by asset scope and backup class. |
| **Reporting and moderation** | Before real user images, identify an accountable reviewer, intake channel, report categories, evidence-handling rules, escalation path and takedown decision authority. Use an existing support channel initially if suitable; do not add an in-product report control without separate experience approval. | A manual process is lower-cost but requires named coverage, response expectations and secure evidence handling. Automated moderation can reduce review load but may misclassify images, has provider/data-transfer implications and needs a human appeal path. No policy or moderation provider is selected. |
| **Access revocation** | Keep the ARCH-001 API-issued signed URL direction. Require the API to reauthorize current actor and scope before each URL issuance. Evaluate a short URL lifetime (candidate 1–5 minutes) and zero-freshness private response policy; measure the combined URL-expiry plus cache-freshness window. | Signed URLs are bearer capabilities until expiry; membership removal or takedown cannot invalidate bytes already fetched or an unexpired URL. A shorter TTL raises signing/request load. An authenticated proxy could tighten revocation but would change the existing architecture direction and requires a separate architecture reconciliation. Maximum acceptable residual access is a Founder privacy decision. |
| **Audit and privacy safeguards** | Log only metadata needed to prove authorization, upload, replace, suppression, deletion and outcome: actor, asset ID, scope, operation, timestamp and result. Never log image bytes, credentials or signed URLs. Restrict audit access and define a separate retention period, access-review owner and incident process. | More metadata improves investigation and accountability but increases personal-data and retention burden. Minimal logs reduce exposure but may impede abuse/incident reconstruction. Exact audit retention and lawful basis remain unassessed and require Founder/legal-owner disposition. |

## 3. Recommended decision sequence

1. Founder selects or amends deletion, takedown, object/master, backup and audit-retention policies, including explicit triggers and exceptions.
2. Founder identifies the accountable privacy/legal and operational owners and the reporting/takedown decision path.
3. Technical Lead records the signed-URL TTL, cache behavior, cleanup mechanics and backup/deletion technical controls only after they fit within the Founder-approved privacy limits and pass verification.
4. Founder separately authorizes any non-production resources, bounded spend and implementation package; production remains a separate later authorization.

## 4. Evidence and limitations

The current authority confirms Profile removal at `deleted-anonymized`; Group and Challenge assets follow their own governed lifecycle and are not deleted merely because an uploader leaves. It does not specify a physical deletion SLA, backup purge period, takedown/reporting policy, signed-URL exposure limit or audit retention duration. No runtime, storage account, backup, image, credential or production system was accessed for this brief.

This brief presents no approved privacy values. Record a decision only in the existing Founder Disposition and MEDIA-1 decision authority as appropriate; do not treat this brief as a competing registry.
