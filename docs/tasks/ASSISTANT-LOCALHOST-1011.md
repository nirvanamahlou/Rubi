# ASSISTANT-LOCALHOST-1011 — PC-C

## Diagnosis and acceptance

The port3000 Next dev server loaded develop-localhost at ff6a8c36, which has no
assistant route. The assistant existed only on its separate e29daf76 branch
(PR779), and the requested account also needed an explicit executive grant.
Acceptance: serve the assistant-enabled build on the real port3000, retain the
current Reporting filters, preserve API4000 and existing account role/branch
scope, and grant only the requested executive screen permission.

The integration branch starts at e29daf76 and copies the two Reporting source
and test files from ff6a8c36. Three required English labels are added. The old
runtime checkout, including its modified generated next-env.d.ts, is untouched.

## Local runtime

Run `scripts/start-assistant-local-runtime.ps1` from this integration checkout
after building Web with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1.
The script checks the branch and build, refuses occupied ports, launches Next
in a hidden window, and writes ignored PID metadata/logs under tmp. It never
stops arbitrary listeners or starts/restarts the ERP API.

This is a production build of the local frontend. Source edits require another
Web build and a restart of the verified Web process. Rollback: stop only the
recorded Web PID, then restart Next dev in the preserved develop-localhost
checkout at ff6a8c36. No protected-branch merge or remote deployment occurs.

## Temporary IAM maintenance

`apps/api/src/iam/local-executive-access.mjs` is an operator command owned by IAM,
not an Agent Tool or HTTP endpoint. It accepts an exact active username, defaults
to dry-run, requires a local DATABASE_URL, and executes a serializable transaction.
`--apply` grants one isolated per-user role with only
ui.screen.assistant.executive. `--apply --revoke` removes only that membership.
Shared, system, inactive or widened roles fail closed. An audit records the local
operator context without impersonating an ERP user. Existing roles/branches stay
unchanged. It reuses the selected ERP checkout's compiled database client.

Example, from this checkout with a valid local DATABASE_URL already supplied:

```powershell
node apps/api/src/iam/local-executive-access.mjs --erp-root <ERP_CHECKOUT> --username <EXACT_USERNAME>
node apps/api/src/iam/local-executive-access.mjs --erp-root <ERP_CHECKOUT> --username <EXACT_USERNAME> --apply
node apps/api/src/iam/local-executive-access.mjs --erp-root <ERP_CHECKOUT> --username <EXACT_USERNAME> --apply --revoke
```

The owner-selected account was granted this temporary permission; one grant
audit exists, existing roles were preserved and branch assignments unchanged.
The existing API reads role grants from the database per authenticated request.
Refresh the frontend session (sign out/in if needed) to refresh client permissions.
Revoke this development grant before final rollout; it has no automatic expiry.
No passwords, session creation, broad administrator bypass or schema migration.

## Verification and limits

51 focused Web tests cover assistant, navigation, access policy, Reporting and
translations. Four native Node IAM maintenance tests pass. Scoped ESLint, Web
typecheck, maintenance formatting, PowerShell parser and Web production build
pass. Actual authenticated browser verification depends on the owner's login;
no real session is forged. Business forecasts/news/LLM data remain unavailable
until the documented provider/source gates are resolved.

Actual runtime verification: port3000 now belongs to the combined Next start
process, while API4000 retains its original PID. Startup is clean; requesting
/assistant without authentication correctly redirects to login with next=/assistant
and returns HTTP200. The browser displays that login page. No authenticated
end-to-end result for the owner's real session is claimed.

## CI follow-up

PR780 CI found a test-runner mismatch: Vitest discovers the IAM .test.mjs file
but node:test declarations do not register Vitest tests. Use the API's Vitest
runner for the same four assertions; do not exclude the file or weaken the gate.
The changed-file formatting gate also identified WORK_ASSIGNMENTS.md and the
assistant README. Format both and recheck every changed supported file. The
owner authorizes merge to develop only after all checks on the final revision
pass. No local runtime or permission mutation is needed for this CI repair.
