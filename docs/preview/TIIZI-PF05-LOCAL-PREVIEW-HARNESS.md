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
| Firebase Emulator UI | `http://127.0.0.1:4400` |
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

## Seed identities and Members

With the emulators running, run these once (both are idempotent):

```sh
TIIZI_PREVIEW_PASSWORD="$TIIZI_PREVIEW_PASSWORD" npm run preview:auth:seed --prefix api
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run preview:seed --prefix api
DATABASE_URL='postgresql://theo@127.0.0.1:5432/tiizi_pf05_preview' npm run preview:seed --prefix api -- --apply
```

The member seed is a dry run unless `--apply` is present. The Auth seed
requires the strict loopback `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
configuration and creates only:

| UID | Email |
| --- | --- |
| `preview-founder-01` | `founder1@tiizi.local` |
| `preview-founder-02` | `founder2@tiizi.local` |

## Founder preview path

Sign in at the local web app with either synthetic email and the password
exported for the Auth seed. First create a Group from the existing **Create
Group** screen. In explicit emulator mode, that screen uses the existing
governed `POST /v1/groups` API route: it writes the live Firestore Group and
owner Membership first, then synchronizes the PostgreSQL shadow. No Group is
seeded in PostgreSQL, and no Firestore authority is bypassed.

Then select the Group and enter the PF-05 Wizard at
`/app/challenges/v2/create`. The harness deliberately does not seed Challenge
data or Knowledge; the Wizard continues to use its existing governed flow.

## Safety boundaries

- The browser connects to emulators only when
  `VITE_FIREBASE_USE_EMULATORS=true` in a development build.
- The API skips ADC only when both Firebase emulator hosts are explicit,
  loopback addresses and `FIREBASE_PROJECT_ID=tiizi-preview` is supplied.
- The Auth seed rejects non-local or non-9099 targets and never logs its
  password.
- The Member seed rejects a non-local PostgreSQL hostname and never writes
  unless `--apply` is passed.
