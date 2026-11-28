# Nora isolated acceptance runners

For a separate OpenAI evaluation of scenarios 3–30, set
`NORA_ACCEPTANCE_PROVIDER=openai` in the private acceptance environment and
load `OPENAI_API_KEY` from a separate private env file. Use a dedicated receipt
directory and a synthetic loopback PostgreSQL configuration. The OpenAI adapter
uses GPT-6.1 Sol via Chat Completions. Leave Groq relay settings in the Groq test
environment. The OpenAI receipts track their own provider and cannot resume a
Groq run. No production configuration is needed for this evaluation.

Use the immediate runner for new synthetic model acceptance runs:

```text
node scripts/operations/nora-agent/run-live-acceptance-fast.mjs --run-synthetic
```

Set NORA_ACCEPTANCE_ENV_FILE to the existing private test configuration and
NORA_AGENT_ACCEPTANCE_RECEIPT_DIR to a private, dedicated receipt directory.
Never place secrets or receipt contents with private payloads in Git. Existing
loopback/database fixture guards and all30 numeric/access oracles still apply.
Source files (including the runner/helper and all assistant runtime modules) are
fingerprinted. The private receipt-directory lock prevents overlapping runs.

After quota/transport interruption, `--resume` reuses only passed cases with the
same complete source hash and intact original SHA256-verified receipt contents.
Any changed source or receipt stops for review. An existing progress file cannot
be overwritten by a fresh run; select a new private directory for a changed source.

`NORA_ACCEPTANCE_GROQ_MODE=ssh-pool` uses the existing remote container's shared
pool without exporting credentials. The runner shares one helper/pool across
the matrix through a random local IPC endpoint, retaining process-local cooldowns.
Set `NORA_ACCEPTANCE_SSH_HOST` to the
authorized SSH alias (default `erp-server`). Its disposable helper rechecks local
authorization interactively before retry, returns actual attempt/token charges,
and exits with the runner; it does not change the production service. Startup
checks the Germany proxy and remote credential/config/error dependency hashes
against this checkout. The candidate pool source runs from memory; nothing is
written into the container. Its production service and existing pool remain intact.
`local-proxy` instead uses the local private configuration and shared repository
transport with an already-owned Germany CONNECT forward. Start Node with
`--use-env-proxy`; child workers receive the flag explicitly. Unset mode retains
the original SSH single-key path. Never pass private env content on command lines.

Healthy scenarios run serially without initial delay or success pacing. There
is no hardcoded hour or hypothetical200000-token/day calculation. Actual429
feedback uses the transport's retryAfterMs; an absent/invalid retry time stops
for review instead of guessing or busy-looping. Repeated quota failures remain
bounded, and there is no final sleep when no retry will follow. A failed oracle
stops immediately; removing pacing never converts failure into a pass.

For root-cause collection only, `--diagnose-all` continues after an independent
oracle failure and returns a failed final status listing those cases. Quota
exhaustion still stops the run. It never ignores a failed assertion or changes a
fixture, permission, budget or expected result. A clean full run is still required
for acceptance; partial passes from another source hash cannot be carried forward.

The original run-live-acceptance.mjs belongs to the separate active1114 acceptance
unit and remains unchanged. Do not replace or edit its running source, lock or
receipts. Start a fresh isolated run with the fast runner and its current source
hash. No shared tunnel, Production service, credential, DB or quota changes are
made by this tooling update.

Per-request application budgets, SQL statement timeouts and provider access/rate
rules are unchanged. They must remain enabled when testing the actual product;
bypassing them would not verify the behavior experienced by ERP users. The local
runner's child timeout still bounds fixture/bootstrap hangs, and six consecutive
quota failures stop for review rather than automatically requesting forever.
