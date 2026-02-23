# Tiizi Fitness PWA

## Run

```bash
cd /Users/theo/tiizi_revamp/tiizi
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
export GOOGLE_APPLICATION_CREDENTIALS="/Users/theo/tiizi_revamp/tiizi/tiizi-challenges-firebase-adminsdk-fbsvc-863295624a.json"
```

Then run:

```bash
npm run seed:exercises
```

## Deploy

```bash
npm run deploy:firestore
npm run deploy:hosting
```
