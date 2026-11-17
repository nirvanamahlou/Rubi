# Correct false cross-organization Groq cooldowns — 2026-11-17

PC-C; branch `codex/pc-c-nora-quota-groups-1117`, base develop4d1182948;
follows PR1778/1779.

## Confirmed cause and corrected interpretation

The private deployment grouped all six credentials under the manually assigned
`groq-main` alias. It did not retrieve a provider organization identity for every
key. A real organization-scoped 429 on the primary credential therefore cooled
all six entries. The previous report incorrectly treated that configured alias
as proof that all six actual organizations shared a quota.

A second independent defect was reproduced after correcting the private alias:
every admission-rejected401/403/429 reserved the entire prompt-byte upper bound
plus completion allowance as if inference had completed. For a synthetic request
with33000 remaining and22000 per-send admission bound, one quota rejection spent
22000 invented tokens and prevented any send to the healthy replacement. The
result was `AGENT_TOKEN_BUDGET_EXCEEDED`, also rendered by Web as generic429.
This explains why grouping correction alone did not guarantee failover for a
large-context Agent request.

The owner now clarifies the keys were created using distinct accounts. Two
low-cost synthetic probe rounds independently obtained HTTP200 with every key,
through the existing Germany route. Responses advertised1000 request and8000
token limits. Successful responses did not expose organization identity; remaining
counters alone are not definitive identity evidence. Separate emails alone are
also not proof of separate organizations. Do not promise1000 additional daily
calls per key regardless of actual organization membership or other limits.

## Correction

- Replace the unverified universal private alias with per-credential provisional
  quota aliases, preserving key order, values, permissions and enabled state.
  These represent the owner's corrected account provenance, not fabricated
  provider organization IDs.
- Organization-scoped failures block only their configured group. Existing pool
  code then tries the next eligible credential within the original budget and
  deadline, without replaying SQL or prior Agent steps.
- If Groq actually returns an organization ID in a quota error, retain only its
  SHA256 equality token in memory. Matching observed identities additionally
  share cooldowns even when provisional aliases differ. Raw provider identity
  and error text never enter logs, Git or public responses. Discovery may require
  a bounded request on an unobserved key; known shared scopes are then skipped.
- Log only the safe quota-unit enum (TPM/TPD/RPM/RPD/ITPM/OTPM/unknown), alongside
  existing nonsecret aliases/timing and opaque observed-group ordinal. Organization
  identity is not logged.
- Admission-rejected attempts still consume the original8-wire-call budget and
  share the same deadline. A rejected response does not fabricate completed
  inference usage; explicit valid reported usage is charged, invalid counters
  fail closed. Every send still passes the unchanged conservative token admission
  check; successful model usage and tool_use_failed generation allowances remain
  in the same40k budget. No SQL or complete Agent run is replayed.
- No model, TLS, Germany egress, SQL permission, public API, IAM, migration,
  dependency or Web change. Policy/request/transport errors retain existing rules.

## Acceptance and rollout gates

Added regressions: configured organization A cooling down must skip its peer and
reach organization B; matching quota-unit words must not join independent groups;
actual matching provider identities must link provisional aliases without leaking
IDs. Preserve existing shared-quota, concurrency, stale-success, budget, native
authorization and SQL-not-replayed tests.

Run full service tests, scoped lint/format and all final-head hosted CI before
source deployment. Reuse the existing host deployment lock and private source/
runtime/config backup. Create a separate candidate source and private credential
file, change only organization aliases, mount read-only mode0600 and preserve all
other environment/mount/network restrictions. Keep both previous source and pool
file for rollback. Compare native container/source/config and peer IDs before
activation. Replace Nora only; no database changes.

Live acceptance must simulate the primary quota response in an independent
synthetic probe process, then obtain a real response with the next eligible key.
Do not exhaust real quotas intentionally or alter shared pool state for fixtures.
Verify main health, alias-only pool events and authenticated ERP chat/guide after
activation. Record actual results separately from simulated failures.

All earlier same-organization statements in the initial release documents refer
to the old configuration assumption and are superseded by this investigation.

## Inherited CI compatibility

Both hosted quality jobs independently fail on the unmodified base's completed
WORKBENCH-MISSION-1117/PR1783 `MissionFinanceEditor` render-time `Date.now()` and
raw image warning under the zero-warning gate. Consume published PC-A fix6e2832876
for clock state/deadline handling; its committed ownership note records the
Mission owner's completion and no active overlap. Use the existing unoptimized
localized Image wrapper for authenticated attachment previews, preserving the
source URL, preview size class and lack of optimizer requests. No gate is disabled.
This is a bounded baseline compatibility repair, not a Workbench workflow change;
its Web source is not part of the Nora-only production overlay.

## Recorded acceptance

-168 repository service tests pass, including the three new cross-organization
  regressions. Scoped ESLint and formatting pass.
-All six credentials independently returned HTTP200 with a synthetic prompt from
  Germany, in two low-cost rounds. No raw credential or provider identity logged.
-A separate candidate process simulated a primary organization429, then made
  exactly one real Groq call using `groq-2`. Model tool `set_plan` succeeded,
  retry-authorization callback ran once, and the shared model budget recorded
  two attempts. SQL was not involved and no real quota was exhausted.
-The private configuration correction reuses the unchanged already-reviewed
  transport: six provisional groups replace the one unverified group. Candidate
  health/backup/CAS precede activation; credentials/order/environment/source and
  peer containers are preserved. Provider-identity hardening is a separate source
  update and remains gated by the new PR's exact-head CI.

Final additional regressions cover the high-context rejected-budget reproduction,
reported rejected usage exhausting the original budget, invalid usage counters,
and unchanged8-attempt exhaustion.170 repository service tests pass. Existing
mission render tests3/3 and scoped zero-warning lint pass for the inherited CI
compatibility repair. Final hosted gates and source activation remain separate.
