# WEL-SLP-002 / WEL-SLP-003 --- Bedtime & Wake Time

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Document type:** Representative canonical-identity review\
**Status:** Founder/Product working finding --- baseline identities
should be reconsidered before publication\
**Domain:** Wellness\
**Category:** Sleep & Recovery\
**Baseline classification:** Sleep Routine\
**Baseline measurement:** Completion → completion

## 1. Source Baseline

The Founder Working Baseline currently defines two separate canonical
Activity candidates:

-   `WEL-SLP-002` --- **Bedtime** --- Sleep Routine ---
    `Completion → completion`
-   `WEL-SLP-003` --- **Wake Time** --- Sleep Routine ---
    `Completion → completion`

This exemplar deliberately tests whether those entries satisfy the Tiizi
Activity Content Standard rather than assuming that every baseline
candidate must survive unchanged.

## 2. Canonical Activity Test

A Tiizi canonical Activity should represent a concrete undertaking that
can be independently selected, understood, performed and reported.

The initial question is therefore not:

> How do we write better descriptions for Bedtime and Wake Time?

It is:

> What exactly is the participant doing when they select the Activity?

### Bedtime

"Bedtime" ordinarily identifies a **time or condition** associated with
going to bed.

A Challenge might say:

> Go to bed by 10:30 PM.

In that case: - "go to bed" is the participant action; - `10:30 PM` is a
Challenge-selected condition; - "Done" means the participant affirms
that the configured condition was met.

The canonical identity **Bedtime** risks naming the configurable
condition rather than the underlying Activity.

### Wake Time

The same issue exists for Wake Time.

A Challenge might say:

> Wake up by 6:30 AM.

Here: - "wake up" is the occurrence/action; - `6:30 AM` is the
Challenge-selected condition; - Completion indicates whether the
configured condition was met.

Again, **Wake Time** risks encoding the Challenge condition as the
Activity identity.

## 3. Why This Matters

The Activity Content Standard deliberately excludes targets, schedules
and time conditions from canonical Activity identity.

If Bedtime and Wake Time are published as Activities without clarifying
this distinction, Tiizi could end up with canonical records whose
meaning depends on a Challenge-supplied clock time.

That would weaken the intended chain:

`Canonical Activity → valid measurement/condition → Challenge Definition`

by putting the condition into the Activity name itself.

## 4. Working Product Finding

**Do not author `Bedtime` and `Wake Time` as publication-ready canonical
Activities yet.**

The baseline entries should be reconsidered during catalogue
reconciliation.

There are at least two possible models.

### Model A --- Concrete routine Activities

Tiizi could establish concrete canonical Activities such as:

-   **Go to Bed**
-   **Wake Up**

The Challenge Definition would then provide a governed clock-time
condition.

Conceptually:

`Go to Bed → Completion` +
`Challenge condition → by configured local time`

and:

`Wake Up → Completion` +
`Challenge condition → by configured local time`

This preserves the Activity/Challenge boundary better than naming the
Activities after the condition.

### Model B --- Challenge conditions without standalone Activities

If Tiizi determines that "bedtime" and "wake time" are fundamentally
temporal conditions rather than reusable Activities, they may belong in
Challenge Definition/Template configuration rather than the canonical
Activity catalogue.

Under that model, a sleep-routine Challenge could evaluate governed
temporal conditions without pretending that every condition is itself an
Activity.

## 5. No Premature Choice Between Models

This exemplar does not make the final PF-03 architecture decision.

The important finding is narrower:

> The existing `Bedtime` and `Wake Time` baseline identities are not
> sufficiently clear to move directly to publication.

PF-03 Challenge Definition should determine how governed time-of-day
conditions attach to participant undertakings.

The catalogue should then reconcile these two baseline candidates
accordingly.

## 6. Completion Semantics

If Tiizi retains a concrete underlying Activity, `Completion` can be
meaningful only if it answers a clear question.

For example:

> Did you complete the configured go-to-bed condition?

or:

> Did you complete the configured wake-up condition?

But Completion alone cannot carry the clock-time rule.

The Challenge must own: - the target clock time; - timezone; -
applicable day/period; - whether the condition means "by," "at,"
"within," or another governed relationship; - any allowed tolerance if
Tiizi ever supports one.

The Activity must not invent those rules.

## 7. Timezone Requirement

Bedtime/wake-time Challenges make the governing Challenge timezone
materially important.

A clock-time condition is not interpretable from a bare local time
without the Challenge's governed temporal context.

This reinforces the existing principle that temporal Challenge semantics
belong to the Challenge configuration/engine rather than Activity
Knowledge.

## 8. Reporting and Evidence Boundary

If the future model uses self-reported Completion, the participant
affirms that the configured condition was met.

Tiizi should not imply that it objectively detected: - when the
participant went to bed; - when the participant fell asleep; - when the
participant woke; - whether they left bed; - whether the configured time
condition was actually satisfied,

unless a separately governed evidence mechanism establishes that
capability.

## 9. Health and Guidance Boundary

Neither Bedtime nor Wake Time should embed a universal "healthy" clock
time.

Canonical Knowledge must not prescribe that every participant should go
to bed or wake at a particular hour.

A Challenge creator's configured time is a Challenge condition, not a
universal Tiizi health recommendation.

## 10. Relationship to Sleep

`WEL-SLP-001 Sleep` remains conceptually distinct.

Sleep concerns the participant's reported sleep occurrence/duration.

Bedtime/wake-time concepts concern temporal boundaries or routines
around that occurrence.

They should not be merged into Sleep merely to avoid resolving their own
semantics.

## 11. Readiness Assessment

### `WEL-SLP-002 Bedtime`

**Content status:** Draft / identity reconsideration required\
**Challenge eligibility:** Not yet eligible\
**Reason:** Current name appears to represent a temporal condition more
than a sufficiently defined canonical Activity.

### `WEL-SLP-003 Wake Time`

**Content status:** Draft / identity reconsideration required\
**Challenge eligibility:** Not yet eligible\
**Reason:** Same boundary problem as Bedtime.

### Verification

No Verification Authority is established.

## 12. Representative-Catalogue Finding

This is the first representative exercise where the correct outcome is
**not** "publication-ready candidate."

That is valuable.

The 118-Activity Founder Working Baseline is a governed candidate
baseline, not an obligation to publish every candidate unchanged.

Bedtime and Wake Time demonstrate why catalogue authoring must test:

1.  Is this genuinely an Activity?
2.  Is the name the undertaking or a Challenge condition?
3.  Can Completion be explained without importing the target into
    Activity identity?
4.  Does the concept require a new Challenge condition type rather than
    more Activity fields?

## 13. Carry-Forward to PF-03

PF-03 Challenge Definition should explicitly evaluate a governed
**time-of-day condition** capability.

The bounded question is:

> Can a Challenge attach a timezone-aware clock-time condition to an
> eligible participant undertaking without encoding that clock time into
> canonical Activity identity?

Once that is settled, the catalogue can decide whether to: -
rename/reframe `WEL-SLP-002` and `WEL-SLP-003` as concrete Activities; -
retain them under a clearer semantic contract; or - remove them from
canonical Activity publication and represent the concepts at the
Challenge layer.

No implementation change is authorized by this exemplar.
