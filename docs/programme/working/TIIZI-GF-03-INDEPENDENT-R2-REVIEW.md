# TIIZI — GF-03 Independent R2 Review Record

**Package:** GF-03 — Group Feed member read boundary
**Classification:** R2 — Independent high-rigor review
**Disposition:** **R2 REVIEW — PASS / P2 FINDING CLOSED**
**PR:** #76 — OPEN / READY FOR REVIEW / UNMERGED (after reconciliation)
**Canonical base:** `ec4a6385ad59f75415cf48480cfc9fb149d265ee`
**Exact implementation reviewed:** `e8958e6b881c3998cad178ed7ca65875a503daab`
**Corrected technical SHA independently re-reviewed:** `875e33780f9a2ed400be33e517fa4863e7a3e08d`
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

## Correction and independent re-review

The correction at `875e33780f9a2ed400be33e517fa4863e7a3e08d` adds strict unpadded base64url validation for both cursor segments: nonempty `[A-Za-z0-9_-]+`, decode, then exact decode/re-encode equality. Validation runs before HMAC and JSON payload checks. HMAC-SHA-256 and length-checked `timingSafeEqual` are unchanged; callers still receive only `invalid_cursor` for malformed cursor inputs.

Focused regression coverage proves: (a) a changed terminal signature character decodes to the same signature bytes yet is rejected; (b) a body terminal-bit alias with a recomputed valid HMAC is rejected; (c) padding, ordinary signature mutation, cross-Group cursor, page-size mismatch, expiry, and unsupported version are rejected; and (d) an issued cursor round-trips successfully.

Correction validation at the corrected technical tree: focused GF-03 **21/21 passed**; full API suite **847 passed / 8 existing Firestore-emulator-dependent skipped**; API typecheck/build passed; root boundary guard and root build passed; `git diff --check` passed. All six GitHub Actions repository checks passed on the corrected SHA, including API typecheck/test/build. Cloudflare Workers Builds failed separately with no diagnostic details and remains non-gating.

Independent reviewer session `/root/gf03_r2_final_review` re-reviewed exact corrected SHA `875e33780f9a2ed400be33e517fa4863e7a3e08d` against base `ec4a6385ad59f75415cf48480cfc9fb149d265ee`. The reviewer confirmed canonical validation for body and signature, unchanged HMAC/timing-safe verification and generic error behavior, the regression proofs, and absence of unrelated boundary changes. Result: **R2 REVIEW — PASS / P2 FINDING CLOSED / NO NEW FINDINGS**. Review was static; the reviewer did not rerun tests.

## Finding

**Original P2 finding — CLOSED: noncanonical base64url cursor signature aliases were accepted.**

The cursor decoder base64url-decodes the supplied signature and compares the resulting bytes to the expected HMAC. A modified, noncanonical final base64url character can decode to the same signature bytes because the terminal encoding contains unused pad bits. The altered cursor string is therefore accepted. This does not forge an HMAC, alter the signed payload, or bypass membership authorization, but it violates the explicit tampered-cursor rejection contract and makes the focused tampering proof nondeterministically fail.

**Correction applied:** canonical base64url encodings are required for both cursor body and signature (strict alphabet and exact decode-then-re-encode equality). Focused and full validation passed, and independent R2 re-review closed the finding on the corrected technical SHA above.

## Disposition and controls

The initial static pass reported no findings; exact-head automated validation exposed the cursor edge; follow-up independent review classified it as P2; the correction and exact-head re-review have now closed it. **R2 REVIEW — PASS / P2 FINDING CLOSED.**

PR #76 may be marked READY FOR REVIEW after this evidence update; it remains unmerged. Founder acceptance remains pending. Migration 025 is undeployed; no production deployment occurred. GF-04/UI remains not started/not authorized, and Today, Kudos, Share, and Recognition remain excluded.
