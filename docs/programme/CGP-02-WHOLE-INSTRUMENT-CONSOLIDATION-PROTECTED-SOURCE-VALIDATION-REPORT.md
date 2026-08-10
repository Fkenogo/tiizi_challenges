# CGP-02 Whole-Instrument Consolidation — Protected Source Validation Report

**Baseline validated:** [Protected Source Baseline](CGP-02-WHOLE-INSTRUMENT-CONSOLIDATION-PROTECTED-SOURCE-BASELINE.md)

**Document type:** Programme-governance validation evidence

**Status:** Protected-source validation passed; consolidation not authorized

**Validation date:** 2026-07-25

## 1. Purpose

This report validates the identity, digest, proposition and status evidence recorded in the Protected Source Baseline. It validates the baseline only; it does not validate a consolidated instrument or authorize consolidation.

## 2. Source-Existence Verification

| Source class | Expected | Found | Result |
|---|---:|---:|---|
| Normative protected dependencies | 3 | 3 | Pass |
| Bounded constitutional sources | 14 | 14 | Pass |
| Bounded Founder decision records | 14 | 14 | Pass |
| Bounded approval candidates or candidate-equivalent sources | 14 | 14 | Pass |
| Founder Approved bounded instruments | 1 | 1 | Pass |

## 3. SHA-256 Verification

Every protected source was read directly from the repository and hashed as exact bytes using SHA-256. All seventeen computed hashes match the values recorded in the baseline.

| Check | Result |
|---|---|
| Normative-source hashes | 3/3 match |
| Bounded-source hashes | 14/14 match |
| Missing hash | None |
| Duplicate source path | None |
| Source changed during baseline preparation | None |

A digest records file integrity only. It does not create approval, adoption, constitutional effect or precedence.

## 4. Proposition Verification

| Check | Result |
|---|---|
| Bounded proposition total | 302 |
| Unique proposition identifiers | 302 |
| Duplicate proposition identifiers | 0 |
| Recorded range endpoints present | 14/14 |
| Proposition count matches protected source | 14/14 |
| Proposition identifier order preserved within each source | 14/14 |
| Proposition renumbering performed | No |
| Constitutional wording modified | No |

The three normative dependencies are not proposition-numbered CGP-02 source packages and therefore have no artificial proposition count or range.

## 5. Status-Parity Verification

Status was compared against source metadata, Founder decision records, the [Consolidated Decision Register](../reports/platform-foundation-decisions/10-CONSOLIDATED-DECISION-REGISTER.md), bounded completion evidence and [Master Programme Version 1.20](TIIZI-V2-MASTER-PROGRAMME.md).

| Status control | Result |
|---|---|
| Candidate status preserved | Pass |
| CGP-02C.4 Founder Approved status preserved | Pass |
| Adoption status preserved | Pass |
| Constitutional-effect status preserved | Pass |
| Candidate-level Founder decisions distinguished from instrument approval | Pass |
| Normative dependency status preserved without invented metadata | Pass |
| Status normalization introduced | No |

CGP-02C.1 through CGP-02C.3 are not represented in the supplemental CGP work-package table in the Consolidated Decision Register. Their source metadata and Founder decision records remain the attributable status evidence; this omission must remain visible during whole-instrument status and decision-trace preparation.

## 6. Protected-Source Modification Check

The task created new programme evidence only. It did not edit:

- any normative constitutional source;
- any bounded Founder Review Draft;
- any bounded Founder Approval Candidate;
- the CGP-02C.4 Founder Approved instrument;
- any Founder decision record;
- any completion or validation report;
- the Master Programme; or
- the Consolidated Decision Register.

## 7. Validation Verdict

**Passed.** The Protected Source Baseline is complete and internally consistent for authorization review:

- all protected sources exist;
- all hashes are captured;
- all 302 bounded proposition identifiers are unique and unchanged;
- all proposition counts match;
- source statuses remain distinguishable; and
- no protected source was modified.

This verdict authorizes no consolidation and does not waive the requirement to recheck every protected hash immediately before consolidation begins.
