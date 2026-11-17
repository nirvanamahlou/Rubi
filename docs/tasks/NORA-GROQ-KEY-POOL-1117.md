# Nora shared Groq credential pool — 2026-11-17

Owner: PC-C. Branch: `codex/pc-c-nora-groq-key-pool-1117`.

## Runtime contract

`groqConfigurations()` must be called exactly once at process startup, including
custom deployment entrypoints. It constructs one transport for Agent v3, legacy
conversation and Workbench tool selection. All preserve their existing timeout,
response validation, policy and native authorization boundaries. Germany CONNECT
admission remains mandatory; there is no direct fallback.

Set `GROQ_KEY_POOL_FILE` to an absolute private JSON file path. Pool configuration
takes precedence over `GROQ_API_KEY`. Without the file setting the current single
key remains supported through the same transport. A malformed, missing, oversized
or publicly readable file fails startup with a sanitized configuration error.
On POSIX use mode 0600 and the Nora runtime UID; mount the file read-only. On
Windows restrict the ACL to the service account. No live reload is supported.

Schema example **contains no credentials**:

```json
{
  "version": 1,
  "keys": [
    {
      "id": "groq-primary",
      "organization": "groq-main",
      "enabled": true,
      "apiKey": "REPLACE-IN-PRIVATE-FILE"
    }
  ]
}
```

Maximum 32 entries and 32 KiB. `enabled` defaults to true. Optional `project` is
an operator-maintained nonsecret quota alias. Duplicate secrets are retained only
once, in original order. All keys supplied for this rollout belong to the same
`groq-main` organization; no independent capacity is inferred from their creators.

The current healthy key stays selected. Invalid credentials disable only that
entry until restart; key/project-specific quotas cool the corresponding scope.
Organization quotas stop the whole organization. An ambiguous 429 permits one
diagnostic next-key attempt; a repeated matching quota category stops the group.
Retry-After and exhausted request/token reset headers determine recovery; absent
valid timing the fallback is 60 seconds. Shared 403 policy/model/access denials do
not rotate. Request-shape/tool errors and network/TLS/relay/5xx errors never mark
a healthy key invalid or blindly rotate credentials.

Expired cooldowns admit one half-open probe. Generation checks prevent a late
success from clearing a newer failure. Logs contain only aliases, categories,
attempt count and next-eligible time. The pool holds no user context or evidence.
This is process-local state; multiple replicas require a shared coordinator.

## Retry budget and permissions

Only the failed model HTTP call is repeated, with identical serialized payload
and abort signal. No SQL or prior Agent step is replayed. Before a replacement
send, the Agent rechecks its native catalog/context; guide/chat revalidate native
identity. The original step/request timeout continues. Actual HTTP attempts count
toward the existing eight-call Agent ceiling. Failed replacement attempts reserve
the existing conservative body-byte/completion allowance from the same 40k budget.
Scope changes/revocation prevent acquired evidence being sent on another key.

## Validation and release gates

Synthetic pool tests cover ordering, deduplication, invalid settings, scoped and
ambiguous quotas, Retry-After, half-open concurrency, stale success, policy/tool/
transport errors, abort/revocation and budgets. Full Agent/provider/pool tests
prove failover after SQL uses the same evidence payload and executes SQL once.
Runtime tests prove guide and Agent share cooldown state. Existing service tests
remain required. No deliberate live quota exhaustion is permitted.

Local final-source validation: 164 service tests pass (25 new targeted/integrated
pool checks), scoped ESLint and source formatting pass. These native Node modules
have no separate compilation artifact; full repository build/type gates run in CI.

Pending: exact-head hosted CI, secure server provisioning,
Nora-only deployment and authenticated browser acceptance. No live success or
deployment is claimed by the implementation tests alone.

## Nora-only deployment and rollback

Acquire the existing host deployment lock. Privately back up current container
inspection, mounted source, entrypoint and environment. Compare current source
against the reviewed base and preserve unrelated peer additions. Construct a new
private source directory and entrypoint calling the shared factory. Privately
prepend the current primary key to supplied keys 2–6, deduplicate, set owner/mode
and mount read-only; add only the pool path environment setting. Keep all other
environment, relay, NO_PROXY, operator exemptions and container restrictions.

Run service tests and health admission with the candidate source. Under the lock,
recheck source/config/container identities and switch only Nora. Preserve the old
container and private configuration for rollback: stop the replacement, restore
the retained old container name and start it. Its existing single-key environment
and original entrypoint remain intact. No migration, API/read-boundary/Web/worker
replacement or database writes are needed.

Live smoke uses only synthetic text/tool selection, never customer records. Verify
the active entrypoint and read-only file mount, safe alias-only audit, real Groq
response and authenticated ERP chat/guide. A shared quota error is a controlled
outcome, not evidence that another key has independent quota.

Reference: [Groq rate limits](https://console.groq.com/docs/rate-limits).
