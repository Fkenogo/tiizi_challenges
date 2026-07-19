# Tiizi Fitness, Wellness and Challenge Knowledge Model v2

**Status:** Approved Design Baseline
**Purpose:** Comprehensive implementation guidance
**Applies to:** Fitness activities, wellness activities, workouts, challenge policies, challenge templates, launched challenges, logging, progress, ranking, completion, recap, administration, governance, migration and testing.

## 1. Executive Summary

Tiizi will replace its separate fitness catalogue, wellness catalogue, template collections and distributed challenge rules with one governed system:

> **Tiizi Fitness, Wellness and Challenge Knowledge System**

The system has two layers:

1. **Knowledge and Policy Layer** — defines approved activities, exercises, workouts, metrics, safety rules, challenge eligibility and challenge policies.
2. **Challenge Runtime Layer** — executes launched challenge snapshots, participant state, validated activity events, progress, ranking, completion and recap.

The Knowledge and Policy Layer becomes the authoritative source for challenge creation. The runtime does not invent units, targets, completion rules, ranking methods or safety behavior.

The existing challenge templates and seeded challenges are test fixtures. They do not need to be preserved. The redesign may archive or remove them and replace them with Version 2 records.

## 2. Product Goals

The system must:

- Provide one trusted source for fitness and wellness activity knowledge.
- Support fitness exercises, wellness activities and structured workouts.
- Ensure challenge creation uses valid activity-specific policies.
- Prevent arbitrary or contradictory metric and unit combinations.
- Preserve clear differences between Collective, Competitive and Streak challenges.
- Remove hidden point-like scoring.
- Support safe, fair and understandable progress rules.
- Provide versioned snapshots for launched challenges.
- Make activity logging server-authoritative and idempotent.
- Support future verification without requiring it for the initial launch.
- Enable governed content creation, review, publication and deprecation.
- Support English and French content.

## 3. Non-Goals for Version 2 Initial Release

The initial release will not:

- Introduce a reward points wallet, XP balance or redemption system.
- Preserve existing test challenge instances or test template schemas.
- Support arbitrary user-defined metrics or units.
- Support medically diagnostic interpretation.
- Rank sensitive health measurements.
- Normalize unrelated activities into one competitive score.
- Support every possible wearable or device integration.
- Introduce a separate `individual` challenge type.
- Preserve legacy challenge behavior where it conflicts with the approved model.

## 4. Core Architectural Principle

### 4.1 Knowledge decides what is valid

The knowledge layer defines:

- what an item is
- how it is performed
- how it is measured
- who it is suitable for
- what safety rules apply
- which challenge types may use it
- which metrics and units are valid
- how progress is counted
- how completion is determined
- whether ranking is allowed
- what verification is required

### 4.2 Runtime executes approved policy

The runtime stores:

- the launched challenge configuration
- the selected approved policy
- immutable activity events
- participant progress
- collective progress
- ranking projections
- completion state
- final recap

The runtime must not accept values outside the selected policy.

## 5. Domain Model Overview

```text
KnowledgeItem
├── WellnessActivity
├── Exercise
└── Workout

KnowledgeItem
└── ChallengePolicy[]
    ├── CollectivePolicy
    ├── CompetitivePolicy
    └── StreakPolicy

ChallengeTemplate
└── references KnowledgeItem + ChallengePolicy

LaunchedChallenge
└── stores versioned immutable snapshot

ChallengeParticipant
└── stores membership and participant state

ActivityEvent
└── immutable validated user contribution

ProgressProjection
└── authoritative current progress

LeaderboardProjection
└── present only when ranking is enabled

ChallengeRecap
└── immutable final outcome
```

## 6. Shared Knowledge Item Model

Every activity, exercise and workout inherits a shared base model.

### 6.1 Identity

- `id`
- `schemaVersion`
- `contentVersion`
- `entityType`
- `slug`
- `status`
- `visibility`
- `canonicalName`
- `shortName`
- `aliases`
- `searchKeywords`
- `tags`

### 6.2 Classification

- `domain`
- `family`
- `category`
- `subcategory`
- `difficulty`
- `riskLevel`
- `audience`
- `bestFor`
- `chooseThisIf`

