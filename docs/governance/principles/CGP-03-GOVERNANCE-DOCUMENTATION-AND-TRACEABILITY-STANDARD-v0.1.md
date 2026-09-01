# CGP-03 — Governance Documentation & Traceability Standard

**Integrated Founder Review Draft v0.1**

**Programme:** Tiizi V2  
**Stage:** E0 — Governance Architecture  
**Status:** Founder Accepted for Repository Reconciliation & Validation — 2026-09-01  
**Authority context:** Tiizi constitutional governance; CGP-02 complete  
**Purpose:** Establish the minimum rules by which Tiizi governance authority, decisions, changes and historical state remain identifiable and traceable.

## 1. Purpose

CGP-03 establishes the documentation and traceability discipline necessary to preserve the integrity of Tiizi governance over time.

It exists so that a person reviewing Tiizi governance can determine, with reasonable confidence:

- what is authoritative;
- what is not authoritative;
- what decision established or changed that authority;
- who or what held authority to make that decision;
- what the decision affected;
- what has been superseded;
- what remains unresolved; and
- where the current governed state can be found.

CGP-03 does not require documentation merely for administrative completeness.

**CGP03-P01 — Necessary Documentation Principle**  
A governance record is required only where its absence would materially impair authority, attribution, traceability, historical intelligibility, dependency control, or safe execution.

**CGP03-P02 — Proportionality Principle**  
The documentation and evidence required for a governed action must be proportionate to its authority, consequence, complexity, uncertainty and risk.

**CGP03-P03 — No Authority by Documentation Principle**  
Creating, storing, indexing or referencing a document does not itself give that document governance authority.

## 2. Controlled Governance Records

A **Controlled Governance Record** is a record whose preservation is necessary to establish or understand a governed state, authority, decision, obligation, dependency or change.

Examples may include constitutions, approved governance standards, Founder decisions, controlled registers, authoritative programme records and other records expressly established as governance evidence.

Not every working document is a Controlled Governance Record.

Drafts, research, working notes, implementation reports and analysis may support governance without themselves becoming governance authority.

**CGP03-P04 — Controlled Record Threshold**  
A record becomes a Controlled Governance Record through attributable governance treatment, not merely because it exists in the repository.

**CGP03-P05 — Stable Identity**  
Every Controlled Governance Record must have an identity sufficient to distinguish it from other governed records and preserve traceability across its lifecycle.

File path, filename and storage location may support identification but must not be the sole basis of governance identity where movement or renaming would destroy traceability.

**CGP03-P06 — Substance over Location**  
Moving, renaming, copying or reorganising a Controlled Governance Record does not by itself alter its authority, status or substantive identity.

## 3. Minimum Governance Metadata

Controlled records must contain or be traceably associated with enough information to establish their governed meaning.

CGP-03 does not prescribe a universal document template.

At minimum, where applicable, the governance environment must make it possible to determine:

**Identity** — what governed record or subject this is.

**Status** — its current governed state.

**Authority** — what attributable authority established the state.

**Date** — when the relevant decision or state took effect or was recorded, where temporally material.

**Scope** — what the record governs.

**Relationship** — material dependencies, replacements, supersession or governing references where necessary to understand authority.

**CGP03-P07 — Minimum Metadata Principle**  
Only metadata necessary to establish governance meaning and traceability is mandatory.

**CGP03-P08 — No Template Authority**  
Failure to conform to a preferred formatting template does not invalidate an otherwise attributable and intelligible governance decision unless the governing authority expressly made that form mandatory.

This prevents formatting from becoming more important than governance substance.

## 4. Authority and Current-State Representation

Tiizi must distinguish between the existence of information and the authority of information.

At minimum, governance records must remain distinguishable as appropriate between states such as:

- current authority;
- current programme/governance evidence;
- candidate or draft material;
- historical or superseded authority;
- supporting evidence;
- working material;
- implementation or engineering evidence; and
- material whose governance status remains unresolved.

These classifications need not become a universal repository taxonomy. They are distinctions of governance meaning.

