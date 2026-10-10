# TIIZI — INTEREST / GOAL / FOCUS-AREA RECOMMENDATION AUTHORITY RECONCILIATION 001

**Date:** 2026-10-10
**Base candidate:** `bf4b47a3f612a6b77462aa210087a3cb1b291ce9` (reconciliation first filed at `7f9a65d`) (branch `claude/zealous-keller-09wyyw`); canonical `main` `365c958bf69f6d79ae262e81045abae9c777c19c`
**Status:** **AUTHORITY RECONCILED / FD-MC-04d AND FD-MC-04e APPROVED (2026-10-10) / REC-1 AUTHORITY CLEAR / AWAITING FINAL PR REVIEW. DOCUMENTATION / AUTHORITY ONLY. NO IMPLEMENTATION AUTHORIZED. NO PR OPENED.** Sections 0-11 record the analysis as first filed; §12 records the Founder disposition that resolves its open items and **governs where they differ**.
**Companions:** `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` (§5); `docs/experience/TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md`

## 0. Result in one page

1. **Interests / Focus Areas — the expected model is SUPPORTED.** Founder-approved Stage F Product Truth already permits interest-based Challenge *and* Group discovery and recommendation (T1 §E.8, §O.2, §S.2, §S.4, §S.5; FR-V2-053; CIC §4.2/§4.3). The later S4 "no recommendation, ranking or matching authority" statement is best read as a **scope/authority boundary on Group metadata and on the S4 slice**, not a platform-wide prohibition (interpretation **B**). REC-1 *operationalizes* an already-authorized capability.
2. **Goals — the expected model is only PARTLY supported.** Foundation authority for Goals is much thinner: a Member `goals[]` field exists as optional Profile information with no vocabulary and no stated use, and Stage F's list of personalisation inputs does **not** include goals. A Member Goal ↔ Group Goal relationship was never contemplated anywhere. The S4 Group metadata Product Truth says, for Group Goals specifically, "They do not rank, recommend, or match Groups". So **Goal-based recommendation is a genuinely new relationship** and, on the Group side, runs against the literal text of an approved Product Truth. It needs an explicit, narrow Founder confirmation (**FD-MC-04d**). Until then REC-1 may not use Group Goals as a matching key.
3. **A second foundation item is still pending and should be acknowledged, not ignored.** EOG-03 §17 (approved) places Interests, Goals, Preferences and Discovery Tags/Categories in a *future Discovery and Personalisation Governance Programme* that owns "authority, stewardship, lifecycle, matching, recommendation or privacy model", and the Founder decision **KNW-04** (ownership and vocabularies of interests and goals; detailed Runtime Projection contract) is still pending. No repository record resolves it. FD-MC-04b is best recorded as a bounded V2 starting-vocabulary disposition (**FD-MC-04e**).
4. **Vocabulary alignment is verified.** The 12 Group Focus Areas are exactly the 12 governed Knowledge categories. They have **no stable IDs** (labels only). Group Goals have stable IDs. `focus_tags` are label strings that can include one custom value per validated request.

This record changes no application behaviour, schema or migration. Where it recommends wording, the Goals portion is marked *pending Founder confirmation*.

## 1. Foundation evidence

### 1.1 Interests (member)