### 6.3 Content

- `summary`
- `about`
- `whyItHelps`
- `potentialBenefits`
- `preparation`
- `instructions`
- `tips`
- `commonMistakes`
- `safetySummary`
- `stopConditions`
- `notSuitableFor`

### 6.4 Measurement

- `supportedMetrics`
- `defaultMetric`
- `targetOptions`
- `targetCadenceOptions`
- `trackingMethodOptions`
- `verificationOptions`

### 6.5 Challenge Compatibility

- `challengePolicies`
- `publicChallengeEligible`
- `privateChallengeEligible`
- `templateEligible`
- `competitiveEligible`
- `collectiveEligible`
- `streakEligible`

### 6.6 Governance

- `evidenceLevel`
- `references`
- `reviewLevel`
- `reviewedBy`
- `reviewedAt`
- `nextReviewAt`
- `changeSummary`
- `supersedesVersion`
- `publicationChecksum`

### 6.7 Localization

- `sourceLanguage`
- `translations.en`
- `translations.fr`
- `translationStatus`
- `translationReviewedBy`
- `translationReviewedAt`

## 7. Wellness Activity Model

A Wellness Activity extends the shared Knowledge Item.

### 7.1 Additional fields

- `habitType`
- `timingOptions`
- `frequencyOptions`
- `protocol`
- `completionRule`
- `privacyClassification`
- `clinicalSensitivity`
- `contraindications`
- `pregnancyConsiderations`
- `medicationConsiderations`
- `eatingDisorderWarning`
- `professionalGuidanceRequired`

### 7.2 Examples

- Morning Water
- Gratitude Journal
- Consistent Bedtime
- 16:8 Time-Restricted Eating
- Blood Pressure Check
- Medication Check-In

### 7.3 Sensitive wellness rules

Sensitive health activities must:

- avoid diagnosis
- avoid treatment instructions
- avoid competitive ranking
- avoid public leaderboards
- default to private logging
- require stronger review
- use neutral, non-alarmist language
- clearly distinguish tracking from interpretation

## 8. Exercise Model

An Exercise extends the shared Knowledge Item.

### 8.1 Additional fields

- `movementPattern`
- `exerciseType`
- `laterality`
- `primaryMuscles`
- `secondaryMuscles`
- `equipment`
- `locationOptions`
- `impactLevel`
- `technicalComplexity`
- `balanceDemand`
- `mobilityPrerequisites`
- `strengthPrerequisites`
- `setup`
- `execution`
- `formCues`
- `breathing`
- `regressions`
- `progressions`
- `substitutions`
- `warmUpGuidance`
- `coolDownGuidance`
- `restGuidance`
- `tempoOptions`
- `intensityOptions`
- `loadOptions`

### 8.2 Exercise family relationships

Each exercise may define:

- `baseExerciseId`
- `variationType`
- `easierVariationIds`
- `harderVariationIds`
- `leftRightPairId`
- `equipmentVariationIds`
- `substitutionIds`

### 8.3 Example hierarchy

```text
Plank
├── Knee Plank
├── Forearm Plank
├── High Plank
├── Side Plank
│   ├── Left
│   └── Right
├── Single-Leg Plank
└── Arm-Lift Plank
```

Variants must not be treated as unrelated activities.

## 9. Workout Model

A Workout is a reusable structured sequence.

### 9.1 Workout fields

- `goal`
- `estimatedDuration`
- `difficulty`
- `equipment`
- `warmUpBlock`
- `mainBlocks`
- `coolDownBlock`
- `rounds`
- `restBetweenRounds`
- `substitutionRules`
- `completionRule`

### 9.2 Workout step fields

- `stepId`
- `knowledgeItemId`
- `knowledgeItemVersion`
- `order`
- `sets`
- `repetitions`
- `holdDuration`
- `distance`
- `load`
- `tempo`
- `workInterval`
- `restInterval`
- `side`
- `optional`
- `substitutionIds`

### 9.3 Naming correction

The current runtime collection named `workouts` stores activity logs. In Version 2:

- reusable routines are `WorkoutDefinition`
- completed user submissions are `ActivityEvent`

