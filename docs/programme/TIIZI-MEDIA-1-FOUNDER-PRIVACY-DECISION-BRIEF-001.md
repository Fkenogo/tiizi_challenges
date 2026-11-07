# TIIZI — MEDIA-1 Founder Privacy Decision Brief 001

**Reference:** TIIZI-MEDIA-1-FD-ALIGN-001 (updated for TIIZI-MEDIA-1-FD-PRIVACY-001)
**Updated:** 2026-11-07
**Decision owner:** Founder
**Status:** **SIX INITIAL PRIVACY POLICIES APPROVED; PRIVACY IMPLEMENTATION AND VERIFICATION PENDING; TD-05 CORRECTION VERIFIED / ADOPTION HOLD**
**Recording baseline:** `9d7f12a19c48be9027e597dba713163e68f737f3`
**Authority:** Member Completion Founder Disposition §§8, 10, 14, 18–20; MEDIA Capability Assessment §§9–10

## 1. Purpose and boundary

This brief summarizes the six Founder-approved policy controls recorded authoritatively in Member Completion Founder Disposition §20 under `TIIZI-MEDIA-1-FD-PRIVACY-001`, approved **2026-11-06**. It is a concise decision summary, not a competing registry. The Founder retains privacy-policy and expenditure authority; FD-1 delegates technical defaults to the Technical Lead but does not itself adopt them.

Approval is subject to legal applicability, technical feasibility and operational verification before real-user pilot. Policy approval does not show that an API, storage, backup, takedown, or audit control exists. Numerical implementation settings remain provisional where marked below. No implementation, resource, credential, migration, expenditure, production access or deployment is authorized. MEDIA-1 remains open, and P5T remains ahead of P6.

## 2. Approved privacy controls

| ID | Founder-approved policy | Verification or implementation boundary |
|---|---|---|
| **PRIV-01 — Image deletion** | Immediately suppress visibility and stop issuing new signed URLs after an authorized deletion/terminal lifecycle event. Start physical deletion as soon as operationally possible; complete primary-storage deletion within **30 calendar days maximum**. Require reliable retries, confirmation and audit evidence. Profile follows Profile/account deletion-anonymization; Group and Challenge follow their governed scope lifecycle; uploader departure alone does not delete Group/Challenge media. | Verify suppression, issuance denial, deletion retries/confirmation and lifecycle authority. The 30-day limit is policy, not a proposed wait. |
| **PRIV-02 — Backups** | Backups containing deleted images expire or are purged within **90 calendar days**. Before restored content becomes accessible, replay deletion tombstones so deleted/suppressed media cannot reactivate. | Backup topology, actual deletion propagation and restore procedure are unverified. No backup service is claimed to exist. Verify before real-user pilot. |
| **PRIV-03 — Takedown and reporting** | Authorized operators may immediately suppress an image for a validated urgent privacy, abuse or safety issue. Initially use an appropriate existing support channel. Require human review, escalation, documented outcomes, appeal/reconsideration, reporting categories, secure evidence handling and response responsibilities before pilot. | Name the responsible operator and define the process before pilot. No new in-product reporting UI or automated moderation provider is authorized. |
| **PRIV-04 — Image retention** | Discard camera originals after successful normalization and before availability. Retain only an approved metadata-stripped normalized master and required display renditions, while the governed Profile, Group or Challenge scope legitimately requires them. Delete them under the approved lifecycle/deletion rules. Uploader membership does not extend retention. | Technical handling and lifecycle deletion must be verified. This policy does not select variant dimensions or technical processing settings. |
| **PRIV-05 — Residual access** | Target no more than **60 seconds effective access** through previously issued signed URLs after revocation, replacement or suppression. Stop issuing new URLs and do not use shared caching for private media. Previously downloaded copies cannot be recalled. | A 60-second URL TTL is a candidate mechanism only. Verify expiry, cache behavior and endpoint compatibility. If ARCH-001 signed URLs cannot meet the target, return the conflict to the Technical Lead/Founder; do not silently change architecture. |
| **PRIV-06 — Audit records** | Retain necessary media-operation audit metadata for **12 months**, then delete unless a documented incident or applicable legal obligation justifies longer. Restrict access. Record actor, scope, asset reference, operation, timestamp, outcome and relevant authorization information. Never log image contents, credentials, signed URLs or unnecessary private metadata. | Verify access controls, redaction and deletion. Legal basis, obligations and exception procedures require review before real-user pilot. |

## 3. Outstanding ownership and approvals

- Name the daily privacy/takedown operator and operational monitoring owner.
- Complete applicable legal/privacy review, including legal basis, obligations, backup/deletion propagation and exceptions.
- Prepare a complete infrastructure cost estimate and obtain bounded spend authorization.
- Obtain Founder authorization before Cloudflare resource provisioning. FD-B selects the existing Founder-owned Miledge account as the preferred R2 arrangement, subject to Tiizi-specific resource/credential isolation, separate non-production and production environments, least privilege, cost attribution/monitoring, and approval before resource creation, additional expenditure or production use.
- Obtain separate implementation/package and production authorization as applicable.

No responsible individual, legal conclusion, spend limit, resource approval, or completed operational assignment is inferred here. The Founder remains the final privacy-policy and expenditure authority. ChatGPT is assigned the Technical Lead function under FD-A; Coding Agent implementation and separate independent review roles remain distinct.

## 4. Technical status and cost note

The independent assessment `TIIZI-MEDIA-1-TECH-CONSULT-001` dated 2026-11-06 is an assessor report, not evidence of appointed backend/security or architecture-owner consultation. It recommended TD-01, TD-04 and TD-06 conditionally and identified a Challenge-creation transaction-time authorization gap. PR #159 merged and passed exact-head independent review, required CI and disposable PostgreSQL concurrency verification, so the transaction-time correction is verified. **TD-05 adoption remains on HOLD** pending attributable backend/security owner consultation, which is not present in this package. The R1 review verifies code; it is not owner consultation. Upload intents are not implemented, and their expiry/quota settings remain provisional. TD-01, TD-04 and TD-06 remain pending their formal consultation/adoption. The separate P5T `createTemplateDraft` authorization-revocation assessment is recorded in `TIIZI-FER-P5T-2-CREATE-TEMPLATE-DRAFT-AUTHORIZATION-REVOCATION-R2-PLAN-001`; it is not represented as the same defect or as a change to P5T scope.

FD-MC-07a selects R2 behind the provider-neutral ObjectStore interface. FD-B selects the Miledge Cloudflare account arrangement only; it does not authorize access, provisioning or spend. The existing MEDIA-1 assessment §10.2 provides illustrative low/expected/high R2 estimates at official rates checked 2026-11-06. Those are not a budget or committed forecast. Account-wide allowances are not presumed available; API compute, PostgreSQL, backups and monitoring remain excluded or unpriced as specified there.

MEDIA-1 remains open. No media-upload implementation, resource, migration, production access, expenditure or deployment is authorized by this brief. The bounded Challenge-creation authorization correction in PR #159 does not alter PRIV-01–06 or authorize MEDIA-1 uploads.
