# Tiizi Fitness PWA

## Governance & Programme Documentation

- [Tiizi V2 Master Programme](docs/programme/TIIZI-V2-MASTER-PROGRAMME.md) — single authoritative source of Tiizi programme state
- [FEF Alignment Profile](docs/governance/FEF-ALIGNMENT.md) — project alignment with the Founder Engineering Framework baseline
- [Constitutional Foundation Index](docs/governance/platform/00-CONSTITUTIONAL-FOUNDATION-INDEX.md) — Tiizi constitutional foundation and precedence

## Run

```bash
npm install
npm run dev:mobile
```

Open: `http://127.0.0.1:5173/mockups`

## Key Routes

- `/mockups` - catalog of all provided layout screens
- `/home` `/groups` `/challenges` `/profile` `/exercises` - mapped to provided layouts
- `/app/home` `/app/exercises` etc. - functional React app screens

## Seed Firestore Exercises

Set service account credentials in your shell:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/tiizi-challenges-firebase-adminsdk-xxxx.json"
export FIREBASE_PROJECT_ID="your-project-id"
```

Then run:

```bash
npm run seed:exercises
```

## Security Scan

```bash
npm run audit:secrets
```

## Deploy

```bash
npm run deploy:firestore
npm run deploy:hosting
```
