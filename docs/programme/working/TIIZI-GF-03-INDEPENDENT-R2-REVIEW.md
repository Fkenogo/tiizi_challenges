# TIIZI — GF-03 Independent R2 Review Record

**Package:** GF-03 — Group Feed member read boundary
**Classification:** R2 — Independent high-rigor review
**Disposition:** **R2 REVIEW — FINDING OPEN (P2)**
**PR:** #76 — OPEN / DRAFT / UNMERGED
**Canonical base:** `ec4a6385ad59f75415cf48480cfc9fb149d265ee`
**Exact implementation reviewed:** `e8958e6b881c3998cad178ed7ca65875a503daab`
**Review date:** 2026-10-05
**Independent reviewer session:** Codex agent session `/root/gf03_r2_final_review`, distinct from the implementing `/root` session; read-only review.

## Scope and evidence inspected

The reviewer inspected the exact eight-file GF-03 implementation diff from the canonical base, including route/auth wiring, the read service, focused security tests, configuration/documentation, and programme records. The reviewed implementation head is PR #76's head. No later implementation-code commit exists; the reconciliation commit is documentation-only.

Review scope included:

1. Firebase authentication and Tiizi Member identity chain.
2. Current Group active-state and `active`/`joined` membership enforcement, including Steward parity.
3. Generic 404 denial and privacy posture.
4. Cross-Group path, query, event, cursor, and navigation isolation.
5. Current source Challenge existence and Challenge/Group binding.
6. Historical-event validity across normal Challenge lifecycle progression.
7. Cursor HMAC signing, Group/contract binding, malformed input, tampering, and expiry.
8. Membership revocation between pages.
9. Suppression and inclusive 90-day retention.
10. Ended/finalized consolidation eligibility and page-boundary behavior.
11. `Cache-Control: private, no-store` semantics.
12. Fixed response allowlist and disclosure minimization.
13. GF-04/UI and other explicit scope exclusions.

Evidence for exact head `e8958e6b881c3998cad178ed7ca65875a503daab`:

- GitHub Actions repository checks: all six passed, including API typecheck/test/build, API image, web, functions, API namespace contract, and boundary guard.
- Direct focused GF-03 rerun at this exact head: **20 passed / 1 failed**. The failing cursor test changed only the final base64url signature character; the decoder accepted the altered string because it decoded to the same HMAC bytes.
- Full API suite: **847 passed / 8 existing Firestore-emulator-dependent tests skipped** on code-identical implementation parent `0115513812a1bfa4cc225be0954ab18e824d6c5f`; the later change before `e8958e6` was documentation-only. GitHub's API test job passed on exact head, but its check output does not provide a test count.
- API typecheck and build: pass on exact head through the passing GitHub API check; local typecheck/build also passed on the code-identical implementation parent.
- Repository boundary guard and root build: pass through the exact-head GitHub boundary/functions checks.
- `git diff --check`: pass on the implementation diff.
- Cloudflare Workers Builds: failed separately; GitHub exposed only its build ID and no diagnostic text. It remains the existing non-gating external check.
- Migration 025 remains undeployed; no production deployment occurred.

## Finding

**P2 — Noncanonical base64url cursor signature aliases are accepted.**

The cursor decoder base64url-decodes the supplied signature and compares the resulting bytes to the expected HMAC. A modified, noncanonical final base64url character can decode to the same signature bytes because the terminal encoding contains unused pad bits. The altered cursor string is therefore accepted. This does not forge an HMAC, alter the signed payload, or bypass membership authorization, but it violates the explicit tampered-cursor rejection contract and makes the focused tampering proof nondeterministically fail.

**Required correction:** require canonical base64url encodings for both cursor body and signature (strict alphabet/length and decode-then-re-encode equality), then retain a test that mutates only unused terminal bits. Re-run focused and full validation and obtain independent R2 review of the corrected implementation head.

## Disposition and controls

The independent review's initial static pass reported no findings. Exact-head automated validation then exposed the cursor edge; the independent reviewer reassessed it and classified it as this P2 contract/security-robustness finding. **R2 is not PASS.**

PR #76 remains OPEN / DRAFT / UNMERGED. Do not mark ready for review, merge, deploy, or start GF-04 until the finding is corrected and independently re-reviewed. No implementation code was changed in this evidence-reconciliation task. GF-04/UI, Today, Kudos, Share, Recognition, migration 025 deployment, and production deployment remain out of scope.
