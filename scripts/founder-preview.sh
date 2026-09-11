#!/usr/bin/env bash
# Local Founder Preview stack. No production credentials, no production
# hosts. Starts: local Postgres (docker-compose), Firebase Auth+Firestore
# emulators (demo project, no real credentials), the tiizi-api against
# local Postgres, and the Vite frontend with V2 flags + emulators enabled.
#
# Usage: bash scripts/founder-preview.sh
# Stop: Ctrl+C (best-effort cleanup of started background processes below).
set -euo pipefail
cd "$(dirname "$0")/.."

CRED_FILE="$(pwd)/.local-emulator/fake-service-account.json"
if [ ! -f "$CRED_FILE" ]; then
  echo "==> Generating throwaway local-only ADC file (never a real credential; emulator calls ignore it)"
  mkdir -p .local-emulator
  KEY="$(openssl genrsa 2048 2>/dev/null | sed ':a;N;$!ba;s/\n/\\n/g')"
  cat > "$CRED_FILE" <<EOF
{
  "type": "service_account",
  "project_id": "demo-tiizi",
  "private_key_id": "fake",
  "private_key": "${KEY}",
  "client_email": "fake-local@demo-tiizi.iam.gserviceaccount.com",
  "client_id": "000000000000000000000",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
EOF
fi

echo "==> Postgres (docker-compose, local only)"
POSTGRES_PORT="${POSTGRES_PORT:-5434}" docker compose up -d postgres
until PGPASSWORD=tiizi psql "postgresql://tiizi:tiizi@localhost:${POSTGRES_PORT:-5434}/tiizi" -c 'select 1' >/dev/null 2>&1; do
  sleep 1
done

echo "==> API migrations"
DATABASE_URL="postgresql://tiizi:tiizi@localhost:${POSTGRES_PORT:-5434}/tiizi" \
  npx --prefix api tsx api/src/migrateCli.ts

echo "==> Firebase Auth + Firestore emulators (demo-tiizi project, no real credentials)"
firebase emulators:start --project demo-tiizi --only auth,firestore &
FIREBASE_PID=$!
trap 'kill "$FIREBASE_PID" "$API_PID" 2>/dev/null || true' EXIT

sleep 6

echo "==> tiizi-api (local Postgres + local emulators only)"
(
  export PORT=4210
  export DATABASE_URL="postgresql://tiizi:tiizi@localhost:${POSTGRES_PORT:-5434}/tiizi"
  export FIREBASE_PROJECT_ID=demo-tiizi
  export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/.local-emulator/fake-service-account.json"
  export FIRESTORE_EMULATOR_HOST=127.0.0.1:8092
  export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9399
  export TIIZI_ALLOWED_ORIGINS=http://localhost:5173
  npx tsx api/src/index.ts
) &
API_PID=$!

sleep 2
echo "==> Seed synthetic Founder Preview dataset (idempotent-ish; re-running adds duplicate challenges)"
node api/seed_and_prove.mjs || echo "(seed/proof script reported failures — see output above)"

echo "==> Frontend (V2 flags + emulators ON, local only)"
VITE_TIIZI_API_ENABLED=true \
VITE_TIIZI_V2_CHALLENGES_ENABLED=true \
VITE_TIIZI_API_BASE_URL=http://localhost:4210 \
VITE_USE_FIREBASE_EMULATORS=true \
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9399 \
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8092 \
VITE_FIREBASE_PROJECT_ID=demo-tiizi \
  npm run dev:mobile

wait