| Source | Exact authority |
|---|---|
| **EOG-05 Entity Ownership Register (approved 2026-07-21), HID-05 Interest** | "A governed expression of relevance or interest used within future discovery and personalisation boundaries. **Interest is not Platform Knowledge or an Activity merely because it uses a governed term.**" Owner: Profile. Cross-ref: "KNW-04 and Discovery governance remain pending" |
| **EOG-05 HID-04 Preference** | "A governed expression of a Person's permitted preference for a declared purpose. Preference does not establish Knowledge, Policy or participation." |
| **Profile Domain Standard** §4.4, §5 | "A preference or Interest expresses personal relevance or choice where permitted. It does not establish Knowledge, Policy, eligibility, participation, evidence or Derived Truth." Preference Information: "Participant Authority may express preferences; preferences do not become Policy, Knowledge or eligibility authority." Profile-derived information requires "a declared Calculation Authority and never becomes an independent source of Profile truth" |
| **Knowledge Asset Domain Standard** §15 | "Profiles may express interests, goals and preferences to support participation and personalization… Recommendation use shall remain constrained by privacy, minimum necessary purpose and later approved Policy. Knowledge may support controlled preference vocabularies where later approved. **The ownership and vocabularies of interests and goals remain deferred under KNW-04.**" |
| **EOG-03 §17 (approved)** | Interests, Goals, Preferences, Discovery Tags and Categories "are not Platform Knowledge Assets… belong to a future Discovery and Personalisation Governance Programme concerning discovery, recommendation, filtering, matching, classification and personalisation… This boundary does not create the future programme, … approve its vocabularies or resolve KNW-04." Also: "Discovery and Personalisation may later reference Platform Knowledge. Reference does not transfer Knowledge Authority." |
| **Stage F CIC §4.2 Member Profile** (Stage F approved, STAGE-F-FAD-01, 2026-09-11) | Optional `exerciseInterests[]` and `wellnessInterests[]` "(enumerated)"; "Interest arrays SHOULD use controlled vocabularies derived from Canonical Activity Definitions (4.10) categories where applicable." The CIC cites "FR-V2-182 … 186" as the profile requirements, but in T2 those numbers are the privacy/consent requirements (182 privacy before convenience, 183 minimum necessary, 184 consent, 185 withdrawal, 186 ownership ≠ access); **T2 contains no requirement that defines interests or goals**. The cross-reference is a numbering mismatch, noted here, not corrected |
| **Stage F T1 §E.8 Challenge Discovery** | "Home recommendations — Tiizi may recommend Challenges based on Member interests, Group memberships, Activity categories." "Recommendation ≠ enrollment." |
| **T1 §O.2 Home Priorities (5)** | "Discovery opportunities — recommended Groups or Challenges based on interests" |
| **T1 §S.2 / §S.4 / §S.5** | "Interests and categories — Challenges may be categorised by Activity type, Challenge type, or other attributes." "Tiizi may recommend Groups or Challenges based on Member interests and behaviour. Recommendation is not endorsement." Initial personalisation "may use: Group memberships…; **Interests (what Activity categories the Member has expressed interest in)**; Activity categories (what types of Activity the Member participates in)" |
| **T2 FR-V2-052 / 053 / 054** | 052: Home "MAY surface ongoing or upcoming Challenges a Member may be interested in joining." **053: "Challenge discovery MAY use permitted Member interests or other approved context to improve relevance."** 054: "Surfacing or recommending a Challenge MUST NOT enroll the Member." (FR-V2-050: browse "where visibility and eligibility rules permit.") |
| **EA-01** | Home/Today progressively assembles governed capabilities; FD-S5-002 defers explicit invitations and assesses Group-contextual opportunities separately; no V2 Profile exists yet (M27) |

**Finding (Interests):** interest-based discovery and personalisation is authorized as a **permissive (MAY)** Product Truth for Challenges (FR-V2-053) and for Groups and Challenges in T1. The T1 definition of an interest is "what Activity categories the Member has expressed interest in", which is the same concept as the governed Focus-Area vocabulary. Constraints that travel with it: privacy, minimum necessary use, never enrollment, never access or eligibility, visibility respected (T1 §P.8-style rule for discovery; FR-V2-050).

### 1.2 Goals (member)

