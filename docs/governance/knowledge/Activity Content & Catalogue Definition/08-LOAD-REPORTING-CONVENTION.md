# Tiizi V2 Load Reporting Convention

**Working package:** Tiizi V2 Activity Content & Catalogue Definition\
**Section:** 08\
**Status:** Founder/Product settled convention (PF-02-CORR-001 implementation basis)\
**Purpose:** Settle what a reported Weight value means so a historical
Weight value remains interpretable without inventing load semantics.

## 1. Position

Weight remains one governed Metric alongside Completion, Repetitions,
Duration, Distance and Quantity.

Weight currently means governed external load.

## 2. Load Reporting Basis

Every Challenge-eligible Weight configuration carries one explicit Load
Reporting Basis.

The initial authorized vocabulary is ONLY:

1. `TOTAL_LOADED_IMPLEMENT`
2. `PER_IMPLEMENT`
3. `SINGLE_IMPLEMENT`
4. `PER_SIDE`
5. `MACHINE_DISPLAYED_LOAD`

### TOTAL_LOADED_IMPLEMENT

Total external load of one loaded implement.

Example: barbell total including bar + plates.

### PER_IMPLEMENT

Weight of one matching implement.

Example: 20 kg means each dumbbell is 20 kg.

Do NOT silently total paired implements.

### SINGLE_IMPLEMENT

Weight of the one external implement being used.

### PER_SIDE

External load attributable to one side/hand where matching per-side
loads are part of the configured Activity.

Do NOT silently convert 20 kg/side to 40 kg total.

### MACHINE_DISPLAYED_LOAD

Machine selected/displayed resistance.

Does NOT claim mechanical equivalence across different machines.

## 3. Boundaries

- Do not add participant body weight.
- Do not invent total-system-load calculations.
- Do not infer basis from Activity name.
- Do not authorize unequal paired loads through one scalar Weight value.
- Do not implement reps × weight, distance × weight, 1RM, RPE/RIR,
  bodyweight normalization, machine equivalence or other compound logic.
- g/kg deterministic conversion remains the only Weight-unit conversion.

## 4. Eligibility

A Weight configuration is eligible only if:

Published Activity + Weight supported + exact governed Weight Unit +
explicit authorized Load Reporting Basis + explicit reporting meaning +
other applicable product/safety constraints = eligible configuration.

A Weight configuration with no Load Reporting Basis fails closed.

Non-Weight configurations do not require a Load Reporting Basis.

## 5. Historical truth

The basis is part of the immutable/versioned Activity contract, so a
historical value remains interpretable.

Example: 20 kg + `PER_IMPLEMENT` remains historically understandable as
"20 kg per implement".

## 6. Representation

The basis is modelled per Activity as a supported set (an Activity may
support more than one basis across its governed Weight configurations),
while each configuration carries its one explicit basis. Bases are
never auto-assigned to the catalogue: an Activity with no declared
bases keeps its Weight configurations constrained until governed bases
are declared through Knowledge administration, with each declaration
advancing the version history.