**CGP03-P09 — Authority Must Be Attributable**  
A claim that a governance instrument, decision or state is authoritative must be traceable to the authority that established it.

**CGP03-P10 — Repository Presence Is Not Authority**  
The presence of a record in the repository does not establish approval, adoption, application, constitutional effect, implementation authority or any other governed status.

**CGP03-P11 — Current-State Integrity**  
Where Tiizi maintains a representation of current governance state, that representation must not knowingly contradict the authoritative decisions on which it depends.

**CGP03-P12 — Uncertainty Must Remain Visible**  
Where governance status cannot be established from available authority, the status must remain explicitly unresolved rather than being inferred from repository structure, chronology, convention or implementation behaviour.

## 5. Decision and Change Traceability

Governance traceability exists to make consequential change intelligible.

For a governed decision or change, the trace must be sufficient to establish, where material:

**what was decided or changed → under whose authority → what governed subject was affected → what resulting state now applies.**

**CGP03-P13 — Minimum Decision Trace**  
The normal minimum trace for a governed decision is:

**Controlled Subject → Attributable Decision → Resulting Governed State**

No additional artefact is required unless necessary under the proportionality principle.

**CGP03-P14 — Expanded Trace When Necessary**  
Where authority, consequence, complexity, uncertainty or risk requires stronger evidence, the trace may expand to include source evidence, review, alternatives, validation, dependency analysis or other necessary records.

The expanded trace is an exception justified by governance need, not the default lifecycle for all decisions.

**CGP03-P15 — No Mandatory Ceremony by Analogy**  
A review, validation, approval, adoption, application, closure or transition artefact required for one governed subject does not automatically become mandatory for another governed subject.

Each requirement must arise from applicable authority or demonstrated governance necessity.

**CGP03-P16 — Change Attribution**  
A material change to current governance authority must be attributable to authority capable of making that change.

Administrative reconciliation may represent an already-authorised change but must not create substantive authority.

## 6. Supersession and Historical Preservation

Tiizi governance must remain historically intelligible.

Current authority must be clear without erasing the decisions and states that preceded it.

**CGP03-P17 — Supersession Must Be Traceable**  
Where one governed record or decision supersedes another, the relationship must be sufficiently recorded to determine what ceased to govern and what replaced it.

**CGP03-P18 — Historical Evidence Must Not Be Silently Rewritten**  
A historical governance record must not be altered merely because the state it recorded is no longer current.

Where correction of a historical record is necessary, the correction must preserve the distinction between:

- what was recorded at the time; and
- what was subsequently corrected or determined.

**CGP03-P19 — Current-State Reconciliation Is Permitted**  
Current-state registers, programme records, indexes and summaries may and should be updated when an attributable governance decision changes current state.

Such reconciliation is not historical rewriting.

**CGP03-P20 — No Destructive Tidiness**  
Governance history must not be deleted, overwritten or materially obscured merely to make the repository appear cleaner or internally uniform.

## 7. Registers, Indexes and Programme Records

Registers, indexes and programme documents are navigational and state-management instruments.

They should make governance easier to understand without becoming unnecessary duplicate authorities.

**CGP03-P21 — Reference Rather Than Duplication**  
Where authoritative information already exists in a controlled record, registers and programme summaries should normally reference or summarize that authority rather than reproduce it in full.

**CGP03-P22 — No Competing Authority**  
An index, register or programme summary must not silently establish a substantive governance position inconsistent with the authority it represents.

**CGP03-P23 — Master Programme Function**  
The Tiizi Master Programme may serve as the authoritative representation of programme state while referring to separate records as the authority for substantive decisions.

Its authority over programme state does not make it the substantive source of every decision it references.

**CGP03-P24 — Reconciliation Duty**  
When an attributable decision materially changes current programme or governance state, maintained current-state representations should be reconciled within a reasonable governance workflow.

Temporary administrative lag does not invalidate the underlying attributable decision.

## 8. Documentation Proportionality

CGP-03 expressly rejects governance documentation as an end in itself.

**CGP03-P25 — No Document-for-Document Rule**  
A document must not be created solely to confirm the existence, completion, acceptance or filing of another document unless that additional record provides necessary governance evidence.

