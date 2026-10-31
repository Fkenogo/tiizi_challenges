# Slice 3b final-head browser verification — concise report

Source `3e7036883eb85dd74e0b251ee4bb8bb360c17ef0`; executed 2026-10-30 against a disposable loopback database (marker verified). Implementation-agent evidence, not independent R1. Overall: **12/12 scenarios PASS**.

| # | Scenario | Outcome |
| --- | --- | --- |
| A1 | Unsaved draft of Author A; in-place switch to Author B | B never sees A's text; no recovery record for B holds A's work; no Template write after switch; DB unchanged |
| A2 | Author B opens editor in same tab after A | Empty summary; A's recovery record purged; no "Restored" banner |
| B | Canonical sign-out with editor unmounted, same account signs back in | Record survives mere navigation, cleared on sign-out; other account's record untouched; nothing restored |
| C | Stored Activity older than governed current version | Mismatch shown, nothing written; unrelated save keeps version/components/kind; only explicit Refresh adopts current |
| D | Create POST succeeds, first detail GET aborted, retry | Exactly one POST, one Template, one create audit event; draft reloads; recovery cleared |
| E | Stale-save conflict with delayed Activity/options requests | Form locked and Save disabled while loading; unsaved work preserved; panel shown after hydration; reconciled save sends `If-Match`; audit shows two edit events |
| F1 | Normal edit and save | Summary persisted |
| F2 | Author revoked mid-session | Server 403; editing disabled; work visible and retained in recovery; DB unchanged |
| F3 | Layout at 1440/1280/900/390 px | No page-level horizontal overflow on Activities, What counts, Template details |

Notes: screenshots A1 and A2 are byte-identical (same final state). Bearer tokens, headers and request bodies were not recorded. Full per-scenario evidence (JSON, screenshots, harness) is retained in the private archive; see `README.md` for references and checksums.