The legacy name should be retired or migrated.

## 10. Metric and Unit System

### 10.1 Metric types

Approved metric types include:

- completion
- sessions
- repetitions
- sets
- holdDuration
- activeDuration
- distance
- steps
- load
- totalVolume
- calories
- heartRateZoneDuration
- streakDays
- scheduledDaysCompleted
- qualitativeCheckIn
- trackedReading

### 10.2 Units

Units must be centrally governed.

Examples:

- seconds
- minutes
- hours
- repetitions
- sets
- metres
- kilometres
- miles
- steps
- kilograms
- pounds
- millilitres
- litres
- sessions
- days

### 10.3 Compatibility contract

Each Knowledge Item must define:

- allowed metrics
- allowed units per metric
- default metric
- default unit
- minimum target
- maximum target
- permitted target options
- target direction
- target cadence
- conversion rules
- whether custom values are allowed

The wizard must never present kilometres for a plank or kilograms for meditation.

### 10.4 Target direction

Supported directions:

- `higherIsBetter`
- `lowerIsBetter`
- `targetReached`
- `completionOnly`
- `withinRange`
- `consistency`

Sensitive health values should generally use `completionOnly` or private tracking, not “higher” or “lower” ranking.

## 11. Prescription Model

Fitness prescriptions must be structured.

### 11.1 Repetition prescription

```text
sets: 3
repetitions:
  minimum: 10
  maximum: 12
restSeconds:
  minimum: 45
  maximum: 60
```

### 11.2 Isometric prescription

```text
sets: 2
holdSeconds: 20
restSeconds: 45
```

### 11.3 Timed activity prescription

```text
durationMinutes: 30
intensity:
  type: RPE
  minimum: 4
  maximum: 6
```

### 11.4 Wellness prescription

```text
frequency:
  type: daily
timing:
  preferredWindow: morning
completion:
  type: checkedIn
```

Free-form strings must not be the authoritative prescription.

## 12. Challenge Scope

Challenge scope is separate from challenge type.

Supported scope:

- `group`
- `personal` — future capability

Version 2 initial release remains group-scoped.

## 13. Challenge Types

Tiizi retains three challenge concepts:

- Collective
- Competitive
- Streak

Each is implemented through an explicit versioned Challenge Policy.

## 14. Collective Challenge Policy

### 14.1 Product meaning

Participants contribute toward one shared group outcome.

### 14.2 Required fields

- `policyId`
- `policyVersion`
- `aggregationStrategy`
- `metric`
- `unit`
- `groupTarget`
- `memberContributionRules`
- `completionStrategy`
- `lateJoinPolicy`
- `correctionPolicy`
- `overTargetDisplay`
- `verificationRequirement`

### 14.3 Aggregation strategies

- `sum`
- `countCompletions`
- `countParticipantsCompleted`
- `countScheduledDays`
- `equivalentContribution`

### 14.4 Completion strategies

- `sharedTargetReached`
- `allParticipantsComplete`
- `minimumParticipantsComplete`
- `scheduledEnd`

### 14.5 Multi-activity rule

Multi-activity collective challenges are allowed only where:

- all items share one canonical metric, or
- an approved equivalence policy exists

Matching unit text alone is not sufficient.

## 15. Competitive Challenge Policy

### 15.1 Product meaning

Participants are ranked using one fair and explicit performance method.

### 15.2 Required fields

- `policyId`
- `policyVersion`
- `metric`
- `unit`
- `rankingStrategy`
- `rankingDirection`
- `tieStrategy`
- `verificationRequirement`
- `minimumParticipation`
- `finalizationRule`
- `publicLeaderboardAllowed`

### 15.3 Ranking strategies

- `highestTotal`
- `lowestValidTime`
- `highestCompletionPercentage`
- `earliestCompletion`
- `highestConsistency`
- `greatestPersonalImprovement`

### 15.4 Tie strategies

- shared rank
- earliest achievement
- highest verified count
- admin adjudication
- no winner

### 15.5 Initial launch restrictions

Competitive challenges should initially support only fair, simple comparison:

