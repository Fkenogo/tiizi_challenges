# Open Questions and Decisions

| ID | Question | Evidence | Why a decision is needed |
|---|---|---|---|
| OQ-01 | Which local rules/functions/config are deployed to production? | baseline files are modified; no live access used | severity and operability cannot be confirmed from repository alone |
| OQ-02 | Which user fields are intended to be visible to all authenticated users? | privacy toggles vs broad users read | security rules need a factual privacy contract |
| OQ-03 | May a group owner leave, and how is ownership transferred? | leave exists; transfer does not | prevents stranded groups |
| OQ-04 | Are group admin and “Coach” the same business role? | storage vs UI terminology | permissions and UX must agree |
| OQ-05 | Should inactive/deactivated groups retain members/challenges/feed access? | admin service sets two statuses | lifecycle and access enforcement |
| OQ-06 | Which challenge progress and ranking projection is authoritative? | member docs, challenge totals, summary/leaderboard collections | winner and recap correctness |
| OQ-07 | What is the authoritative timezone and streak-day boundary? | client date calculations/no policy | fair streaks and expiry |
| OQ-08 | How should corrected/deleted/late activity affect progress, feed and recaps? | create-trigger projections only | data integrity |
| OQ-09 | Is internal normalized scoring approved if users do not have points? | scoringConfig and point-like fields | terminology and future model |
| OQ-10 | Are donations only support intent/manual confirmation, or will Tiizi verify settlement? | no gateway/webhook | legal, UX and reporting truthfulness |
| OQ-11 | Which catalogue collections will become authoritative, and how are historical snapshots versioned? | local/Firestore/template divergence | V2 migration |
| OQ-12 | Are onboarding interests curated content or user-entered preferences? | hard-coded arrays and admin collections | knowledge ownership |
| OQ-13 | Are notifications intentionally in-app/manual, or are push/email required? | embedded array only | lifecycle and integration scope |
| OQ-14 | What is the retention/deletion policy for users, logs, social content, support records and media? | inconsistent hard/soft deletion | privacy and auditability |
| OQ-15 | Who may moderate feed comments/replies and how can users appeal? | author deletion only | community safety |
| OQ-16 | Are mockup routes deployed/reachable in production? | routes are present | release-surface governance |
| OQ-17 | Which analytics numbers are product KPIs versus operational estimates? | live queries and scheduled projections | founder reporting confidence |
| OQ-18 | Does an “individual challenge” belong in V2? | no active first-class type | avoid documenting nonexistent current behavior as fact |
| OQ-19 | Is profile photo persistence expected through Storage? | UI folder does not match rules | user experience/data-size decision |
| OQ-20 | What domains beyond fitness/wellness are in the first V2 scope? | platform shell is broader; event model is narrow | knowledge-engine boundary |
