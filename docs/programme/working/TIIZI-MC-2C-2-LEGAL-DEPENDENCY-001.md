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

## Minimum Founder inputs required

Until the following are supplied, this dependency remains OPEN and no legal presentation
may be implemented or accepted:

1. Founder-approved final Terms of Service content for V2, **or** explicit approval of an
   exact external destination that hosts that content.
2. Founder-approved final Privacy Policy content for V2, **or** explicit approval of an
   exact external destination that hosts that content.
3. If an external destination is approved: the exact URL(s), confirmation that each is the
   authoritative V2 destination (not a V1 destination), and confirmation that the V2
   surface may link to it.
4. The legal version identifier(s) to present, if any, and the effective date. Whether
   versioned presentation or re-acceptance is required is itself a Founder decision and
   must not be inferred.
5. Confirmation that the supplied content or destination is final and approved for
   presentation at V2 sign-up.

No legal wording, placeholder, URL, version identifier, or acceptance mechanism may be
inferred from this record. Any consent or re-acceptance mechanism is outside MC-2C-2 and
belongs to MC-3 governance; this record neither creates nor authorizes one.

## Acceptance consequence

MC-2 (and therefore MC-2C-2 final acceptance) cannot close while this required legal
presentation remains unresolved. Final acceptance is conditional on the Founder supplying
approved V2 legal content or explicitly approved external destinations; presentation must
then use V2-owned surfaces or those approved destinations. This dependency does not block
the identity, account-switch, sign-out, or name-consumer capabilities implemented and
merged in this slice (PR #100, merge `1ab04327d417cd17856ed0e8d0a30f29035c214a`).
