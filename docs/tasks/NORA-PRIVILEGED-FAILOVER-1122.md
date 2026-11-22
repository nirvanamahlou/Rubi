# Nora privileged provider availability — 2026-11-22

PC-C; base bd301dda3; branch codex/pc-c-nora-provider-failover-1122. Owner requests no application consumption quota for native danial/demo accounts and Groq/OpenAI failover when the selected provider reports quota exhaustion. Existing operator UUID exemptions match exactly those two IAM usernames; verified read-only on production without exporting IDs/credentials.

## Behavior

Native authentication determines consumptionExempt in server-only options, never request JSON, headers, role names or model output. Exempt users already bypass per-user/IP/concurrency counters; now their per-run40000-token and8-transport-attempt consumption caps are also not applied. Ordinary users retain all original limits. Wire/context/output limits,8 engine turns,6 reads, deadlines, evidence/SQL validation and current-scope/authentication checks remain mandatory execution safety controls. This does not promise a response to every unsupported, unauthorized, cancelled or faulty request.

Hybrid routing remains unchanged for normal users. For exempt users, each request has its own provider wrapper: Groq quota -> GPT4.1; GPT quota -> GPT-OSS120B on Groq. Reauthenticate/revalidate native scope before transmitting the same stage/messages/evidence to the other approved provider. At most one cross-provider switch per step; use the working provider for following steps and permit returning to a recovered provider on later quota failure. No rejected generation is executed and no shared routing state leaks between accounts. Security/source/schema failures never trigger failover. Actual provider quotas, billing/credit limits and cooldowns remain enforced.

Workbench guide selection also tries GPT for exempt users after Groq429, retaining its exact topic/goal allowlist; if both fail, the existing vetted internal guide remains available. No new API keys, accounts, quota groups or pricing/billing changes.

## Validation

213 service tests pass, including13 new HTTP/transport/failover cases. Coverage: native identity vs spoofed headers/body, privileged requests exceeding ordinary token/attempt quota, unchanged normal quota, both providers exhausted, reverse recovery, cancellation/revocation, current-evidence preservation, account isolation and guide fallback. Scoped lint/format/syntax and hosted exact-head CI gate publication. No migration, dependency, permission or business-data change. All five modified existing production modules match the Git base before deployment; publish only those modules plus the new helper, retaining runtime wrapper/credential files/native scopes. Live fault simulation must not exhaust actual provider quota or use customer records.

## Publication completed

PR1852 merged to develop as5bc856b32c7cf1e53bc1e9320ad94d7bd42aea6b after all9 exact-head CI checks passed on cbc5599a0c63d4002ba1af9eb645b5ce8cafdab2. Production candidate passed all213 service tests without production credentials or network access. Six source files were activated after verified encrypted source/runtime backup. Receipt /opt/rubi/nora-privileged-failover-1122/verified.json confirms health, anonymous privileged-request rejection, unchanged core service identities/environment/mounts, no credential changes and no database changes. Native danial/demo UUID membership was independently verified read-only. Existing GPT4.1 and Groq GPT-OSS120B remain configured. Quota failures were simulated in controlled tests; no real provider quota was exhausted for validation.
