# IAM-003 — Login and multi-tab session stability

## Context

- Computer: `PC-B`
- Branch: `codex/pc-b-iam-login-stability`
- Draft PR: #68 to `develop`
- Base: latest `origin/develop`
- Owner request: permanently stop the recurring incorrect-password experience after local code changes and restarts.

## Verified root cause

The local IAM audit showed three administrator-bootstrap executions and three refresh-reuse failures around earlier restarts. The bootstrap implementation rewrote the password hash for an existing username, while independent browser tabs/modules could submit the same one-time refresh cookie and trigger family revocation. The Login UI also mapped every non-success HTTP response to the credential error.

No raw password, token, cookie, hash, encryption key or private environment value was read into documentation or Git.

## Implemented behavior

1. Administrator bootstrap is create-only for credentials. An existing user keeps password hash, status, failed-login counter and lock state; role and primary branch assignment remain idempotent.
2. Refresh rotation claims the active session atomically before creating its successor.
3. A matching token rotated by another request within five seconds returns `AUTH_REFRESH_CONCURRENT`/409 without revoking the family. Mismatched secrets and old reuse keep the original fail-closed family revocation.
4. Customers and Documents use one shared in-tab refresh promise and the browser Web Locks API for cross-tab serialization. Browsers without Web Locks retry the 409 once after the shared cookie can advance.
5. Login messages distinguish validation, credentials, rate limiting, server failure and network failure. Only 401 uses the generic credential message, preserving anti-enumeration behavior.

## Boundaries

- No Prisma schema, migration, seed, public contract, permission, dependency or lockfile change.
- No application account, password, session, role, branch, database row or private configuration was reset during implementation.
- PC-A remains the final IAM module owner; this is the owner-approved narrow PC-B stability exception recorded in `WORK_ASSIGNMENTS.md`.

## Validation

- API: 79 test files passed, 717 tests passed, 66 opt-in PostgreSQL tests skipped by the ordinary suite.
- Web: 71 test files and 544 tests passed.
- API/Web lint: passed with zero warnings.
- API/Web typecheck: passed.
- API/Web production builds: passed.
- Live local smoke: API health 200, Login page 200, empty Login payload 400.
- `nirvana` remains `ACTIVE`, not locked, and its existing `passwordChangedAt` was unchanged.
