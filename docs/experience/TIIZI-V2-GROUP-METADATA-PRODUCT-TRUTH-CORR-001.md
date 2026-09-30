# Tiizi V2 Group Metadata Product Truth — CORR-001

Status: **Founder review candidate**, prepared under the bounded Founder
direction in Groups Founder Experience Correction 001 — Pass 2. The exact Goal
and Community Norm labels below are proposed for this review; implementation
does not make them enforcement policy or broader platform taxonomy.

## Distinct concepts

- **Focus Area** describes what a Group is interested in.
- **Group Goal** describes an outcome the Group wants to achieve.
- **Activity** describes what participants do. Activities are not Goals and
  Goals are not Focus Areas.

The Group metadata fields are descriptive identity/discovery information.
They do not determine Activity eligibility, Challenge authority, ranking,
recommendation, matching, scoring, or enforcement.

## Focus Areas

The bounded standard vocabulary reuses the canonical Fitness and Wellness
category labels in EKG-01 §5. The labels remain unchanged:

| Domain | Focus Area |
|---|---|
| Fitness | Strength |
| Fitness | Cardio & Conditioning |
| Fitness | Mobility & Flexibility |
| Fitness | Balance & Stability |
| Fitness | Power, Speed & Agility |
| Fitness | Sports & Recreation |
| Wellness | Sleep & Rest |
| Wellness | Mind & Emotional Wellbeing |
| Wellness | Nutrition & Hydration |
| Wellness | Daily Living |
| Wellness | Personal Growth |
| Wellness | Social Wellbeing |

A Group may select any applicable standard entries; the former eight-item
limit does not apply to this bounded catalogue. One optional custom Focus Area
of at most 30 characters may be stored as descriptive metadata. It does not
extend the standard taxonomy and does not authorize taxonomy-driven matching.

## Group Goals — proposed vocabulary

Groups may select multiple standard outcome labels from this compact catalogue:

| ID | Label |
|---|---|
| `manage_weight` | Manage weight |
| `build_strength` | Build strength |
| `improve_endurance` | Improve endurance and fitness |
| `improve_mobility` | Improve mobility and flexibility |
| `improve_nutrition` | Improve eating habits |
| `improve_sleep` | Improve sleep |
| `manage_stress` | Manage stress |
| `support_wellbeing` | Support overall wellbeing |
| `build_consistency` | Build consistency with healthy habits |

The IDs are stable API identifiers; labels are member-facing. There is no
standard-selection limit beyond selecting distinct entries from this bounded
catalogue. One optional custom Goal, at most 80 characters, may be recorded as
descriptive Group metadata. Goals may be searched as text in public Group
discovery, under the existing active/non-private visibility boundary. They do
not rank, recommend, or match Groups and have no effect on Challenge or
Activity authority.

## Community Norms — proposed vocabulary

Groups may select multiple standard expectations from this concise catalogue:

| ID | Label |
|---|---|
| `respect_others` | Treat each other with respect. |
| `encourage_each_other` | Encourage one another. |
| `participate_consistently` | Participate consistently in ways that work for you. |
| `log_honestly` | Log Activities honestly. |
| `support_every_pace` | Support every pace, without shaming. |
| `keep_constructive` | Help keep this Group welcoming and constructive. |

The IDs are stable API identifiers; labels are member-facing. Multiple
standard norms and at most one optional custom norm (up to 200 characters) may
be recorded. These are descriptive Group expectations displayed to members;
they are not scoring, enforcement, moderation, or admission authority. Existing
`rules` values remain readable and are not rewritten by this contract.

## Persistence and API contract

PostgreSQL remains the Group authority. V2 stores standard Goal IDs and norm
IDs separately from Focus Area labels, with separate nullable custom fields.
Existing Groups receive empty standard arrays and null custom values. The
authenticated Group options read returns the canonical presentation catalogues.
Group creation validates IDs against those catalogues; Group detail returns
IDs and resolved labels to members. Public discovery returns Goal labels and
custom Goal text for search/display, but never Community Norms. Existing
visibility, membership, admission, and stewardship boundaries remain intact.

No Challenge, Activity, lifecycle, or S6 authority changes are made.

## Source reconciliation

- EKG-01 §5 supplies the canonical Fitness/Wellness category labels.
- Stage F Product Definition and Functional Requirements describe Group
  interests/goals and selectable Charter/community expectations with bounded
  custom text, but do not establish a concise exact V2 Goal or Norm catalogue.
- EOG-02 establishes Group purpose, singular stewardship, and Charter subject
  boundaries; it does not establish the labels above.
- S4a–S4d and the Group Domain Standard preserve current PostgreSQL authority,
  discoverability, admission, membership and settings contracts; they do not
  make goals into Activities or norm presets into enforcement.
- Prior V1 Goal lists are historical evidence only and are not promoted as a
  V2 authority.

The exact Goal and Norm labels therefore remain a Founder-review candidate
until accepted. They are bounded, member-facing product vocabulary only.
