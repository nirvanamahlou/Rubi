# Nora actual model matrix — 2026-11-16 — PC-C

Owner requests the actual30-case matrix, root-cause repairs and a result report. Isolated branch codex/pc-c-nora-live-matrix-1116 from6204acc28; no production mutation or deployment. Actual Groq calls use the existing authenticated Germany-proxy transport; fixtures use unique disposable local PostgreSQL databases and restricted per-case reader logins. No real customer records are sent to the model.

## Evidence-led repairs

1. The previous harness routed the newly introduced count-breakdown endpoint into the SQL path with undefined sql. This produced QUERY_REJECTED loops and consumed provider quota. The harness now calls the real native readContractCountBreakdown with a real fixture Prisma client; its two Reservations lifecycle tables are explicitly present, the client is disconnected before cleanup, and four native scopes are checked against raw fixture SQL. Receipts distinguish native count reads from model SQL. The runner fingerprints both native source files.
2. Seven cases passed on the intermediate source; customer-name ambiguity failed because the model returned ANSWER listing three matches without asking which contract to inspect. Clarified the final response instruction: listing candidates is not a resolution of a single-contract inspection; require CLARIFY, current evidence and explicit selection. Existing oracles and access rules remain unchanged.
3. A subsequent real response invoked an unadvertised json function twice, producing Groq tool_use_failed even after the bounded protocol repair. The adapter now advertises an existing-schema json final transport alias only after planning and canonicalizes successful calls into finish_answer. Returned tool names must belong to this request's stage. Failed generations remain unparsed/unexecuted, tool validation stays enabled, plain JSON content remains compatible, and no turn/token/query/access budget is increased. Three new transport regressions cover legitimate final calls, planning bypass and unoffered-tool rejection. Official tool contract: [Groq local tool calling](https://console.groq.com/docs/tool-use/local-tool-calling).

## Validation protocol

All119 service tests, six pacing regressions, API scoped lint and Node syntax checks pass. The independent native-count PostgreSQL preflight passes. A local-only uncommitted Vitest config resolves manifest-matching pg/parser/Prisma dependencies from the existing installed acceptance workspace; shared dependency links and lockfile are not modified. Initial setup failure before any model call is retained separately.

Every matrix attempt has a private receipt, independently derived numeric/scope references and a source fingerprint. Provider429 failures are retried only using actual provider feedback; they are not passes. Completed cases may be resumed only with exactly the same fingerprint and verified original receipts. Any source change invalidates prior passes for final certification. The final model matrix is in progress; earlier7/30 and other intermediate passes are not a final-source result. Native IAM/browser end-to-end acceptance is distinct from this real-Groq + real isolated SQL harness.

Final source results, cleanup and CI handoff will be recorded after execution. No secret, private configuration or raw model receipt is committed.
