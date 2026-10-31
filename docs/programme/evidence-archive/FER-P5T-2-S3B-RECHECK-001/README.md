# FER-P5T-2-S3B-RECHECK-001 — Slice 3b browser evidence (archive)

Evidence-only record of the final-head browser verification of P5T-2 Slice 3b (Template Draft Editor).
This directory contains **no application code** and changes no behaviour.

## What was verified
- Tested source: `3e7036883eb85dd74e0b251ee4bb8bb360c17ef0` (tree `57b7fbe4cb3e9d4cfb8f862f873fcf37217f588d`), ancestor of merge commit `5055454ba5d5945b8ecc423524f292d9ac2e36af` with the identical tree.
- Executor: Claude Code implementation agent, Playwright 1.64.1 (headless Chromium). **This is implementation-agent evidence, not independent R1 evidence.**
- Environment: disposable loopback PostgreSQL 17 (database `tiizi_p5_preview_s3b_recheck`, marker verified by the seed script), local API, local Vite harness; synthetic users and data only.
- Result: 12 scenarios, all PASS (see [VERIFICATION-REPORT.md](VERIFICATION-REPORT.md)).

## Contents of this PR
| File | Purpose |
| --- | --- |
| `README.md` | This file, with archive references and checksums |
| `VERIFICATION-REPORT.md` | Concise per-scenario results |
| `s3b-recheck.mjs` | Reproducible Playwright matrix (credentials and local paths removed) |

## Reproduce
The harness (`harness/`) and seed scripts are retained in the private archive. Requirements: a disposable PostgreSQL cluster on a non-default loopback port, the harness rebuild script, Vite with the harness config, then
`STUB_TOKEN_AUTHOR2=<synthetic harness token> S3B_SOURCE_WORKTREE=<checkout of the tested SHA> node s3b-recheck.mjs`.
The script's output directory is created next to it (`screenshots/`, `evidence.json`, `evidence.md` — ignore these in git).

## Durable private archive
Retained outside the repository (not committed): 23 files, 1.4 MB — `README.md`, `evidence.json`, `evidence.md`, `s3b-recheck.mjs`, 11 screenshots, and the 7-file harness.

- Location (founder workstation, read-only permissions): `~/tiizi-evidence-archive/FER-P5T-2-S3B/s3b-recheck-001/`
- Manifest: `~/tiizi-evidence-archive/FER-P5T-2-S3B/MANIFEST.sha256` (SHA-256 of every file; source and copy verified identical, 23/23).
- Status: local protective copy only. **A durable off-machine private archive location has not yet been designated; Founder to name it.** Once copied there, record the reference below.
- Off-machine reference: _pending Founder designation_

### Checksums (SHA-256) of archived items referenced here
| File | SHA-256 |
| --- | --- |
| `evidence.json` | `7f7f0e3a81da6290b91fe433c2cdc0564c6515bf431c998a4d41b51786fe6148` |
| `evidence.md` | `9ed0e906efb9c87d88521a448f6b55e59a900d24bd5589f8ff3f9015155f67a2` |
| `s3b-recheck.mjs` (original, unsanitised) | `721b36bfeec8ee33684a2bdb9443f69d4d1206ab5573fb55004bcb7f120a5ceb` |
| `harness/devApiP5.ts` | `3c16acc5445608c4c983c0d37436e57816b8f5b597524567089fb437dc628894` |
| `harness/devSeedP5.ts` | `2c8193bc2a56f4875b1fefe1a06d5aef8f9507cc32ca0f7d1ed397b10c43ec15` |
| `harness/main.tsx` | `717bf0dbd2d5e5c244efe02975c2903198612e0187722f3b868372640947314c` |
| `harness/p5-harness.html` | `db640c6c509bf991106286dfbcf3b854e6f9d6b65051842e0fcb1936d204c38b` |
| `harness/rebuild-recheck.sh` | `9aa0b92524aee61c233d3a86205550069cb0ccca8acd1f351383409c52f649b7` |
| `harness/stubAuth.ts` | `87ecf6282835aa5bef7e9c53f8ec73024f5a5048121859c5609180983e075834` |
| `harness/vite.p5.config.ts` | `47bb0a3b7fe5e826c5d29612ea60b6ef6c248d2deb58a38f0db44d4d1c2473e7` |
| `screenshots/A1-account-switch-in-place.png` | `6090dae8710f731cacabd4fa39549b813ef66d2e659178571aabac4331f83907` (identical bytes to A2) |
| `screenshots/A2-account-switch-reload.png` | `6090dae8710f731cacabd4fa39549b813ef66d2e659178571aabac4331f83907` |
| `screenshots/B-canonical-sign-out.png` | `ffc7197006d3176b0fda2ca785ae19ecc4aa62c1c19705b8c6037d6de6758573` |
| `screenshots/C-stored-activity-integrity.png` | `d6495133e5565667cc89c64045f7ed3413ef7c393416fd77d9cd58f927b5df52` |
| `screenshots/D-duplicate-creation-prevention.png` | `ec12d57bad0e28d69cc02c3d051ba45cf7620e7de73708f0d6bfd67d0b568d9e` |
| `screenshots/E-conflict-hydration.png` | `f76aa16a67680115b5dca3c0c40ca7bc2089754dfcfafd8a29649d402808642e` |
| `screenshots/F1-normal-create-edit-save.png` | `8b29d091491a5486975282d9e99b75b1eebd26e6f17aa391d53992952781d7f3` |
| `screenshots/F2-mid-session-revocation.png` | `b4f80775ea15f946f10efbb4c50b0ebe0a71a8e1576cab9af8221f600e39bae3` |
| `screenshots/F3-layout-1280.png` | `909135ad9ea676f00131ae953bc8425eff5db062b2a3bc539ea8de81450bff73` |
| `screenshots/F3-layout-1440.png` | `05f0ca53a8ca0cb771d07a048484fcccd3e9a88d0fd93efda38666048f83570b` |
| `screenshots/F3-layout-900.png` | `dc4a38581e00f1ce480d34f4ad5847f6a53f9c28abb3327fd8c51b9b517277ad` |
| `screenshots/F3-layout-390.png` | `79aa4ebf1b68dd4d5c8c5532791fdf4392be14cecdab05e700f2600526eb2c04` |

The full manifest in the private archive is authoritative.

## Run history (disclosure)
The reported run is the first complete run of the final script against a freshly rebuilt database. Earlier runs failed only for script/harness defects (a bootstrap write counted as a Template write; an un-dismissed first-run prompt; a wrong audit column name; reused data across runs; slow assertions outlasting an injected 3.5 s delay), each fixed in the script with no application code changed.

## Sanitisation applied to the committed script
Local absolute worktree paths replaced with `S3B_SOURCE_WORKTREE`; the synthetic author2 bearer token replaced with the required `STUB_TOKEN_AUTHOR2` environment variable. No credentials, tokens, personal data or binaries are committed.