- steps
- distance
- completion percentage against the same target
- verified completion time
- completed sessions

Do not rank medically or behaviorally sensitive outcomes.

### 15.6 Single authority

Every competitive challenge has one authoritative ranking strategy. Home, feed, detail and recap must read the same leaderboard projection.

## 16. Streak Challenge Policy

### 16.1 Product meaning

Participants repeatedly complete a defined obligation.

### 16.2 Required fields

- `policyId`
- `policyVersion`
- `cadence`
- `dailyCompletionPredicate`
- `minimumThreshold`
- `requiredActivitiesRule`
- `timezone`
- `gracePolicy`
- `missedDayPolicy`
- `requiredCount`
- `completionStrategy`

### 16.3 Daily completion predicates

- `anyOneActivity`
- `allActivities`
- `minimumActivityCount`
- `combinedThreshold`
- `completeWorkout`
- `completeScheduledRoutine`

### 16.4 Cadence

- daily
- selected weekdays
- times per week
- custom schedule

### 16.5 Missed-day policies

- reset
- consume grace day
- continue consistency count

### 16.6 Terminology rule

A non-consecutive count is not a streak. Use `Consecutive Streak` and `Scheduled Consistency` as separate concepts.

## 17. Challenge Eligibility Model

Each Knowledge Item defines eligibility.

### 17.1 Eligibility fields

- `collective.allowed`
- `competitive.allowed`
- `streak.allowed`
- `public.allowed`
- `private.allowed`
- `manualLogging.allowed`
- `verificationRequired`
- `minimumAge`
- `restrictedPopulations`
- `professionalGuidanceRequired`

## 18. Challenge Template Model

One unified template model replaces separate fitness and wellness templates.

### 18.1 Template fields

- `id`
- `templateVersion`
- `status`
- `ownershipType`
- `name`
- `description`
- `knowledgeItemId`
- `knowledgeItemVersion`
- `challengePolicyId`
- `challengePolicyVersion`
- `defaultDuration`
- `allowedDurationOptions`
- `defaultTargetOption`
- `audience`
- `visibility`
- `image`
- `reminderDefaults`
- `safetyCopy`
- `createdBy`
- `reviewedBy`
- `publishedAt`

### 18.2 Ownership types

- system
- admin
- organization
- demo

### 18.3 Lifecycle

- draft
- inReview
- approved
- published
- deprecated
- archived

## 19. Launched Challenge Snapshot

A launched challenge stores a complete versioned snapshot.

### 19.1 Required snapshot fields

- `challengeId`
- `engineVersion`
- `templateId`
- `templateVersion`
- `knowledgeItemId`
- `knowledgeItemVersion`
- `knowledgeChecksum`
- `challengePolicyId`
- `challengePolicyVersion`
- `challengeType`
- `scope`
- `groupId`
- `name`
- `description`
- `startAt`
- `endAt`
- `timezone`
- `metric`
- `unit`
- `target`
- `completionRule`
- `rankingRule`
- `verificationRule`
- `safetySummary`
- `visibility`
- `status`
- `createdBy`
- `createdAt`

### 19.2 Snapshot principle

Once launched, core policy, metric, unit, ranking and completion rules are immutable.

## 20. Challenge Creation Wizard

### Step 1 — Choose the experience

- Work Together
- Friendly Competition
- Build a Streak

### Step 2 — Choose the activity or workout

The knowledge engine filters eligible records based on challenge type.

### Step 3 — Choose an approved format

The user selects an available Challenge Policy.

### Step 4 — Personalize

Editable:

- challenge name
- description
- image
- group
- start date
- duration
- visibility
- reminders

Controlled:

- target option
- unit
- cadence
- completion rule
- ranking rule

### Step 5 — Review

Show clearly:

- what participants must do
- how progress is counted
- how completion works
- how ranking works
- whether logs are self-reported
- safety notes
- timezone
- privacy

## 21. Activity Logging Model

### 21.1 Server-authoritative logging

Clients submit a log request. The server validates authentication, active membership, challenge status, date window, activity identity, policy identity, metric, unit, value bounds, cadence, idempotency and verification requirements.

### 21.2 Activity Event

