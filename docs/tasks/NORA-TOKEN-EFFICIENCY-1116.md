# Nora token efficiency — 2026-11-16

PC-C; branch `codex/pc-c-nora-token-efficiency-1116`, base develop `b3f899b71`.

## Implemented in priority order

1. Allowlisted per-step provider usage counters: prompt, completion, total,
   cached input and reasoning when reported. Missing counters remain null;
   no prompts, credentials or source records enter this audit event.
2. Exact context-free Persian total-contract count requests use the existing
   authorized count producer and deterministic public calculation explanation.
   Four explicitly enumerated phrases only; history, selected records, dates,
   qualifiers and other requests retain the existing model path. This route
   makes zero model calls. Every catalog/scope freshness check, count validation,
   evidence citation and final calculation gate remains in the same engine.
3. Lossless tool-table serialization: retain columns once and encode rows in
   column order when at least four uniform rows produce a smaller payload.
   All cells, decimal strings, nulls, observation time, source IDs, calculation
   metadata and truncation flags remain. Heterogeneous/extra-field tables fall
   back verbatim. Only outbound tool messages change; original evidence and
   user/system/history messages remain untouched. No cross-request cache.
4. Consume the published same-owner final-tool/citation safeguards from PR1761
   to avoid known malformed-final recovery calls. No failed generation is
   executed; only currently advertised tools/current evidence IDs are allowed.
   This consumes published source without changing the original branch.

## Validation and measurement

All136 Node service tests pass, including native route 401/403 denial, scope
change, inconsistent counts, excluded ambiguous requests, row round-trip,
decimal/null preservation, transport usage and provider cooldown protections.
Scoped ESLint and formatting pass. The native Node service has no TypeScript
compilation step; syntax checks and its HTTP/service tests cover affected code.
No API/Web/DB/schema/dependency changes or deployment.

Live benchmark uses the existing Germany-only Groq transport and synthetic
tables only. Before/after use the same model `openai/gpt-oss-120b`, temperature0,
reasoning low and completion ceiling2048. Both must produce identical expected
JSON: row and per-currency counts, the exact decimal string and
truncation flag, ignoring an instruction embedded in a data cell.

| Rows | Prompt before | Prompt after | Total before | Total after |
| --- | ---: | ---: | ---: | ---: |
| 4 | 362 | 334 | 500 | 478 |
| 20 | 866 | 662 | 1006 | 800 |
| 40 | 1496 | 1072 | 1648 | 1237 |

These are provider-reported token counts, not byte estimates. Cached-token
counts were not supplied by these responses; no cache-hit savings claimed.
The40-row input reduction is28.3%; total reduction24.9%. Four-row reduction
is7.7% input and4.4% total. Reasoning/output tokens can vary despite temperature0.
This is a small transport benchmark, not proof of a universal savings rate or
the full30-case live semantic acceptance. The existing same-source live matrix
was not reused as acceptance for this changed source.

## Safety-gated follow-up

Do not silently deploy a smaller model, discard history, shorten financial
rules, globally lower output caps, cache business answers or weaken scope
revalidation merely to reduce tokens. Those proposals remain pending a broader
live semantic comparison. Existing bounded retries and daily-quota failure
handling remain; pacing cannot reduce daily token totals. This work does not
claim all suggested architectural optimizations have shipped.

Native count savings are100% of model tokens for its four supported phrases,
not100% of database work or all Nora requests. Benefits for an actual workload
must be measured from the new usage events and native-route frequency.

Six successful live calls across three paired cases returned exactly the expected JSON. The20-row after variant required two429 responses with provider-directed cooldowns (258s and36s), then passed; no fake/mocked token counts were substituted. Aggregate successful-call input2724->2068 (24.1% reduction), total3154->2515 (20.3%). Failed calls lack usage and are excluded from this successful-call comparison.

Raw synthetic receipts: [measurements](NORA-TOKEN-EFFICIENCY-1116-MEASUREMENTS.json). Offline fixtures: node scripts/operations/nora-agent/token-efficiency-benchmark.mjs 40. The private live adapter only used existing Germany transport and never copied keys locally or changed runtime configuration.