| Source | Exact authority |
|---|---|
| CIC §4.2 | Optional `goals[]` on Member Profile. **No vocabulary, no stated consumer.** T2 has no goal requirement (the cited FR-V2-182…186 are privacy/consent) |
| Knowledge Standard §15 | "Profiles may express interests, goals and preferences to support participation and personalization… A goal does not become an Activity, Metric or Challenge Policy." Ownership and vocabularies deferred under KNW-04 |
| EOG-03 §17 | "A Goal does not become Platform Knowledge, Policy or a Challenge target merely through expression." |
| T1 §S.5 | Initial personalisation inputs are Group memberships, **Interests**, Activity categories. **Goals are not listed.** FR-V2-053 allows "other approved context" |
| Stage EK audit | Calls "Goals are challenge-level targets" in the legacy model; interests/goals/preferences are "profile/discovery metadata" (assessment evidence, not Product Truth) |

**Finding (Goals):** a Member Goal exists as a **Profile information concept** with a general personalisation purpose, but **goal-based recommendation was not specified**. FR-V2-053's "other approved context" is the hook through which it can be approved, and approval must be explicit.

### 1.3 Group-side foundation

CIC §4.3 Group has optional `activityInterests[]` and `wellnessTopics[]` and a `locationScope` (these are the foundation counterpart of Focus Areas). **No foundation record defines a "Group Goal" metadata field.** In Stage F, "Group Goal" (`groupGoal`, CIC §4.7 Challenge Configuration) means the **Collective Challenge shared target value**. The S4 Group Goal catalogue is a later invention (see §2).

## 2. Later S4 evidence

| Source | Text |
|---|---|
| **S4 Groups Experience Charter** (chartered 2026-09-23), field table | `focusTags`: "BOUNDED EXTENSION — Presentation chips only; **never matching/authority (structured PF-taxonomy picker deferred to S6)**". Charter rule: the experience "must not become a second authority and must not invent membership, stewardship, ranking, feed…" |
| **Groups Founder Experience Correction 001 — Pass 2/3 Record** (accepted 2026-09-30) | Header: "does not implement a Group Feed, **recommendations, matching**, Challenge Creation redesign…". Body: "Focus Areas and Goals confer no recommendation, ranking, or matching authority. Private Groups stay outside normal discovery." |
| **Master Programme v2.19 (2026-09-30)** | "Goals and Focus Areas **add no** recommendation/ranking/matching authority." (and, in the dashboard row, "confer no recommendation authority") |
| **TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001** (Founder-approved V2 Product Truth, Pass 3) | "The Group metadata fields are descriptive identity/discovery information. **They do not determine** Activity eligibility, Challenge authority, ranking, recommendation, matching, scoring, or enforcement." Custom Focus Area: "does not authorize taxonomy-driven matching." Group Goals: "may be searched as text in public Group discovery… **They do not rank, recommend, or match Groups** and have no effect on Challenge or Activity authority." Source reconciliation: Stage F "describe[s] Group interests/goals… but do not establish a concise exact V2 Goal or Norm catalogue" |

## 3. Authority chronology

| Date | Record | Level | Relevance |
|---|---|---|---|
| 2026-07-18 | IDP-01/IDP-02 approved | Founder decisions | Private preference data not broadly readable; enforceable privacy; consent versioned |
| (approval date not completed in the record) | EOG-03 Constitutional Governance of Platform Knowledge (§17) | Constitutional | Interests/Goals/Preferences outside Knowledge; future Discovery & Personalisation programme; KNW-04 unresolved |
| 2026-07-21 | EOG-05 Entity Ownership Register approved | Constitutional | HID-04/05 Preference and Interest owned by Profile "within future discovery and personalisation boundaries" |
| (domain standards) | Profile and Knowledge Asset Domain Standards §4.4/§5, §15 | Governance baseline | Preferences are not authority; recommendation use constrained by privacy, minimum necessary, later Policy; KNW-04 pending |
| 2026-09-01/02 | CGP-04 FAD-01; Stage EK closure | Founder | KNW-04 "Deferred (Stage EK)"; not resolved |
| **2026-09-11** | **STAGE-F-FAD-01** (T1, T2, CIC approved) | **Founder-approved Product Truth** | Interest-based Group/Challenge recommendation permitted (MAY); Member `goals[]` optional |
| 2026-09-23 | S4 Groups Charter | Experience charter | `focusTags` presentation chips; matching deferred |
| 2026-09-30 | Groups Correction 001 Pass 2/3 and CORR-001 | Founder-approved V2 Product Truth (Group metadata), accepted | Introduces Group Goal catalogue and states no rank/recommend/match for these fields; no recommender implemented |
| 2026-10-10 | Member Completion Founder Disposition (FD-MC-04, 04a-c) | Founder direction | Interests and goals required in onboarding; REC-1 pre-pilot ranks Groups and Challenges within the discoverable set |

