# Tiizi production runtime — deployment runbook (PLAN ONLY)

Target: Fastify API on Google Cloud Run + Cloud SQL PostgreSQL 17 in
`africa-south1` (Johannesburg). Nothing in this document is executed by this
package; it defines the future provisioning sequence and its safety rules.
Phase B remains closed; no authority mode is flipped here.

## 0. Assumptions (documented, not provisioned)

- PostgreSQL 17, `africa-south1`, single-zone initially, no HA initially.
- Automated backups + PITR enabled, deletion protection on, automatic storage
  growth on, ~20 GB initial SSD unless evidence says otherwise.
- Sizing lives in the provisioning step, never in application code.
- Existing Firebase Hosting (frontend), Firebase Auth (issuer), and Cloud
  Functions stay untouched during the strangler migration. PostgreSQL/API is
  the target business-truth runtime; no Phase C domain migration happens here.

## 1. Provision Cloud SQL

Create the PostgreSQL 17 instance per §0 with private connectivity preferred;
public DB exposure is not the target design. Record the connection endpoint
for the Secret Manager step. Do not encode instance names in the image.

## 2. Configure Secret Manager / service identity

- Store `DATABASE_URL` (with `?sslmode=require` where applicable) as a secret;
  inject it into the Cloud Run service and Cloud Run Jobs at runtime.
- Give the API service identity ADC/workload-identity rights only. No
  service-account JSON is deployed with the container.
- Set non-secret env: `FIREBASE_PROJECT_ID`, `TIIZI_ALLOWED_ORIGINS`
  (exact production origins, no wildcard), `TIIZI_DB_POOL_MAX`.
- Fix the pool math now: total connections ≈
  (Cloud Run max instances) × `TIIZI_DB_POOL_MAX` ≤ Cloud SQL tier limit.

## 3. Establish API → PostgreSQL connectivity

From an ephemeral probe using the same image/network path (not from a
laptop), confirm the service identity reaches Cloud SQL over the intended
(private) route before running anything stateful.

## 4. Run migrations (Cloud Run Job or controlled pre-deploy job)

```sh
node dist/src/migrateCli.js     # same production image; local equivalent: npm run migrate
```

- Idempotent; safe to re-run. Exits non-zero on failure — gate on it.
- Migrations never run automatically on API process startup.
- Do NOT create destructive down migrations.

## 5. Deploy the Cloud Run API

Deploy the image built from `api/Dockerfile` (multi-stage, Node 22,
production deps only, non-root user, `node dist/src/index.js` on
`0.0.0.0:$PORT`). HTTPS is terminated by Cloud Run. Start with min
instances 0 unless latency evidence justifies 1; keep max instances bounded
per the §2 pool math. Do not hard-code project/service/instance/account IDs
in the repo.

## 6. Verify /health

Unauthenticated `GET /health` → 200 `{status:"ok"}`. Process liveness only.

## 7. Verify /ready

Unauthenticated `GET /ready` → 200 only when `SELECT 1` succeeds; 503
`not_ready` otherwise, with no connection details in the body.

## 8. Verify an authenticated API request

Call an authenticated route (e.g. `GET /v1/memberships/me`) with a real
Firebase ID token for a linked member. Expect the internal `member_id`, never
a Firebase UID in domain payloads. `401 invalid_token` stays reserved for
genuinely bad tokens; `500`-class init failures must never surface as auth
success.

## 9. Run Knowledge import --dry-run

`npm run knowledge:import -- --dry-run` (or compiled equivalent) against the
production database. Review planned writes; resolve malformed-source findings.

## 10. Run Knowledge import --apply

`npm run knowledge:import -- --apply`. Re-run is idempotent.

## 11. Run Knowledge parity

`npm run parity:knowledge`. Require a clean match before proceeding.

## 12. Cutover (only after clean parity)

In this order:

1. Set server Knowledge authority mode `postgres`
   (`TIIZI_KNOWLEDGE_AUTHORITY_MODE`).
2. Configure frontend `VITE_TIIZI_API_BASE_URL` and
   `VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE`, rebuild/redeploy the frontend
   (Firebase Hosting stays the host).
3. Deploy the Firestore Knowledge write-deny rules.
4. Re-verify §§6–8 plus canonical Knowledge reads through the API.

Do NOT deploy the write-deny rules and do NOT set `postgres` mode in this
package.

## 13. Monitor

Watch Cloud Run latency/error rate, `GET /ready` flap, Cloud SQL connection
counts vs tier limit, and migration-job history. Alert on pool exhaustion and
on any `firebase_admin_init_failed` (credential/identity misconfiguration).

## 14. Rollback rules

- Before §12 cutover, infrastructure rollback is straightforward: revise the
  Cloud Run service to the previous image, re-run `GET /health`, `/ready`,
  and the authenticated check. The old revision serves unchanged data.
- After PostgreSQL has accepted authoritative writes, NEVER blindly revert
  authority to stale Firestore. Reconciliation is mandatory: re-import,
  re-run parity, and review diverged lifecycle/version/content before any
  authority change, per the Phase B cutover contract in `README.md`.

## Frontend / Functions dependencies (later, not now)

- Frontend later needs `VITE_TIIZI_API_BASE_URL` +
  `VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE`. It stays on Firebase Hosting.
- Functions later need `DATABASE_URL` (or equivalent secure connection),
  `TIIZI_KNOWLEDGE_AUTHORITY_MODE`, and a supported network path to
  PostgreSQL. They are not migrated here; Firebase Auth is not replaced here.

## Manual GCP actions still required (Kenogo)

Provisioning, IAM, networking, Secret Manager values, Cloud Run service/jobs,
DNS, backups/PITR verification, and every §1–§12 execution step. This package
prepares the application surface only and performs zero cloud mutations.
