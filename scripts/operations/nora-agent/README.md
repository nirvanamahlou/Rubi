# Nora isolated acceptance runners

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

Healthy scenarios run serially without initial delay or success pacing. There
is no hardcoded hour or hypothetical200000-token/day calculation. Actual429
feedback uses the transport's retryAfterMs; an absent/invalid retry time stops
for review instead of guessing or busy-looping. Repeated quota failures remain
bounded, and there is no final sleep when no retry will follow. A failed oracle
stops immediately; removing pacing never converts failure into a pass.

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
