# B2B Compose and contract upload repair — 2026-10-06

## Result

The new-agency registration flow stages contract and guarantee files until the organization has an ID. It then uploads each file through the public Documents API. Confidential files also need an actor/session-bound `CONFIDENTIAL_VIEW` grant when B2B validates and attaches the file. The staged-save path previously omitted those grants, so the documents could upload while contract save failed with a document-reference error.

The staged flow now requests a fresh grant for each confidential upload and sends `referenceGrants` alongside the matching document IDs to the B2B agreement endpoint. The existing organization/branch source reference, scan and document access rules remain authoritative. Permission preflight now also checks metadata access for every staged proof and file-read access for confidential proofs before creating the organization.

The local Compose overlay provides API and Web services on `4192` and `3100`, respectively, and joins the existing `nora-internal` network. It reuses the configured Rubi database, Redis, MinIO and document-storage location. It does not define or restart data services.

## Validation

- Organizations registration/upload and agreement grant regressions: 27 tests passed.
- Documents multipart HTTP and B2B agreement reference suites: 27 tests passed.
- Scoped ESLint, Web typecheck, Contracts build, API dependency build and Web production build (55 routes) passed.
- The first local Compose launch exposed that Next.js was invoked at the monorepo root rather than `apps/web`; this caused the Web healthcheck to fail. The follow-up `B2B-COMPOSE-WEBROOT-1006` adds the app directory to the Compose command.
- Docker image build now passes. With that startup fix, the API and Web Compose containers are healthy, `GET /api/v1/health` on port 4192 returns `ok`, and `GET /login` on port 3100 returns HTTP 200. Existing PostgreSQL, Redis and MinIO containers remain healthy and were not restarted.
- No authenticated browser upload was performed. Confidential-reference attachment behavior is covered by the focused Organizations and Documents API regressions; a real upload through the UI remains unverified.
- No operational data mutation, IAM grant, migration or data-service restart was performed.

## Handoff

PR #673 from `codex/pc-b-b2b-compose-appstack-1006` was merged to `develop` as `cf696496`; PR #675 corrected and verified the Compose Next.js root and merged as `3d48ef15`. Both PRs passed their exact-head CI gates. Compose API and Web are running locally with healthy checks on ports 4192 and 3100. The previously user-authorized branch memberships remain outside this upload fix; no branch access was changed here.