(Several constitutional records carry commit-history dates that reflect repository consolidation rather than approval, so only dates stated inside the records are used above.)

## 4. Root cause of the apparent contradiction and interpretation

**Three different things were written about three different layers:**
- **Foundation / Stage F** says *a recommendation capability may exist and may use interests* (a capability permission at product level, with the governance model for it deferred to a future programme).
- **S4 CORR-001** says *these particular Group metadata fields, as shipped by the S4 slice, are descriptive and do not by themselves decide ranking, recommendation, matching, eligibility or enforcement*.
- Nothing between them defined the **relation** (the capability that consumes both sets of facts). So the S4 sentence read as a prohibition when it was a **non-delegation** statement.

**Test of interpretations A / B / C using chronology, level and surrounding text:**
- **A (platform-wide prohibition) — rejected.** CORR-001 is Group-metadata Product Truth scoped by its own title and sections, and it is **later but narrower** than Stage F; it contains no amendment of FR-V2-053, T1 §S or CIC §4.2, and the programme rule is that earlier approved governance stays authoritative until formally amended. The Pass 2/3 record's own header limits the slice ("does not implement … recommendations, matching"), which describes scope, not prohibition. The Master Programme wording is "**add** no recommendation/ranking/matching authority", i.e. this slice added none. The S4 charter defers the structured picker to S6, anticipating a later relationship.
- **B (metadata alone creates no authority; S4 not authorized to build a recommender) — supported.** Consistent with: "do not determine"; "add no"; "deferred"; "does not implement"; and with the Profile/Knowledge standards ("a preference does not establish eligibility").
- **C (something else) — one residual element.** The sentence "[Group Goals] do not rank, recommend, or match Groups" is more categorical than "do not determine". Read literally it would bar Goal-based Group ranking. Because Group Goals have **no foundation-level authority** (they originate in this Product Truth) and no relation to Member Goals was ever contemplated, the literal text *does* govern Group Goals until the Founder amends it. That is why the Goals conclusion differs from the Interests conclusion.

**Reconciled interpretation (Interests / Focus Areas):** the S4 statement is an implementation and authority boundary: Group Focus Areas and Group Goals, as metadata, do not themselves create recommendation, ranking, matching, access, eligibility, membership or participation. They can be **inputs** to a separately governed capability.

## 5. Concept model

The eight concepts are kept distinct. **Sharing a vocabulary does not make two concepts the same.** (A ninth sense, Challenge Goal, is included because it already exists and is easily confused.)

