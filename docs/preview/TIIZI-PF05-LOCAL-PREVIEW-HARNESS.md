# PF-05 Local Founder Preview Harness

This is a local-only preview path for PF-05. It uses Firebase Auth and
Firestore emulators, a supplied local PostgreSQL URL, and two synthetic
identities. It does not deploy, import V1 data, create Challenges, or contact
hosted Firebase.

## Ports

| Service | Address |
| --- | --- |
| Firebase Auth emulator | `127.0.0.1:9099` |
| Firestore emulator | `127.0.0.1:8080` |
| Firebase Emulator UI | `http://127.0.0.1:4401` |
| Tiizi API | `http://localhost:4000` |
| Vite web app | `http://127.0.0.1:5173` |

## One-time setup

From the repository root, copy the safe client example:

```sh
cp .env.preview.example .env.local
cp api/.env.preview.example api/.env
```

The API example is set for the Founder database:

```text
postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview
```

Apply the existing API migrations to that local database before the first
preview:

```sh
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run migrate --prefix api
```

Choose a local password without adding it to a file or shell history. Export
it only in the terminal that runs the one-time Auth seed:

```sh
export TIIZI_PREVIEW_PASSWORD='choose-a-local-preview-password'
```

## Run the three visible services

Use separate terminals so each service retains its own logs.

Terminal 1:

```sh
npm run preview:emulators
```

Terminal 2:

```sh
npm run preview:api
```

Terminal 3:

```sh
npm run preview:web
```

## Seed identities, Members, and the governed preview Group

With the emulators running, run these once (both are idempotent):

```sh
TIIZI_PREVIEW_PASSWORD="$TIIZI_PREVIEW_PASSWORD" npm run preview:auth:seed --prefix api
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run preview:seed --prefix api
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run preview:seed --prefix api -- --apply
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run preview:component-group --prefix api
```

The member seed is a dry run unless `--apply` is present. The Auth seed
requires the strict loopback `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
configuration and creates only:

| UID | Email |
| --- | --- |
| `preview-founder-01` | `founder1@tiizi.local` |
| `preview-founder-02` | `founder2@tiizi.local` |

`preview:component-group` is idempotent and creates no Challenge data. It
uses the existing governed Group mutation authority: a live Firestore Group
and active owner Membership are created first, then PostgreSQL is synchronized
as a shadow/identity anchor. Before every browser preview, the API verifies
that same live Firestore owner Membership again; a PG row alone never grants
context or establishment permission.

## Founder preview path

Open this exact local component URL:

```text
http://127.0.0.1:5173/preview/v2/challenge-creation
```

If not already signed in, the local-only route redirects to Login and returns
directly to the component after authentication. No legacy Home, BottomNav,
Groups UI, Challenge list, or Create Group journey is rendered or required.
The component uses the real PF-04 Composer, PF-03 validation, governed V2
establishment route, and V2 detail read model. On establishment it opens a
neutral result inspection view at
`/preview/v2/challenge-creation/result/:id`, never the V1 Challenge UI.

## Safety boundaries

- The browser connects to emulators only when
  `VITE_FIREBASE_USE_EMULATORS=true` in a development build.
- The API skips ADC only when both Firebase emulator hosts are explicit,
  loopback addresses and `FIREBASE_PROJECT_ID=demo-tiizi-pf05-preview` is supplied.
- The component route is emitted only with both a development build and
  `VITE_TIIZI_V2_COMPONENT_PREVIEW=true`; its API context route is registered
  only under the same strict demo-emulator runtime. Production has neither
  route, and the fixture command rejects every non-demo/non-loopback target.
- The Auth seed rejects non-local or non-9099 targets and never logs its
  password.
- The Member seed rejects a non-local PostgreSQL hostname and never writes
  unless `--apply` is passed.
