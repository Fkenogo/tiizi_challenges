# TIIZI-COST-004A — Neon S6 Knowledge Catalogue Publication Runbook

**Authority:** `TIIZI-COST-003` technical preparation / `TIIZI-COST-004A` implementation  
**Command:** `npm run knowledge:neon-publish --prefix api` ([knowledgeNeonCataloguePublishCli.ts](../../api/src/knowledgeNeonCataloguePublishCli.ts))  
**Status:** Prepared for future Founder-authorized Neon provisioning. Zero cloud execution performed by this document.

---

## 1. Direct Migration Connection vs. Pooled Runtime Connection

Neon provides two distinct connection endpoints per compute branch. Using the wrong endpoint is prevented by `validateRemoteNeonTarget`:

| Connection Type | Neon Endpoint Pattern | Purpose in Tiizi V2 | TLS Contract |
| :--- | :--- | :--- | :--- |
| **Direct Connection** | `ep-<id>.<region>.aws.neon.tech:5432` | **Migrations & S6 Catalogue Publication** (`npm run migrate`, `npm run knowledge:neon-publish`). Connects directly to PostgreSQL 17 without PgBouncer. | `uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-bundle.pem>` (or `TIIZI_DB_SERVER_CA_PEM`). |
| **Pooled Connection** | `ep-<id>-pooler.<region>.aws.neon.tech:5432` | **Cloud Run API Runtime (`tiizi-api`)**. Uses Neon's built-in PgBouncer in transaction pooling mode (up to 10,000 client connections). **Rejected** by `knowledge:neon-publish`. | `uselibpqcompat=true&sslmode=verify-full&sslrootcert=/secrets/tiizi-db-server-ca/server-ca.pem` |

---

## 2. Prerequisites

Before running `knowledge:neon-publish` against a newly provisioned Neon PostgreSQL 17 database:

1. **Isolated Empty Target:** Provision the Neon project/branch/database with PostgreSQL 17 and zero domain data (`members = 0`, `groups = 0`, `challenges = 0`).
2. **Trusted Root CA:** Obtain the public root CA PEM trusting Neon's endpoint certificates (e.g. **ISRG Root X1** / system CA bundle) and supply it via `sslrootcert=<path>` or `TIIZI_DB_SERVER_CA_PEM`.
3. **Apply Migrations (`001`–`034`+) via Direct Endpoint:**
   ```bash
   export DATABASE_URL="postgresql://<owner>:<password>@<ep-direct-host>:5432/<db>?uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-pem-path>"
   npm run migrate --prefix api
   ```
   Confirm `migrate: already up to date` on re-run.
4. **Create a Pre-Publication Neon Branch Snapshot (Recommended):** Create a clean Neon restore point / branch (`pre-s6-publish`) so recovery is instant if any validation fails.

---

## 3. Governed Publication Procedure

The CLI is **dry-run by default** and requires explicit environment allowlists plus matching `--target-*` and `--confirm-target` arguments. It never logs or prints `DATABASE_URL`, passwords, or secrets.

### Step 1: Set Target Allowlist & Connection Environment
```bash
export DATABASE_URL="postgresql://<owner>:<password>@<ep-direct-host>:5432/<db>?uselibpqcompat=true&sslmode=verify-full&sslrootcert=<ca-pem-path>"
export TIIZI_REMOTE_DB_HOST="<ep-direct-host>"
export TIIZI_REMOTE_DB_PROJECT="<neon-project-name>"
export TIIZI_REMOTE_DB_BRANCH="<neon-branch-name>"
export TIIZI_REMOTE_DB_NAME="<db>"
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
Verify:
- `target.migrationsCount >= 34`
- `target.memberCount === 0`, `target.groupCount === 0`, `target.challengeCount === 0`
- `import.readyForIngestion === true`, `import.conflicts === 0`, `import.expected === 118`, `import.received === 118`

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
- `publication.verification.total === 118`
- `publication.verification.published === 118`
- `publication.verification.byKind`: `{ "fitness": 84, "wellness": 34 }`
- `publication.verification.composerSelectable === 118`
- `publication.verification.duplicateCodes === 0`
- `publication.errors` is `[]`

### Step 4: Verify Idempotency (Optional)
Re-running Step 3 must report `import.created: 0`, `import.updated: 0`, `import.unchanged: 118`, `publication.alreadyPublished: 118`, `publication.toPublish: 0`, `publication.published: 0`.

---

## 4. Failure Modes & Recovery

| Failure Condition | Guard Behavior | Recovery |
| :--- | :--- | :--- |
| Mismatched `--confirm-target`, `--target-*`, or `TIIZI_REMOTE_DB_*` env allowlist | Fails closed **before** opening a network connection. | Correct the target confirmation or environment variable; zero DB changes occurred. |
| `-pooler.` Neon endpoint passed in `DATABASE_URL` | Fails closed before connecting (`pooled (-pooler) endpoint`). | Switch `DATABASE_URL` and `TIIZI_REMOTE_DB_HOST` to the direct Neon endpoint. |
| Remote host without `sslmode=verify-full` or missing CA | Fails closed in `validateRemoteNeonTarget` / `resolveVerifiedTls`. | Add `uselibpqcompat=true&sslmode=verify-full` and supply `sslrootcert` or `TIIZI_DB_SERVER_CA_PEM`. |
| `members > 0`, `groups > 0`, or `challenges > 0` | Fails closed in `verifyRemoteNeonBaseline` before any write. | Do **not** run against a populated database. Provision a fresh empty Neon branch/database. |
| Partial failure during `--apply` | `importS6Catalogue` and `publishDevCatalogue` are idempotent and preserve UUIDs and `knowledgeVersion`. | Re-run `--apply` once the transient issue is resolved, or reset the Neon branch to the `pre-s6-publish` snapshot. |

---

## 5. Disposable Local Database Guard Preserved

`openGuardedDisposableDb` ([disposableDbGuard.ts](../../api/src/disposableDbGuard.ts)) and `npm run knowledge:dev-catalogue` ([knowledgeDevCataloguePublishCli.ts](../../api/src/knowledgeDevCataloguePublishCli.ts)) remain **completely unchanged** for local loopback disposable databases.
