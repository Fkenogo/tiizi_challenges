# TIIZI-COST-004A — Neon S6 Knowledge Catalogue Publication Runbook

**Authority:** `TIIZI-COST-003` technical preparation / `TIIZI-COST-004A` + `TIIZI-COST-004A-CORR-001`  
**Command:** `npm run knowledge:neon-publish --prefix api` ([knowledgeNeonCataloguePublishCli.ts](../../api/src/knowledgeNeonCataloguePublishCli.ts))  
**Status:** Prepared for future Founder-authorized Neon provisioning. Zero cloud execution performed by this document.

---

## 1. Direct Migration Connection vs. Pooled Runtime Connection

Neon provides two distinct connection endpoints per compute branch. Using the wrong endpoint is prevented by `validateRemoteNeonTarget`:

| Connection Type | Neon Endpoint Pattern | Purpose in Tiizi V2 | TLS Contract |
| :--- | :--- | :--- | :--- |
| **Direct Connection** | `ep-<id>.<region>.aws.neon.tech:5432` | **Migrations & S6 Catalogue Publication** (`npm run migrate`, `npm run knowledge:neon-publish`). Connects directly to PostgreSQL 17 without PgBouncer. | `uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-bundle.pem>` (or `TIIZI_DB_SERVER_CA_PEM`). Port `5432` only; no `ssl=` conflict or duplicate TLS params. |
| **Pooled Connection** | `ep-<id>-pooler.<region>.aws.neon.tech:5432` | **Cloud Run API Runtime (`tiizi-api`)**. Uses Neon's built-in PgBouncer in transaction pooling mode (up to 10,000 client connections). **Rejected** by `knowledge:neon-publish`. | `uselibpqcompat=true&sslmode=verify-full&sslrootcert=/secrets/tiizi-db-server-ca/server-ca.pem` |

---

## 2. Authoritative Target Verification (Required Before `--apply`)

Operator-supplied environment allowlists (`TIIZI_REMOTE_DB_*`) are necessary but **not sufficient** to prove Neon project and branch identity. Before `--apply` can execute, `verifyAuthoritativeNeonTarget` requires **independent authoritative proof** via one of two mechanisms:

1. **Authenticated Neon API (`NEON_API_KEY`):**
   - Calls `https://console.neon.tech/api/v2/projects`, `/branches`, and `/endpoints` using `NEON_API_KEY`.
   - Verifies that the project, branch, and an active `read_write` endpoint host match `--target-project`, `--target-branch`, and `DATABASE_URL` host.
2. **Independently Generated Provisioning Receipt (`--provisioning-receipt <path>` or `TIIZI_NEON_PROVISIONING_RECEIPT`):**
   - A JSON receipt emitted by `neonctl` or `neon-api` provisioning automation containing:
     ```json
     {
       "provider": "neon",
       "source": "neonctl",
       "project": "<neon-project-name>",
       "branch": "<neon-branch-name>",
       "database": "<db>",
       "endpointHost": "<ep-direct-host>",
       "issuedAt": "2026-11-23T12:00:00Z",
       "receiptSha256": "<optional-sha256-of-canonical-fields>"
     }
     ```
   - Every field is verified against the target parameters and exact endpoint hostname.

> **Dry-run preflight:** `--dry-run` (default) remains available for pre-provisioning validation without `NEON_API_KEY` or a provisioning receipt, and explicitly reports `authoritativeVerification.method = "unverified_dry_run_only"`. Any `--apply` invocation without authoritative confirmation **fails closed**.

---

## 3. Prerequisites & Database Baseline Gate

Before running `knowledge:neon-publish`:

1. **Isolated Empty Target:** Provision the Neon project/branch/database with PostgreSQL 17 and zero domain data (`members = 0`, `groups = 0`, `challenges = 0`).
2. **Trusted Root CA:** Supply the public root CA PEM trusting Neon's endpoint certificates (e.g. **ISRG Root X1** / system CA bundle) via `sslrootcert=<path>` or `TIIZI_DB_SERVER_CA_PEM` (never both).
3. **Apply Migrations (`001`–`034`+) via Direct Endpoint:**
   ```bash
   export DATABASE_URL="postgresql://<owner>:<password>@<ep-direct-host>:5432/<db>?uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-pem-path>"
   npm run migrate --prefix api
   ```
   Confirm `migrate: already up to date` on re-run.