- `eventId`
- `challengeId`
- `participantId`
- `knowledgeItemId`
- `knowledgeItemVersion`
- `policyId`
- `metric`
- `unit`
- `value`
- `occurredAt`
- `challengeDate`
- `timezone`
- `verificationStatus`
- `source`
- `submittedAt`
- `idempotencyKey`
- `status`

### 21.3 Event status

- accepted
- pendingVerification
- rejected
- corrected
- voided

### 21.4 Corrections

Do not directly edit or delete accepted events. Use correction, void, replacement or administrative review events.

## 22. Verification Model

### 22.1 Verification methods

- selfReported
- device
- wearable
- photo
- admin
- partnerSystem
- none

### 22.2 Verification statuses

- notRequired
- pending
- verified
- rejected
- expired

## 23. Progress Model

Keep separate:

- raw activity value
- progress percentage
- completion state
- ranking value
- reward points

Reward points are not part of Version 2. Remove hidden normalized points, `pts` copy, points-based tie-breaking and points-based feed ordering.

## 24. Leaderboard Model

Only Competitive challenges require a leaderboard by default.

### 24.1 Fields

- `challengeId`
- `rankingStrategy`
- `rankingDirection`
- `entries`
- `projectionVersion`
- `calculatedAt`
- `finalized`

### 24.2 Authority

Home, feed, detail and recap must use the same projection.

## 25. Completion and Finalization

Finalization should:

- stop new normal activity events
- calculate final progress
- calculate final leaderboard
- determine ties
- create immutable recap
- update challenge status
- update participant final states
- emit completion feed event

## 26. Runtime Collections

Recommended collections:

```text
knowledgeItems
challengePolicies
challengeTemplates
challenges
challengeParticipants
challengeActivityEvents
challengeProgress
challengeLeaderboards
challengeRecaps
```

Optional:

```text
knowledgeDrafts
knowledgeReviews
challengeEventCorrections
```

## 27. Security Requirements

Clients must not directly write participant aggregate progress, challenge completion, collective totals, leaderboard values, recap records, verified status or ranking values.

Trusted server code controls challenge creation, membership validation, event acceptance, progress calculation, leaderboard projection, completion, recap and corrections.

## 28. Time and Timezone Rules

Every launched challenge stores one timezone. It governs start/end, streak days, reminders, finalization and late submissions.

## 29. Content Standard

Every activity must answer:

1. What is it?
2. Why might it help?
3. How do I do it?
4. Is it suitable for me?
5. How does Tiizi measure it?
6. Which challenges can use it?

Fitness additions include setup, execution, form cues, breathing, mistakes, progression, regression, substitution, warm-up, cooldown, rest, intensity and recovery.

## 30. Governance Workflow

### 30.1 Roles

- Author
- Reviewer
- Wellness Reviewer
- Fitness Reviewer
- Clinical Reviewer
- Publisher
- Administrator

### 30.2 Workflow

```text
Draft
→ In Review
→ Changes Requested
→ Approved
→ Published
→ Deprecated
→ Archived
```

## 31. Fitness Catalogue Rationalisation

All 154 fitness records must be reviewed using:

- Keep
- Rename
- Merge
- Convert to Variant
- Split
- Reclassify
- Restrict
- Retire

Each record must receive a canonical V2 ID, family, base exercise, variation relationship, metric contract, safety tier, challenge eligibility, review requirement and migration disposition.

## 32. Wellness Catalogue Finalisation

The approved wellness matrix must be extended with canonical V2 ID, challenge eligibility, approved policies, metric contract, target constraints, privacy, verification, safety tier and review requirement.

The two longer fasting additions are included as restricted activities:

- 24-Hour Fast
- Multi-Day Fast

## 33. Reference Records

Approve at least:

1. Daily Steps
2. Morning Water
3. 30-Minute Walk
4. Forearm Plank
5. Bodyweight Squat
6. Beginner Full-Body Circuit
7. Consistent Bedtime
8. Gratitude Journal
9. 16:8 Time-Restricted Eating
10. Blood Pressure Check
11. 48-Hour Fast
12. Wall-Supported Handstand

## 34. Migration Strategy

