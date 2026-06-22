# Phase 8A - Member UX Cleanup Audit Before Pilot

Date: 2026-06-12  
Scope: Member-facing Tiizi app only  
Mode: Audit only. No code changes, deployments, or database writes.

## Executive Summary

Pilot readiness score: **68 / 100 - conditional pilot readiness**

The core member app is functionally present, but several user-facing surfaces still expose placeholder content, no-op actions, debug/flow routes, raw identifiers, and misleading demo defaults. The highest-risk items are not visual styling problems; they are moments where a pilot user taps a visible control and nothing happens, lands on an internal flow hub, or sees content that looks unfinished.

Recommended pilot decision: **do not start a broad pilot until Critical and High issues below are fixed or deliberately hidden.** A small internal pilot can proceed if testers are warned that feedback/social/legal/support surfaces are incomplete.

## Method

Reviewed route configuration and member-facing screens/services by static inspection, including:

- `src/App.tsx`
- Auth, Home, Groups, Challenges, Workouts, Profile, Donate, Notifications, Help, Share, Quick Actions
- shared navigation components
- member-facing hooks/services where they affected visible behavior

No runtime deployment or database writes were performed.

## Critical Blockers

| Severity | Screen / Flow | Finding | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Critical | Legal content | Terms of Service and Privacy Policy do not load as real member pages. Profile Settings only shows toast placeholders: "Open Terms & Conditions document here" and "Open Privacy Policy document here." | Member routes/content pages are missing or not wired to admin-authored content. | Add real `/app/terms` and `/app/privacy` pages or external links. Replace toast placeholders before pilot. |
| Critical | Feedback / Help | Help's "Open Feedback Flow" sends users to `/app/flow`, which is an internal flow hub, not a feedback form. | Feedback route was never implemented; `/app/flow` remains production-reachable. | Add a real feedback/support flow or hide the CTA. Remove `/app/flow` from user fallback navigation. |
| Critical | Broken route fallback | `src/App.tsx` wildcard redirects all unknown routes to `/app/flow`. A typo/dead route exposes an internal flow catalog instead of a user-safe page. | Wildcard fallback is still wired to a development flow screen. | Redirect unknown authenticated member routes to `/app/home` or a simple 404/help screen. Restrict `/app/flow` to development/admin only. |

## High Priority Fixes

| Severity | Screen / Flow | Finding | Root Cause | Recommended Fix |
|---|---|---|---|---|
| High | Quick Actions -> Log Activity | Quick Actions builds `/app/workouts/select-activity?groupId=...` without a `challengeId`. The destination expects challenge context and can show a vague empty "Challenge" state. | Log action chooses a group but not an active challenge. | Route to challenge selection first, or choose the user's primary active challenge before opening activity logging. |
| High | Group Feed | "Share update", Reply, Share, Bookmark, and More actions are visible but not wired. | Social UI is present ahead of backend/product behavior. | Hide inactive actions for pilot or implement minimal working flows. |
| High | Group Members | "Load More Members" has no `onClick`; message buttons and row chevrons imply actions but do nothing. | UI controls were rendered before pagination/member actions were completed. | Wire load-more pagination or remove the button. Hide message/chevron affordances until supported. |
| High | Group Detail | Upcoming challenge "Remind Me" button has no handler. Reporting uses `window.prompt`. | Placeholder action and browser-native prompt. | Wire reminder creation or hide the button. Replace prompt with a small report modal or defer reporting. |
| High | Group Highlighted Challenges | `/app/group/:id/challenges/highlighted` looks like an approval/moderation center, has Settings/View All buttons with no handlers, hard-coded "2 hours ago", and permanent skeleton Recent Activity. | Internal/moderation-like screen is exposed in member routing. | Restrict to group managers or remove from member navigation until complete. |
| High | Profile Privacy Settings | Public profile preview shows fake identity "Alex Rivers", `@alex_r`, hard-coded height/weight fallback, and a bio unrelated to the user. Back button routes to onboarding interests. | Screen mixes onboarding mock data with a completed-profile settings route. | Render the real user's profile fields and route back to `/app/profile/settings`. |
| High | Notifications | Notification cards do not navigate to their target challenge/group even when `challengeId` or `groupId` exists. | Notification UI displays items but lacks target routing. | Make notifications clickable with safe target routing and fallback for deleted targets. |
| High | Share | Share screen displays raw IDs such as `Challenge: {challengeId} • Group: {groupId}` and "Open Challenge Preview" routes to a template redirect, not a real shared challenge view. | Share flow is ID-based and not resolving display names/share destinations. | Resolve names, use Web Share API where available, and route to real group/challenge detail pages. |
| High | Challenge Leaderboard | `/app/challenges/leaderboard` defaults to `core-blast` and "30-Day Fitness Blast" if no param. Search button is visible but not functional. | Demo defaults and inactive search action remain. | Require a real `challengeId` or show a selection state. Hide search until implemented. |

## Medium Priority Fixes

