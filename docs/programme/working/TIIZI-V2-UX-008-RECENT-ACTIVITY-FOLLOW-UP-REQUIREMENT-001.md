# TIIZI-V2-UX-008 — Personal Recent Activity timeline: follow-up requirement (NOT IMPLEMENTED)

**Status:** Requirement recorded. **No implementation is included in TIIZI-V2-UX-008.**
**Reason:** The Founder direction for TIIZI-V2-UX-008 explicitly defers this work:
"Do not implement the unified Personal Recent Activity timeline in this PR."

---

## 1. Decision recorded

A **private, member-scoped, chronological timeline** of a Member's own participation history is
required as a separate, approved package. It is deliberately **not** built inside TIIZI-V2-UX-008.

No historical data is changed, migrated or rewritten by this record, and no event is fabricated.
The existing surfaces and their authority remain exactly as they are today:

| Surface | Authority today | Effect of this record |
| --- | --- | --- |
| Today → "Recent results" (`finalizedResults`) | The server Today projection, frozen final result of a finalized Challenge | Unchanged. Results stay as they are |
| Recognition / Streak recognition | Existing governed recognition authority | Unchanged |
| Member Profile → Challenge history | Existing governed read | Unchanged |
| Member Profile → Recent Activity preview (`/v2/activity`) | Existing governed member-scoped read | Unchanged |

## 2. Required content of the timeline (when approved)

Chronological, newest-first, member-scoped (the member sees only their own history):

1. **Group created** — the Group the member established.
2. **Group joined** — the Group the member joined, including the admission mode that applied
   (open join or approved request) and, when applicable, the approval outcome.
3. **Challenge created** — the Challenge the member established, with the hosting Group.
4. **Challenge joined** — the Challenge the member joined, with its hosting Group.
5. **Activity logged** — accepted activity logs for the member, against the Challenge and activity
   that were used.
6. **Challenge completion** — the member's own completion of a Challenge (where completion is a
   governed member-level event, e.g. a Streak Challenge requirement or a Competitive episode).
7. **Final Challenge result** — the sealed final result of a finalized Challenge the member took
   part in.

## 3. Recommended integration of Recent Results

**Recommendation (not applied):** the existing **Recent Results** projection (today's
`finalizedResults`) should be folded into the timeline as its "Final Challenge result" entries
rather than kept as a separate Today section, so a member has one chronological history instead of
two overlapping views.

**Condition:** this is a recommendation only. The current results presentation and the current
recognition authority are **preserved unchanged until the follow-up package is approved**. If the
follow-up is approved, integration of Recent Results into the timeline is to be designed and
reviewed there, including the authority for which Challenge results a member is entitled to see.

## 4. Open questions for the approving package

- **Visibility:** the timeline is private to the member by default; whether any part of it is
  visible to a Group steward or to other members is **not** assumed here and needs a Founder
  decision.
- **Retention:** how long the timeline is retained, and what happens to the timeline when a
  Member is deleted, is not decided here.
- **Authority for historic events:** the timeline must read from the same governed sources as
  today (PostgreSQL is the sole V2 domain authority); it must not derive history from
  presentation state, from client caches, or from reconstructed/"best effort" events.
- **Deleted or removed entities:** the presentation of an entry whose Group or Challenge was
  deleted, removed, or is no longer visible to the member needs an explicit rule; the timeline must
  not re-expose content the member is no longer authorized to see.
- **Governed retention of the existing Recent Activity preview:** whether the preview surface is
  retired, kept, or superseded by the timeline is part of the approving package.

## 5. Scope boundary of this record

This document records a requirement and a recommendation. It contains **no code change**, no data
change, no migration and no change to the results or recognition authority. Implementing the
timeline requires its own Founder approval and its own PR.
