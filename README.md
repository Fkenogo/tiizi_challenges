# Tiizi Fitness PWA

## Start Here — Tiizi Version 2

- [Tiizi V2 Programme Guide](docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md) — human-readable orientation: where Tiizi came from, where the programme is now, what carries forward from V1/early knowledge work, and how V2 returns to implementation
- [Tiizi V2 Master Programme](docs/programme/TIIZI-V2-MASTER-PROGRAMME.md) — single authoritative source of Tiizi programme state
- [Repository Classification Report](docs/programme/TIIZI-REPOSITORY-CLASSIFICATION-REPORT.md) — explains current authority, programme evidence, V2 inputs, legacy evidence and archive candidates
- [Constitutional Foundation Index](docs/governance/platform/00-CONSTITUTIONAL-FOUNDATION-INDEX.md) — Tiizi constitutional foundation and precedence
- [FEF Alignment Profile](docs/governance/FEF-ALIGNMENT.md) — project alignment with the Founder Engineering Framework baseline

> Root-level wellness, pre-beta, clean-build and historical engineering documents may remain useful evidence, but they should not be assumed to represent the current V2 programme or product authority. Start with the Programme Guide and Master Programme.

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