| Severity | Screen / Flow | Finding | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Medium | Login / Signup | Apple sign-in buttons are disabled with no explanation. | Provider is displayed before support is available. | Hide Apple buttons for pilot or add "Coming soon" helper copy. |
| Medium | Welcome | Copy says "Trusted by 10,000+ members", which may be unverified for pilot. | Marketing proof text is hard-coded. | Replace with truthful pilot copy. |
| Medium | Groups | Header Search and Bell icon buttons do nothing. Group cards show a decorative `•••` that implies a menu. | Visual affordances lack actions. | Hide or wire icons; replace `•••` with a real menu only when needed. |
| Medium | Group Invite Management | Request queue shows raw `userId` values instead of display names. | Join request model/listing does not hydrate requester profile data. | Resolve requester display names for current page or show a user-friendly fallback. |
| Medium | Challenge Detail | Leaderboard snapshot can show truncated user IDs rather than names. | Display layer uses activity/summary IDs without profile display mapping. | Use summary docs with display names or show "Member" fallback. |
| Medium | Challenge Completed | Defaults to `core-blast` and "30-Day Sprint"; ellipsis button has no action; "Maybe later" and "Skip" are duplicate exits. | Demo defaults and duplicate CTAs remain. | Require real route params, remove unused menu, keep one exit CTA. |
| Medium | Suggested Challenges | Empty state says "Your admin can publish reusable templates from the admin dashboard." | Admin/developer copy leaks into member UI. | Rewrite as member-facing empty copy. |
| Medium | Home | Notification bell always shows an orange dot rather than unread state. Error state lacks retry action. | Visual state is static; error recovery is minimal. | Bind dot to unread count and add retry. |
| Medium | Activity Logging | `SelectChallengeActivityScreen` logs detailed save failure context to `console.error`, including user/group/challenge IDs and planned payload metadata. | Production diagnostic logging was left in a user path. | Gate diagnostics behind development/debug flag and keep user toast simple. |
| Medium | Content Support | Help page is shallow and includes "privacy placeholders" copy. | FAQ content is placeholder-level. | Replace with real FAQ, contact/support instructions, and privacy/help links. |

## Low Priority / Polish

| Severity | Screen / Flow | Finding | Root Cause | Recommended Fix |
|---|---|---|---|---|
| Low | Challenges | Cards show "No image" text when image is missing. | Missing asset fallback is text-only. | Use a neutral generated/default challenge image. |
| Low | Browse Challenges | Copy says "Search applies to loaded challenges." Accurate but technical. | Pagination constraint is exposed as implementation wording. | Rewrite to "Search the challenges shown below" or add server search later. |
| Low | Profile | "Top 5% Contributor" appears when `joinedGroupsCount > 0`, which may not be earned. | Badge is driven by a rough proxy. | Hide until a real achievement metric exists. |
| Low | Donate | Card payment can appear disabled without a helper message when no card URL exists. | Disabled state lacks contextual explanation. | Add one-line explanation or hide unavailable methods. |

## Content Page Inventory

| Page | Exists | Loads Real Content | Finding |
|---|---:|---:|---|
| Terms of Service | No member route found | No | Profile Settings uses a toast placeholder only. |
| Privacy Policy | No member route found | No | Profile Settings uses a toast placeholder only. |
| Help | Yes | Partial | Loads, but content is shallow and includes "privacy placeholders." |
| Feedback | No | No | Help routes to `/app/flow`, not feedback. |
| Support | Partial | Partial | Help acts as support center, but no contact/ticket/feedback submission exists. |

## Social Feature Inventory

| Feature | Status | Recommendation |
|---|---|---|
| Share | Partially works | Replace raw ID text with resolved names and real share destinations. |
| Invite | Mostly works | Secure invite redemption and management are present; improve copy and requester names. |
| Reply | Not working | Hide until implemented or add minimal replies. |
| Bookmark | Not working | Hide until implemented. |
| Like / Reaction | Not clearly present | Do not surface until product decision is made. |
| Report | Partially works | Replace `window.prompt` with a real modal or hide for pilot. |

## Empty State Review

Good enough:

- My Groups empty state has Create / Find Groups actions.
- Discover Groups empty state is clear.
- Donate paused state is clear.
- Group Feed empty state is understandable.

Needs cleanup:

- Activity logging without challenge context shows an empty "Challenge" state instead of guiding selection.
- Suggested challenge empty state references admin dashboard.
- Notifications empty state is minimal and does not explain what notifications users will receive.
- Group highlighted challenges shows skeleton-like recent activity instead of a real empty state.

## Navigation Risks

- `/app/flow` is production reachable.
- Wildcard routes redirect to `/app/flow`.
- `/app/challenges/preview` is a redirect shim to suggested templates, not a stable preview page.
- `/app/profile/privacy-settings` back navigation points into onboarding.
- `/app/challenges/leaderboard` and challenge completion screens use demo defaults when params are missing.
- Quick Actions Log Activity can open activity selection without a challenge.

## Recommended Fix Order

P0 before pilot:

1. Add real Terms and Privacy member pages or external links.
2. Replace Help feedback CTA with a real feedback/support action.
3. Remove or guard `/app/flow`; change wildcard fallback to a user-safe route.
4. Hide or wire all no-op CTAs in Group Feed, Group Members, Group Detail, Groups, and Challenge Leaderboard.
5. Fix Quick Actions -> Log Activity so it chooses a real challenge before logging.
6. Replace fake Profile Privacy preview data and fix its back route.

P1 before wider pilot:

1. Make notification cards route to their targets.
2. Clean Share screen raw IDs and preview destination.
3. Remove demo defaults from challenge leaderboard/completion routes.
4. Hide disabled Apple auth buttons or explain availability.
5. Replace admin/developer copy in Help and Suggested Challenges.
6. Restrict or complete Group Highlighted Challenges.

P2 polish:

1. Improve image fallbacks.
2. Improve donate disabled payment method messaging.
3. Replace technical pagination/search copy.
4. Replace rough profile badges with real achievement logic.

## Remaining Risk

This was a static code audit. It identifies route/action/content risks from the current repo, but it does not verify every tap in a live browser session or production data condition. The highest-confidence findings are direct code evidence: placeholder toasts, no-op buttons, route fallbacks, hard-coded demo defaults, and visible placeholder copy.

## Validation

No validation commands were required for this audit-only phase. No source code was changed and nothing was deployed.
