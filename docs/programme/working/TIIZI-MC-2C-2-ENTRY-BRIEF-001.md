# TIIZI MC-2C-2 — Implementation Entry Brief 001

**Disposition:** PREPARED / NOT STARTED / NOT IMPLEMENTATION-AUTHORISED.

**Predecessor:** MC-2C-1 COMPLETE / MERGED (PR #99; head `e8f300005c9f9ebabe6e44618e659fb82433ab51`; merge `9b5154c69c9a540b0e9c0aae852c0b93974682f6`; Master Programme 2.77).

This brief bounds MC-2C-2. It does not authorise implementation, does not define new Product Truth, and does not reopen accepted MC-2C-1 behaviour. Implementation requires separate Founder authorisation.

## 1. Carried acceptance obligation

MC-2C-1 left one P2 unresolved and explicitly deferred. It must not be treated as closed:

> After a successful Profile name edit, Today and MemberShell must display the canonical updated name. Dependence on stale legacy/local profile-name truth must be eliminated. State must be UID-scoped with account-switch isolation. Affected member views must be invalidated or refreshed after mutation. Old-account or stale in-flight responses must not overwrite the new account's identity. Behaviour must be verified with automated tests.

Source thread: <https://github.com/Fkenogo/tiizi_challenges/pull/99#discussion_r4334148419> (`src/v2/profile/useV2Profile.ts`).

## 2. Bounded scope

| # | Capability | Acceptance intent |
| --- | --- | --- |
| 1 | UID-scoped client cache and state ownership | Every cached profile/member projection is keyed by the authenticated UID; no shared or unkeyed profile cache survives an identity change; ownership is explicit at the cache boundary. |
| 2 | Strict account-switch isolation | On sign-out or UID change, all identity-scoped state is cleared or re-keyed before any read for the new account is served; no old-account data is renderable under the new identity. |
| 3 | Post-mutation Profile and summary invalidation | A successful display-name mutation invalidates or refreshes the Profile and every summary/consumer that renders the member name; failure never reports false success or leaves stale canonical-looking state. |
| 4 | Today greeting and MemberShell name-consumer migration | Today and MemberShell consume the canonical V2 Profile name (or a single governed identity projection), not `AuthContext.profile.displayName` or legacy/local storage. |
| 5 | Account presentation and sign-out | Account identity presentation reads canonical identity; sign-out clears UID-scoped caches and in-flight work before the next identity can render. |
| 6 | Read-only Firebase email authority | Email continues to come directly from the Firebase user (read-only), never from the legacy profile cache and never from `GET /api/me`. |
| 7 | V2-owned Terms and Privacy presentation | Terms/Privacy are presented inside V2 using only Founder-approved final content and destinations. No V1 routes, no placeholders, no copied or invented legal text/URLs. |
| 8 | Regression tests | Automated tests must cover stale in-flight responses, account switching (A→B, including a late A response), and cross-screen identity consistency after a name mutation. |

## 3. Explicit boundaries

- No backend contract, schema or migration change is implied; migration 027 remains NOT PRODUCTION DEPLOYED.
- No MEDIA work: MEDIA-2b retains ownership of persistent images.
- No MC-3 onboarding/consent work, no MC-2D, no V1 modification, no production deployment.
- V1 remains frozen.
- Do not weaken MC-2C-1 guards (`scripts/testV2ProfileGuards.ts`); extend them or add sibling coverage.

## 4. Legal-content dependency

Capability 7 is dependent on Founder-approved final legal content and approved destinations. If those are unavailable when MC-2C-2 is authorised:

- Record the dependency and leave the legal presentation incomplete; do not invent text, versions, or URLs.
- Do not block capabilities 1–6 and 8 on the legal dependency; they may proceed independently.
- MC-2C-2 cannot be accepted as complete while legal presentation remains unresolved.

## 5. Validation expectations

- Six mandatory repository CI jobs stay green.
- New guards run in CI (recommend wiring the Profile cache/identity guards into the `boundary` job; the MC-2C-1 guard script `test:v2-profile` is currently committed but not invoked by CI).
- Evidence must show: post-edit canonical name in Today and MemberShell, no stale old-account render after switch, and no stale in-flight response overwriting the new account.