**CGP03-P26 — No Artificial Work-Package Rule**  
A governance matter must not be divided into multiple work packages solely to create additional preparation, review, acceptance, closure or transition stages.

**CGP03-P27 — Consolidation Preference**  
Closely related governance questions should normally be resolved together where separation would add process without materially improving authority, deliberation, traceability or risk control.

**CGP03-P28 — Direct Founder Decision**  
Where the Founder already has sufficient evidence and authority to make a bounded governance decision, Tiizi governance may proceed directly to an attributable Founder decision without requiring a separate preparation package unless preparation is materially necessary.

**CGP03-P29 — Validation Must Have a Purpose**  
Validation is required where there is a material integrity, dependency, completeness, consistency or execution risk to test.

Validation must not become an automatic ceremonial stage for every governance action.

**CGP03-P30 — Closure Must Be Evident, Not Ceremonial**  
A governed subject may be considered complete when its established completion conditions are satisfied and that state is attributable.

A separate closure instrument is required only where necessary to establish or preserve that fact.

## 9. Administrative and Mechanical Actions

Governance administration frequently requires records to be updated after substantive decisions.

CGP-03 distinguishes those actions from governance decisions.

**CGP03-P31 — Mechanical Reconciliation Principle**  
A mechanical repository action may record, index, link, classify, version, reconcile or validate an already-authorised governance state without becoming a new substantive governance decision.

**CGP03-P32 — No Semantic Expansion**  
Mechanical reconciliation must not expand, reinterpret or create authority beyond the attributable decision being recorded.

**CGP03-P33 — Escalation on Contradiction**  
If mechanical reconciliation discovers a material contradiction between the authorised decision and existing authority, reconciliation must stop at the affected boundary and return the contradiction for governed resolution.

This permits coding agents and other administrative mechanisms to perform repository work without silently becoming governance authors.

## 10. Traceability Sufficiency

Perfect documentation is not the objective.

Governance traceability is sufficient when a reasonable reviewer can establish the material authority chain without having to reconstruct it from assumption.

**CGP03-P34 — Reasonable Traceability Standard**  
Traceability is sufficient where the material authority, decision, resulting state and necessary dependencies can be determined reliably from the controlled governance environment.

**CGP03-P35 — No Absolute Duplication Requirement**  
The same fact does not need to be repeated across every related record merely to achieve traceability.

**CGP03-P36 — Broken Trace Requires Correction**  
Where a missing, contradictory or stale representation materially prevents determination of current authority or safe governed action, it must be corrected or explicitly marked unresolved.

Minor administrative inconsistencies that do not impair governance meaning should be corrected proportionately and must not automatically stop unrelated governed work.

## 11. Relationship to Other Tiizi Governance

CGP-03 governs **documentation and traceability of governance**.

It does not replace the authority of the Tiizi Constitution, PAM-01, CGP-01 or CGP-02.

CGP-02 continues to govern constitutional amendment and governance review.

CGP-03 does not establish entity accountability or relationship allocation; that remains within the subsequent Stage E0 governance architecture.

CGP-03 does not establish Knowledge Asset governance, product requirements or technical implementation requirements.

**CGP03-P37 — Governing-Layer Boundary**  
Documentation and traceability must represent governance authority; they must not silently modify the authority they represent.

**CGP03-P38 — Downstream Inheritance**  
Later Tiizi governance may apply CGP-03's traceability principles to its own controlled records without requiring CGP-03 to prescribe the substantive governance of those domains.

## 12. Compliance Standard

A governed action complies with CGP-03 when its documentation and traceability are sufficient for the authority and risk involved.

Compliance does **not** require maximum documentation.

**CGP03-P39 — Sufficiency over Volume**  
Governance documentation quality is determined by whether necessary authority and traceability are preserved, not by the number or length of documents produced.

**CGP03-P40 — Governance Must Remain Executable**  
Documentation controls must not be applied in a manner that unnecessarily prevents Tiizi from progressing once the material governance requirements for safe progression have been satisfied.