| # | Concept | Entity / domain | Who expresses / owns | Canonical? | Existing vocabulary | Current storage | Usable as recommendation input? | Creates access / eligibility / participation? |
|---|---|---|---|---|---|---|---|---|
| 1 | **Member Interest** | Profile (HID-05) | The member (Participant Authority) | Profile information; not Knowledge (EOG-03 §17) | None assigned yet; CIC says use Activity-category-derived controlled vocab (FD-MC-04b: Focus Areas as starting vocab) | **None in V2** (V1 stored in Firestore: excluded) | **Yes, authorized** (T1 §S, FR-V2-053), privacy-constrained, server-side only | **No** |
| 2 | **Member Preference** | Profile (HID-04) | The member | Profile information | None (language, notifications deferred) | None in V2 | Only if a declared purpose is approved | **No** |
| 3 | **Member Goal** | Profile (CIC §4.2 `goals[]`) | The member | Profile information; "not a Challenge target" | None at foundation; FD-MC-04b proposes Group Goal IDs as starting vocab | **None in V2** | **Not specified at foundation.** Allowed only as "other approved context" (FR-V2-053); approved for REC-1 by FD-MC-04 direction, Group-side use pending FD-MC-04d | **No** |
| 4 | **Group Focus Area** | Group (CIC §4.3 `activityInterests[]`/`wellnessTopics[]` counterpart; CORR-001) | Accountable Steward via Group settings | Descriptive Group metadata (PostgreSQL Group authority) | The 12 EKG-01 §5 categories (+ ≤1 custom) | `groups.focus_tags` TEXT[] of **labels** | **Yes as input**, via REC-1 (within discoverable set). CORR-001: metadata alone is not authority | **No** |
| 5 | **Group Goal** | Group (CORR-001; migration 021) | Accountable Steward | Descriptive Group metadata | 9 catalogue IDs (+ 1 custom ≤80 chars) | `groups.goal_ids` TEXT[], `custom_goal` | **Not authorized by CORR-001** ("do not rank, recommend, or match Groups"). Needs FD-MC-04d | **No** |
| 6 | **Activity category** | Knowledge (EKG-01 §5; PF-01) | Knowledge Authority | **Canonical** Knowledge classification | 6 Fitness + 6 Wellness (`V2_FITNESS_CATEGORIES`, `V2_WELLNESS_CATEGORIES`) | `knowledge_items.category` (label text, ≤100 chars), enforced by the V2 import/validation | **Yes** as a Challenge context input | **No** |
| 7 | **Challenge Activity/category context** | Challenge (derived) | Not a stored field. Derived from the Challenge's pinned Activities (`challenge_activity_configs.knowledge_id/version`) and its Group's context | **Derived**, never canonical Challenge truth | Same categories | None; computed at read time | **Yes** (T1 §S.2 "categorised by Activity type"), within visibility | **No** |
| 8 | **Recommendation / relevance result** | REC-1 application capability (Presentation / derived, subordinate) | System (deterministic) | **Not canonical; not Profile truth** (Profile Standard: derived info needs declared Calculation Authority) | n/a | Not persisted in v1 (computed per request) | n/a | **No** (FR-V2-054; Founder constraint) |
| 9 | *Challenge Goal (Together target)* | Challenge (CIC §4.7 `groupGoal`, `goal_value`) | Challenge creator at establishment | **Canonical Challenge truth** | Numeric target + unit | `challenges.goal_value`, `goal_unit` | **No**. Not a preference; never conflated with 3 or 5 | Defines Challenge completion, unrelated to recommendation |

Rules that follow: Member Interest ↔ Group Focus Area and Member Goal ↔ Group Goal are **relationships created only by REC-1**, not identities; no field of one is copied into the other; neither side is rewritten by REC-1; a member's interests/goals are never shown to others or leaked through explanations.

## 6. Authority model test