4. **Baseline Integrity Gate (`verifyRemoteNeonBaseline`):** Before any write, the tool verifies:
   - Exact set equality between `schema_migrations` and committed `api/migrations/*.sql` (no missing or unexpected migrations).
   - `members = 0`, `groups = 0`, `challenges = 0`.
   - `knowledge_items` matches **only** the initial migration-014 exemplar baseline (`FIT-STR-001` + `WEL-MND-003` published at v1) **or** a complete, previously published 118-activity S6 baseline (84 Fitness, 34 Wellness, all `published`).
5. **Create a Pre-Publication Neon Branch Snapshot (Recommended):** Create a clean Neon restore point / branch (`pre-s6-publish`) so recovery is instant if any validation fails.

---

## 4. Governed Publication Procedure

### Step 1: Set Target Allowlist, Connection, and Authoritative Proof
```bash
export DATABASE_URL="postgresql://<owner>:<password>@<ep-direct-host>:5432/<db>?uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-pem-path>"
export TIIZI_REMOTE_DB_HOST="<ep-direct-host>"
export TIIZI_REMOTE_DB_PROJECT="<neon-project-name>"
export TIIZI_REMOTE_DB_BRANCH="<neon-branch-name>"
export TIIZI_REMOTE_DB_NAME="<db>"
# Supply either NEON_API_KEY or --provisioning-receipt <path>
export NEON_API_KEY="<neon-api-key>"
```

### Step 2: Run Dry-Run Verification (Default)
```bash
npm run knowledge:neon-publish --prefix api -- \
  --target-provider neon \
  --target-project "<neon-project-name>" \
  --target-branch "<neon-branch-name>" \
  --target-db "<db>" \
  --confirm-target "neon:<neon-project-name>:<neon-branch-name>:<db>"
```

### Step 3: Execute Governed Apply
```bash
npm run knowledge:neon-publish --prefix api -- \
  --target-provider neon \
  --target-project "<neon-project-name>" \
  --target-branch "<neon-branch-name>" \
  --target-db "<db>" \
  --confirm-target "neon:<neon-project-name>:<neon-branch-name>:<db>" \
  --apply
```
Verify output:
- `target.authoritativeVerification.verified === true`
- `publication.verification`: `{ "total": 118, "published": 118, "byKind": { "fitness": 84, "wellness": 34 }, "composerSelectable": 118, "duplicateCodes": 0 }`
- `publication.errors` is `[]`

---

## 5. Failure Modes & Recovery

| Failure Condition | Guard Behavior | Recovery |
| :--- | :--- | :--- |
| Non-Neon host, `-pooler.` endpoint, non-5432 port, or conflicting TLS params | Fails closed in `validateRemoteNeonTarget` before opening any network connection. | Use the direct `ep-*.neon.tech:5432` endpoint with `uselibpqcompat=true&sslmode=verify-full` and a single CA source. |
| Missing/mismatched `NEON_API_KEY` or `--provisioning-receipt` on `--apply` | Fails closed in `verifyAuthoritativeNeonTarget` before any DB write. | Provide valid `NEON_API_KEY` or a bound provisioning receipt matching project, branch, database, and endpointHost. |
| `schema_migrations` mismatch or unexpected `knowledge_items` / domain rows | Fails closed in `verifyRemoteNeonBaseline` before any write. | Reconcile migrations or provision a clean empty Neon branch/database. |
| Partial failure during `--apply` | `importS6Catalogue` and `publishDevCatalogue` are idempotent and preserve UUIDs and `knowledgeVersion`. | Re-run `--apply` once resolved, or reset the Neon branch to the `pre-s6-publish` snapshot. |

---

## 6. Disposable Local Database Guard Preserved

`openGuardedDisposableDb` ([disposableDbGuard.ts](../../api/src/disposableDbGuard.ts)) and `npm run knowledge:dev-catalogue` ([knowledgeDevCataloguePublishCli.ts](../../api/src/knowledgeDevCataloguePublishCli.ts)) remain **completely unchanged** for local loopback disposable databases.
