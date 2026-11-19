# TIIZI-PREVIEW-RELIABILITY-001 — Deterministic, Disposable Founder Previews

**Type:** Engineering productivity / tooling follow-up.

**Status:** RECORDED ONLY — NOT IMPLEMENTED / NOT AUTHORISED. This record confers no implementation authority and is not a governance programme.

**Recorded by:** TIIZI-S4B-PUBLISH-MERGE-AND-CLOSURE-NEW-AGENT-001 (S4b closure, 2026-09-25).

## Trigger

During S4b Founder acceptance, the requested FINAL repeatable six-width browser/network verification could not complete because preview/browser tooling became unavailable. The Founder explicitly accepted that residual verification limitation because no S4b product blocker was identified and the accepted candidate had not changed. This follow-up exists so that future Founder previews are deterministic and disposable instead of depending on temporary worktrees, manually preserved emulator state, shell sessions and ephemeral tunnels.

## Purpose

Make Founder previews deterministic and disposable instead of depending on temporary worktrees, manually preserved emulator state, shell sessions and ephemeral tunnels.

## Future bounded scope (only if separately authorised)

- exact-SHA isolated worktree recreation;
- deterministic preview identities;
- deterministic fixture/reset data;
- emulator state lifecycle/import/export where appropriate;
- service startup and health checks;
- clean shutdown;
- local/private/public preview modes;
- browser verification readiness;
- no public Firestore/PostgreSQL/emulator-admin exposure.

## Boundary

This is an engineering productivity/tooling follow-up. Do NOT turn it into a new governance programme. Do NOT implement it under this record; any implementation requires a separate bounded authorisation. No product behaviour, authority, permission, API contract or schema is defined or changed here.

## Current manual Founder Preview procedure

For the existing local preview command (this documents manual operation; the deterministic-preview tooling follow-up above remains unimplemented):

1. Use the repository-supported Node.js 22 version.
2. From the repository root, install both lockfile scopes:

   ```sh
   npm ci
   npm ci --prefix api
   ```

   Root and API dependencies are separate; root installation alone does not install the API's `pg` package.

3. From the repository root, start the preview with `npm run preview:founder`.
4. Keep it running in a user-owned Terminal session; do not rely on a managed task session that may expire.
5. Treat preview credentials, Auth Emulator state, and the disposable database as per-run resources. Do not commit or log credentials. Restart with the same install/start steps for a fresh run.