Use a reset-first strategy because existing challenges and templates are test data.

Preserve approved research and useful scenarios. Archive or remove test templates, test challenges, legacy memberships, logs tied to test challenges, summaries, leaderboards, feed projections and legacy point fields.

Cleanup must be environment-scoped, dry-run by default, backed up, explicitly approved and auditable.

## 35. Seed Strategy

Retire challenge/template creation from the current general seed script.

Replace it with isolated demo fixtures, environment protection, dry-run default, explicit apply mode, test namespaces, schema validation and no overwrite of managed content.

## 36. Implementation Programme

### Phase 1 — Documentation Baseline

- master model
- field dictionary
- taxonomy
- challenge policy standard
- content standard

### Phase 2 — Catalogue Rationalisation

- fitness matrix
- updated wellness matrix
- overlap reconciliation
- canonical IDs

### Phase 3 — Gold-Standard Records

- reference activities
- reference exercise
- reference workout
- reference policies
- reference templates

### Phase 4 — Technical Schema

- shared types
- validators
- controlled enums
- versions
- checksums
- policy schemas

### Phase 5 — Security Foundation

- server-authoritative creation and logging
- Firestore rules
- idempotency
- correction model

### Phase 6 — Runtime Foundation

- snapshots
- participants
- events
- progress
- leaderboard
- finalization
- recap

### Phase 7 — Admin Knowledge Management

- drafts
- review
- publication
- versioning
- deprecation
- translation review

### Phase 8 — Challenge Wizard

- type selection
- eligible item filtering
- policy selection
- controlled target selection
- review and launch

### Phase 9 — Content Production

- launch-safe wellness activities
- launch-safe fitness exercises
- initial workouts
- initial templates

### Phase 10 — Reset and Launch

- backup
- cleanup
- V2 publication
- end-to-end verification
- deployment

## 37. Acceptance Criteria

The implementation is not complete until:

- one unified knowledge system exists
- every published item passes schema validation
- every challenge uses an approved policy
- arbitrary units cannot be selected
- competitive ranking is authoritative in one projection
- streak completion is explicit
- hidden points are removed
- client aggregate forgery is prevented
- activity events are idempotent
- corrections rebuild projections correctly
- launched challenges preserve versions
- test templates and challenges are removed or isolated
- English and French content are supported
- restricted activities follow review requirements
- end-to-end tests cover all three challenge types

## 38. Required Test Coverage

### Knowledge tests

- schema validation
- taxonomy
- metric compatibility
- unit compatibility
- challenge eligibility
- version/checksum validation

### Wizard tests

- type-specific filtering
- policy controls
- invalid combination rejection
- review accuracy
- template prefill
- launch snapshot

### Runtime tests

- duplicate rejection
- correction event
- collective aggregation
- competitive ranking
- streak calculation
- timezone boundary
- terminal event inclusion
- finalization
- recap immutability

### Security tests

- unauthorized aggregate write
- cross-challenge log
- invalid unit
- invalid metric
- inactive membership
- ended challenge
- restricted health visibility
- unauthorized projection read

## 39. Open Design Decisions

1. Which activities require verification for competition?
2. Whether all competitive challenges require the same target.
3. Whether collective challenges allow late joiners by default.
4. Whether creators choose target ranges or fixed approved options.
5. Default challenge timezone behavior.
6. Grace-day policy for consecutive streaks.
7. Whether late activity submissions are allowed.
8. Whether organization-specific templates are included initially.
9. Whether personal challenges are immediate or deferred.
10. Which 30–50 activities form the launch catalogue.

## 40. Approved Design Decisions

- Retain Collective, Competitive and Streak.
- Do not add Individual as a fourth engine initially.
- Use one unified fitness and wellness template system.
- Create a real Workout entity.
- Remove hidden point-like scoring.
- Use explicit progress and ranking values.
- Use approved activity-specific challenge policies.
- Use immutable, server-validated activity events.
- Store versioned launched challenge snapshots.
- Do not preserve existing test templates and challenges.
- Use one authoritative competitive leaderboard.
- Make streak completion explicit and policy-driven.
- Separate Knowledge and Policy from Runtime execution.
