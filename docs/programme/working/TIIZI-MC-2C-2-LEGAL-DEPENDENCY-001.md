# TIIZI MC-2C-2 — Legal presentation dependency (working record)

Status: **OPEN — dependency not satisfied. MC-2 legal presentation is not accepted as complete.**
Recorded by: MC-2C-2 implementation slice.
Authority: `docs/programme/TIIZI-MC-2-PROFILE-FOUNDATION-READINESS-001.md` §11
(Founder legal disposition CORR-002) and the MC-2C-2 entry brief.

## Missing dependency (exact)

The repository contains **no Founder-approved final Terms of Service content and no
Founder-approved final Privacy Policy content**, and no Founder-approved external legal
destinations (URLs) for the V2 product. No approved legal version identifiers are present
either.

Consequently MC-2C-2 does **not** implement substantive legal presentation. No legal
wording, version identifier, re-acceptance policy, retention period, deletion SLA, or
consent record has been invented.

## What this slice did instead

- Removed the V2 sign-up surface's links to the archived V1 `/terms` and `/privacy`
  screens. Those routes are V1-owned and would route a V2 member into the frozen V1
  product, which §11 prohibits.
- The V2 sign-up surface now states the dependency honestly ("Terms and Privacy are not
  published yet") and offers no control or link that implies content that does not exist.
- No placeholder legal text, copied V1 wording, fabricated URL, or V2 legal route was
  added.

## Acceptance consequence

MC-2 (and therefore MC-2C-2 final acceptance) cannot close while this required legal
presentation remains unresolved. Final acceptance is conditional on the Founder supplying
approved V2 legal content or explicitly approved external destinations; presentation must
then use V2-owned surfaces or those approved destinations. This dependency does not block
the identity, account-switch, sign-out, or name-consumer capabilities implemented in this
slice.
