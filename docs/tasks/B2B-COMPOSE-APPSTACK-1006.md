# B2B Compose and contract upload repair — 2026-10-06

## Result

The new-agency registration flow stages contract and guarantee files until the organization has an ID. It then uploads each file through the public Documents API. Confidential files also need an actor/session-bound `CONFIDENTIAL_VIEW` grant when B2B validates and attaches the file. The staged-save path previously omitted those grants, so the documents could upload while contract save failed with a document-reference error.

The staged flow now requests a fresh grant for each confidential upload and sends `referenceGrants` alongside the matching document IDs to the B2B agreement endpoint. The existing organization/branch source reference, scan and document access rules remain authoritative. Permission preflight now also checks metadata access for every staged proof and file-read access for confidential proofs before creating the organization.

The local Compose overlay provides API and Web services on `4192` and `3100`, respectively, and joins the existing `nora-internal` network. It reuses the configured Rubi database, Redis, MinIO and document-storage location. It does not define or restart data services.

## Validation

- Organizations registration/upload and agreement grant regressions: 27 tests passed.
- Documents multipart HTTP and B2B agreement reference suites: 27 tests passed.
- Scoped ESLint, Web typecheck, Contracts build, API dependency build and Web production build (55 routes) passed.
- Compose configuration validation passed.
- Docker image build and container health/live upload check could not be completed because Docker Engine returned an internal HTTP 500 and then stopped responding. The existing database, Redis, MinIO and host app processes were left untouched.
- No live browser authentication/upload test, operational data mutation, IAM grant, migration or data-service restart was performed.

## Handoff

Task branch `codex/pc-b-b2b-compose-appstack-1006` is based on the current `develop` head. Exact-head CI and review remain required before merging. Compose runtime verification is still needed after Docker Engine becomes healthy. The previously user-authorized branch memberships remain outside this upload fix; no branch access was changed here.