| Proposition | Evidence | Result |
|---|---|---|
| Member Interests/Goals are Profile preference expressions | HID-04/05; Profile Standard §4.4/§5; Knowledge Std §15; CIC §4.2 | **Supported** |
| Group Focus Areas/Goals describe Group intent/context | CORR-001; CIC §4.3 | **Supported** |
| Challenge relevance derivable from its Activities/categories and Group context | T1 §E.8, §S.2, §S.5 ("Activity categories"); pinned Knowledge on `challenge_activity_configs` | **Supported** |
| These are inputs; none independently creates recommendation authority | CORR-001 "do not determine"; Pass 2 "confer no"; MP "add no"; Profile/Knowledge Standards | **Supported** |
| REC-1 is the explicit application capability that relates them | FR-V2-053 permits discovery to use interests; no relation capability exists; Founder FD-MC-04c | **Supported** |
| REC-1 ranks only entities already discoverable/visible/eligible | FR-V2-050, T1 §S.3, §P.8-style rule, S4c discovery rules | **Supported** |
| Recommendation never creates access/membership/participation/eligibility | FR-V2-054; T1 §E.8 "Recommendation ≠ enrollment"; Profile Standard §9 | **Supported** |
| **Goals** are already usable as recommendation inputs, including Member Goal ↔ Group Goal | **Not found.** T1 §S.5 omits goals; CORR-001 says Group Goals do not rank/recommend/match | Not supported at foundation; **now approved by FD-MC-04d (2026-10-10)** — see §12 |

## 7. Separate conclusions

### A. Interests
Interest-based recommendation (Challenges and Groups) **was already authorized** by Founder-approved Stage F Product Truth as a permissive capability. REC-1 *activates and operationalizes* it. The unresolved governance around it (future Discovery & Personalisation programme; KNW-04 vocabularies/ownership) is acknowledged; FD-MC-04b supplies a bounded V2 starting vocabulary and should be recorded as such (FD-MC-04e).

### B. Goals
Goal-based recommendation **was not already authorized**. A Member Goal is an optional Profile concept; no goal vocabulary or use existed; Group Goals originate in CORR-001 where they are explicitly non-ranking; no Member Goal ↔ Group Goal relationship was contemplated. The Founder's 2026-10-10 direction (FD-MC-04, 04b, 04c) is the "other approved context" for **Member Goals** as an input. The **Group-side use of Group Goals** and the Member↔Group Goal relationship require a narrow **Founder amendment/confirmation (FD-MC-04d)** that annotates CORR-001. Until confirmed, REC-1 relevance is **interest-driven**; goals are collected and stored but not used as a Group matching key (they may still bias Challenge relevance only through a Founder-approved Goal→Activity-category mapping, which does not exist).

## 8. Vocabulary alignment (verified from code at `365c958`; nothing changed)

| Check | Result |
|---|---|
| 12 Group Focus Areas = governed Knowledge categories | **Yes, exactly.** `src/v2/groups/groupFocusAreas.ts` and `api/src/groupVocabulary.ts` list the same 12 as EKG-01 §5 and as `V2_FITNESS_CATEGORIES` + `V2_WELLNESS_CATEGORIES` in `api/src/knowledge.ts` (which the V2 Knowledge validator enforces) |
| Focus Areas have stable IDs | **No.** Labels/categories only. The API list carries `{domain,label}`; the client list `{domain,category}` |
| Group Goals have stable IDs | **Yes**, nine IDs (`manage_weight` … `build_consistency`), validated in the Group route; stored as `groups.goal_ids` with a GIN index (migration 021) |
| `focus_tags` allow free text | **Partly.** The validated Group route accepts standard labels plus **at most one** custom label of ≤30 characters (duplicates rejected). The domain-level sanitizer treats tags as bounded free-text strings and the code comment calls them "free-text focus chips"; pre-existing/legacy tags are read "as stored". So stored values are not guaranteed conformant |
| Activity category ↔ Focus Area mapping | **No explicit mapping, but an identity exists at label level** (same 12 strings). It must be *declared*, not assumed |
| Member Interest ↔ Focus Area | None exists (no member interests in V2). FD-MC-04b assigns the same vocabulary by decision |
| Member Goal ↔ Group Goal | None exists. FD-MC-04b proposes reuse of Group Goal IDs as the member goal vocabulary; the relationship itself needs FD-MC-04d |
| Other vocabulary notes | Knowledge category identity is the label string (`knowledge_items.category`); category renames are governed by EKG-01 amendments, so a minted interest ID must map to a category name via a declared, versioned mapping |

