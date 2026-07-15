# End-to-End Member Journey Audit

Date: 2026-06-15  
Scope: Member-facing Tiizi app pilot readiness from the perspective of a brand-new user  
Mode: Audit only. No app code changes, deployments, or database writes were performed.

## Executive Summary

Pilot readiness score: **82 / 100**

Recommendation: **Conditional GO for closed pilot after deployment/backfill verification. NO-GO for public beta.**

The repo is in a much stronger pilot state than the earlier audits: the required automated guards pass, typecheck/build pass, Home challenge feeds now exclude completed/expired challenges, the Home active count is aligned to the active challenge rail, onboarding routes are guarded, invite backend tests pass, and the Firebase chunk regression is resolved.

The remaining pilot risk is mostly operational rather than code-compile risk: recent member features depend on functions/rules/hosting deployment plus production backfills for summary documents and counters. Without those production steps, a brand-new pilot user can see stale or empty Home/profile/support/group counters, and challenge creation can depend on functions that may not exist in production yet.

## Validation Results

All required validation commands passed.

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:home-challenge-feeds` | PASS | Required sandbox escalation because `tsx` IPC pipe hit `EPERM`; rerun passed. |
| `npm run test:home-performance-guards` | PASS | Home summary/read guards passed. |
| `npm run test:pilot-ux-polish-guards` | PASS | Member-facing technical/admin copy guards passed. |
| `npm run test:challenge-creation-backend` | PASS | Required sandbox escalation because `tsx` IPC pipe hit `EPERM`; rerun passed. |
| `npm run test:group-invite-backend` | PASS | Invite backend security tests passed. |
| `npm run test:user-metrics-backfill-payload` | PASS | Guards against Admin SDK/client SDK Firestore type mismatch. |
| `npx tsc -b --pretty false` | PASS | No TypeScript errors. |
| `npm run build` | PASS | Vite build completed. Warning remains for large `vendor-firebase` chunk. |

Build note:

```text
✓ 1845 modules transformed.
✓ built in 3.69s
vendor-firebase-BAvgB5Ib.js 528.33 kB │ gzip: 124.40 kB
```

## Findings

### Critical

No code-level Critical blocker was confirmed by validation. The app should not be opened to pilot users until the High deployment/data readiness items below are completed.

### High

#### 1. Production deployment/backfill state can make good code behave like a broken pilot

Screen: Home, Profile analytics, Groups, Challenge creation, Support donations

Reproduction steps:
1. Deploy only hosting without the matching functions/rules/indexes.
2. Open Home or Create Challenge as a member.
3. Observe missing/stale summary data or unavailable server-backed flows.

Root cause:
Recent phases introduced server-owned summary/counter/callable architecture. The local code validates, but production readiness requires deploy/apply steps outside this audit:
- `memberHome/{uid}` and `userMetrics/{uid}` backfill.
- `supportDonationSummary/current` backfill.
- group/challenge counter backfill.
- functions deployment for server-owned summaries, counters, invite callables, challenge creation, and support summary refresh.
- rules/indexes deployment before member traffic.

Recommended fix:
Before closed pilot, run the Phase 10C deployment checklist in order: deploy indexes, rules, functions, hosting, then run reviewed apply backfills and verify production documents.

#### 2. Full manual brand-new-user browser smoke test is still required

Screen: All member journeys

Reproduction steps:
1. Create a fresh pilot test account.
2. Complete onboarding.
3. Join public/private groups.
4. Join/log challenges.
5. Confirm Home/profile metrics update after functions run.

Root cause:
This audit ran repository, route, guard, typecheck, and build validation. It did not create a brand-new production user or mutate production data, per audit-only/no-deploy constraints.

Recommended fix:
Run one manual smoke test with a dedicated pilot QA account after production deploy/backfills. Capture console logs and Firestore permission errors during the full journey.

#### 3. Challenge creation relies on the new consistency path being deployed

Screen: Create Challenge Wizard

Reproduction steps:
1. Use a production build that has the updated UI but lacks the matching callable/function deployment.
2. Create a challenge.
3. Creator membership may fail or the callable may be unavailable.

Root cause:
Phase 10B-P2 moved challenge creation toward atomic creator membership behavior. That is correct for pilot, but it requires the backend function/rules deployment to match the hosting bundle.

Recommended fix:
Deploy functions before or with hosting, then verify a creator can create a challenge and immediately log against it.

#### 4. User metrics/memberHome summaries must be populated before evaluating Home/Profile accuracy

Screen: Home, Profile, Profile Analytics

Reproduction steps:
1. Open Home for a user without `memberHome/{uid}` or `userMetrics/{uid}`.
2. Home avoids expensive raw fallback scans and can show syncing/empty states.

Root cause:
Phase 7 intentionally made Home/Profile summary-driven. Missing documents are handled safely, but they are not a complete pilot experience.

Recommended fix:
Run the reviewed apply command after deployment:

```bash
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:user-metrics:apply
```

Then verify `memberHome/{uid}` and `userMetrics/{uid}` for pilot accounts.

### Medium

#### 5. Donation-enabled legacy challenges can confuse support/cause flows

Screen: Donate, Challenge Detail donation sections

Reproduction steps:
1. Open a legacy donation-enabled challenge missing approval fields.
2. Donation UI may correctly block or mark the flow pending/unavailable, but the challenge can still look donation-related.

Root cause:
The support donation aggregate work found legacy seed challenges with `donation.enabled == true` but missing `donation.approvalStatus` and `donation.acceptingDonations`.

Recommended fix:
Before pilot, audit those records and either complete the donation approval fields or disable donation for those challenges. Do not auto-modify without product/admin review.

#### 6. Challenge lifecycle is currently feed-filtered, not server-reconciled

Screen: Home Trending, Browse Challenges, Challenge Detail, My Challenges

Reproduction steps:
1. Let an active challenge pass its end date without a backend lifecycle update.
2. Home Trending and active Home rail filter it out correctly, but stored status may remain stale.

Root cause:
The member app now applies safe client/feed filtering for completed/expired challenges. A scheduled lifecycle reconciler is still recommended.

Recommended fix:
Add a later backend scheduled function to transition expired active challenges to completed/expired status and refresh related summary docs.

#### 7. Completed challenge history is not yet a polished primary destination

Screen: Challenges, Profile/Activity History

Reproduction steps:
1. Complete or age out a challenge.
2. It is correctly removed from Home Trending/active feeds.
3. The user may not have a clear, polished “Completed Challenges” destination.

Root cause:
Home was intentionally cleaned to avoid showing completed items as active/trending. A dedicated completed history section is a separate UX feature.

Recommended fix:
Add a “My Challenges → Completed” or Profile history section in a later phase.

#### 8. One member-facing catch path still logs raw workout errors to console

Screen: Single workout logging

Reproduction steps:
1. Trigger a single workout logging failure in development or production console.
2. `LogWorkoutScreen` catches and logs `Workout logging failed`.

Root cause:
Most new activity-session diagnostics are dev-gated, but this older catch remains a normal `console.error`. It is not user-visible copy and build/tests pass.

Recommended fix:
Gate this log behind `import.meta.env.DEV` or route through the same friendly error helper used by the multi-activity flow.

### Low

#### 9. Production bundle has a large Firebase vendor chunk

Screen: First load performance

Reproduction steps:
1. Run `npm run build`.
2. Observe Vite chunk-size warning for `vendor-firebase`.

Root cause:
Firebase packages are intentionally collapsed into one chunk to avoid the previous circular chunk runtime crash. The result is safe but larger than Vite’s default warning threshold.

Recommended fix:
Accept for pilot unless first-load telemetry shows a real issue. Revisit route-level lazy loading after pilot stability is proven.

## Journey Assessment

### 1. Authentication

Status: **Mostly ready for closed pilot**

Routes exist for login/signup, password reset is represented in the auth flow, and auth errors have been normalized in earlier cleanup. Returning authenticated users are routed through profile completion state instead of being blindly sent back to onboarding.

Remaining risk: final Google/email/password production smoke test should be run with a fresh test account after deploy.

### 2. Onboarding

Status: **Ready pending manual smoke**

`/app/profile/completion`, `/app/profile/interests`, and setup finish are guarded as onboarding-only routes. Completed users are routed to `/app/home`; incomplete users are routed to the next required onboarding step.

Remaining risk: verify a brand-new production account cannot skip into Home without the minimal valid onboarding state.

### 3. Home Experience

Status: **Code-ready**

Home now uses summary docs and bounded challenge reads. The active stat is tied to the same lifecycle-filtered list rendered in the active challenge rail. Completed and expired challenges are guarded against Trending by tests.

Remaining risk: Home will look incomplete until `memberHome` and `userMetrics` are populated.

### 4. Groups

Status: **Ready pending counters/backfill verification**

Public/private group protections, invite backend, and group member count cleanup have been implemented in prior phases. Member-facing count display should use `groups.memberCount` instead of scanning all members.

Remaining risk: server-owned counters require deployment and backfill verification.

### 5. Challenges

Status: **Ready pending backend deploy/smoke**

Discovery is bounded and lifecycle-filtered. Challenge creation consistency has automated backend tests. Activity logging architecture is server-summary based and no longer depends on client-writable summary docs.

Remaining risk: production must have matching callable/functions/rules before the Create Challenge Wizard is judged pilot-ready.

### 6. Wellness

Status: **Mostly ready**

Wellness/catalog/template reads were hardened in earlier phases and required tests/build pass.

Remaining risk: verify wellness activity picker has production backfilled `status`, `visibility`, `isPublished`, and `sortName` fields.

### 7. Notifications

Status: **Pilot-acceptable**

Notification routing cleanup was completed earlier with safe fallbacks for missing targets.

Remaining risk: final manual click-through with real notification documents is still needed.

### 8. Profile

Status: **Ready pending summary backfill**

Profile privacy mock data was removed in UX cleanup, and profile metrics should now use summary documents.

Remaining risk: no-summary first-load states must be acceptable for users created before backfill.

### 9. Support & Donations

Status: **Conditionally ready**

The member-safe `supportDonationSummary/current` model removes broad confirmed donation reads from member screens.

Remaining risk: the support summary backfill and support donation function trigger must be deployed/applied before pilot:

```bash
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:support-summary:apply
```

### 10. Legal & Static Pages

Status: **Ready**

Routes exist for `/app/terms`, `/app/privacy`, and `/app/help`. `/app/flow` is dev-only and wildcard routes redirect safely to `/app/home`.

### 11. Error Handling

Status: **Mostly ready**

Pilot UX guards passed and catch the most important raw Firebase/developer wording in member-facing screens. Remaining console logging is low risk but should be dev-gated.

### 12. Mobile UX

Status: **Pilot-acceptable**

Home active challenges are horizontally scrollable, no-op controls were removed in earlier UX cleanup, and legal/help/share/profile copy was cleaned.

Remaining risk: perform one real mobile viewport smoke pass after deploy.

### 13. Performance

Status: **Improved and pilot-acceptable**

The highest-risk member read paths have been moved to summary docs, cursor pagination, server-owned counters, and bounded reads. Home no longer silently falls back to expensive raw scans.

Remaining risk: large Firebase chunk and missing production summaries can affect perceived first load.

### 14. Console & Runtime

Status: **Needs post-deploy browser verification**

Static guards/build are clean. The audit did not run a live browser production session, so runtime console errors must still be checked after deployment.

## Prioritized Fix Order

### 1. Pilot Blockers

1. Deploy in safe order: indexes, rules, functions, hosting.
2. Run reviewed production backfills:
   - `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:user-metrics:apply`
   - `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:support-summary:apply`
   - `CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:group-counts:apply`
3. Run one full browser smoke test with a fresh pilot test account.

### 2. High Priority

1. Verify Create Challenge Wizard creates both challenge and creator membership in production.
2. Verify private invite redemption and join request flows after deploy.
3. Verify Home/Profile metrics after functions/backfills.
4. Verify notification routing with real documents.

### 3. Medium Priority

1. Add backend scheduled challenge lifecycle reconciliation.
2. Add polished Completed Challenges destination.
3. Review legacy donation-enabled challenges and correct approval/accepting fields.
4. Dev-gate remaining member-facing `console.error` paths.

### 4. Future Improvements

1. Split/lazy-load non-critical routes to reduce first-load bundle cost.
2. Add production telemetry for Home first paint and Firestore read counts.
3. Add Playwright coverage for the complete new-user journey.

## Final Recommendation

Internal testing: **GO**

Closed pilot: **Conditional GO** after deployment, required backfills, and one successful fresh-user browser smoke test.

Public beta: **NO-GO** until lifecycle reconciliation, completed challenge history, production telemetry, and broader end-to-end browser automation are in place.