## 9. Reconciliation plan (plan only; no implementation)

1. **Founder:** FD-MC-04d (Goal-based relevance; amend/annotate CORR-001 for Group Goals); FD-MC-04e (record FD-MC-04b as a bounded V2 disposition under KNW-04 and state REC-1's relationship to the future Discovery & Personalisation governance programme).
2. **Vocabulary decision record:** mint stable, versioned IDs for the 12 Focus Areas (Tiizi-owned keys mapping to the EKG-01 category names); keep Group Goal IDs; define the member Interest and member Goal vocabularies as "starting from" these without merging the concepts.
3. **Declare the Activity-category → Focus-Area mapping** (identity at label level) in the vocabulary record, with version and owner.
4. **Group `focus_tags` reconciliation design:** verify real stored values; decide treatment of legacy/custom tags (map to IDs, keep as non-matching presentation, or migrate); preserve current Group presentation; no change to Group privacy/search behaviour. (A migration, if any, is numbered only when an authorized package begins.)
5. **Privacy rules for REC-1:** interests/goals are private preference data (IDP-01); used server-side only; explanations never reveal another member's or another Group's hidden attributes; REC-1 output is not stored as Profile truth.
6. **REC-1 entry gates:** items 1-4 complete and approved.

## 10. Programme corrections made

- `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §5, §3 and §14 corrected: REC-1 no longer described as creating authority; Goals separated; FD-MC-04d/04e added.
- `TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md` update table notes the correction.
- `TIIZI-V2-MASTER-PROGRAMME.md` 2.52 → 2.53: wording corrected (see below).
- `TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md`: **interpretation note only**; no S4 contract changed.

**Master Programme wording as first proposed (superseded by §12 and Master Programme 2.54, where FD-MC-04d is approved):** *"Foundation Product Truth already permits interest-based Challenge and Group discovery and recommendation. The later S4 statement that Focus Areas and Goals confer no recommendation authority is interpreted as an implementation and authority boundary: those metadata fields do not themselves create recommendation, ranking, access, eligibility, membership or participation. REC-1 is the explicit governed capability that may use Member Interests and Group/Challenge metadata as relevance inputs inside the already-authorized discoverable set. Goal-based relevance is a new relationship: Member Goals are approved as an input by the 2026-10-10 Founder direction, but the use of Group Goals as a matching key requires explicit Founder confirmation (FD-MC-04d) because the approved Group metadata Product Truth states that Group Goals do not rank, recommend or match Groups."*

## 11. REC-1 authority conclusion

- REC-1 **does not create recommendation authority from nothing** for interests: it activates an authorized foundation capability, resolves the S4 scope ambiguity, and preserves S4's rule that metadata creates no eligibility, participation or access.
- REC-1 **adds one genuinely new relationship**, Goal-based relevance, which needs FD-MC-04d (Group side) before use.
- REC-1 remains: deterministic and explainable; ranks only inside the already-authorized discoverable set; never creates visibility, access, membership, participation or eligibility; falls back to the existing order when nothing matches; no ML; does not infer interests from behaviour in v1 (T1 §S.5 evolution is out of scope); does not persist results as Profile truth.
- Status unchanged: pre-pilot, approved in principle, not started, not authorized.

## 12. Founder disposition (2026-10-10) — governs over §0-§11 where they differ

### 12.1 FD-MC-04d (exact wording as recorded)
**FD-MC-04d — APPROVED.** Goal-based relevance is approved for V2. Member Goals may be used by REC-1 as bounded relevance inputs, and Group Goals may be used as the corresponding Group-side relevance attributes. This is a new, narrow relationship. It does not mean that Group Goals create recommendation authority by themselves; that Member Goals create access; that Goals create eligibility, Group membership or Challenge participation; that Goals affect Challenge scoring, progress or results; or that recommendation becomes endorsement. REC-1 is the explicit governed capability that relates these independent facts.

**S4 Group Goal wording, narrowly clarified.** *Historical meaning (unchanged):* at S4 acceptance, Group Goals did not themselves rank, recommend or match Groups, and S4 did not implement a recommender. *New effective clarification (FD-MC-04d):* a separately governed recommendation capability MAY use Group Goals as descriptive relevance inputs, together with Member Goals, inside the already-authorized discoverable set.

### 12.2 FD-MC-04e (exact wording as recorded)
**FD-MC-04e — APPROVED (bounded KNW-04 resolution for the V2 pilot).** KNW-04 is resolved only for the bounded V2 pilot recommendation/profile scope. For this scope the **Member Interest vocabulary is the governed 12 Focus Area concepts** and the **Member Goal vocabulary is the governed 9 Group Goal concepts**. Sharing a vocabulary does not collapse the entities: a Member Interest is a Profile expression; a Group Focus Area is Group descriptive metadata; a Member Goal is a Profile expression; a Group Goal is Group descriptive metadata; an Activity category is a Knowledge classification. The Member owns their Interest and Goal expressions; the Group Steward establishes Group Focus Areas and Goals under Group authority; Knowledge Authority governs Activity and category meaning; REC-1 relates those facts for relevance only.

**KNW-04 status:** *RESOLVED for the bounded V2 pilot recommendation/profile scope* (vocabulary and ownership as above). *OPEN for broader future evolution* only: adding or removing controlled concepts, taxonomy lifecycle beyond pilot, broader personalization capabilities, and future custom-vocabulary governance.

### 12.3 Final definitions and ownership
Member Interest, Member Goal, Group Focus Area, Group Goal and Activity category are defined in the Disposition §5.2 and the concept model in §5 above. The Activity category ↔ Focus Area relationship is: the 12 Focus Area concepts **are** the 12 governed Knowledge categories at concept level; the Group's Focus Area is a Steward's descriptive selection of those concepts, not a Knowledge classification of the Group. Challenge relevance derives from pinned Activities → governed categories, plus the hosting Group's governed Focus Areas and Goals; **no synthetic Challenge Focus Area field is added**.

### 12.4 Custom text, stable IDs, pre-existing members
Custom focus tags and custom Group goal text are display/descriptive only and carry **no relevance weight** in REC-1 v1. The 12 Focus Areas **must** receive stable, immutable, application-owned IDs before MC-3 / REC-1 implementation; the code inconsistency ("IDs are stable API values" while `GROUP_FOCUS_AREAS` has none) is recorded; no ID values are chosen in this pass. Members without canonical selections complete the same bounded step (interests 1–5, goals 1–3, no skip) on next V2 entry; no V1 data is imported automatically.

### 12.5 Effect on the earlier findings
- §0 item 2 and §7B (Goals "only partly supported"): the new relationship is now **approved**; Goal-based relevance is no longer pending.
- §0 item 3 (KNW-04): **resolved for the bounded V2 pilot scope**; open only for broader evolution.
- §9 plan items 1-2 (Founder confirmations): **done**. Items 3-6 became the technical prerequisites listed in Disposition §5.7.
- §11 REC-1: authority is **clear**; remaining prerequisites are technical/data.

## 13. Boundaries

Documentation only. No recommendation code, no normalization, no schema or migration, no change to Group metadata behaviour, no change to GF-01…04, R2, Challenge Feed, Kudos, announcements, lifecycle, BG-1, onboarding minimums or migration rules. No deployment, no production access. V1 used only as historical context already in the repository, never as authority.

**Disposition:** TIIZI INTEREST / GOAL / FOCUS-AREA RECOMMENDATION AUTHORITY RECONCILIATION 001 — AUTHORITY RECONCILED / PILOT VOCABULARIES APPROVED / REC-1 AUTHORITY CLEAR / AWAITING FINAL PR REVIEW.
