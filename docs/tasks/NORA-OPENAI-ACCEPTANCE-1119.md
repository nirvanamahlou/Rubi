# Nora OpenAI acceptance on PC-C

On 2026-11-19, GPT-4.1 passed scenarios 3–30 against disposable synthetic PostgreSQL fixtures via the OpenAI Chat Completions endpoint. Source fingerprint `58dc4bc9687a2533f369edba4e94beb867914a46e0d920223bc1b0f6cd15e154`. The source-unavailable control used zero model requests and the revoked-session control returned UNAUTHENTICATED. Existing numeric and authorization oracles were retained. All 196 assistant service tests and scoped ESLint pass.

Earlier runs exposed OpenAI stop-with-tool-call responses, non-ASCII aliases, implicit calendar selection, and incorrect substitution of contractual amounts for unavailable payments. The OpenAI adapter handles the validated tool response shape and adds specific query and evidence guidance. The full matrix reran after the fixes. Private credentials and receipts are kept outside tracked files.

This result covers the OpenAI candidate with synthetic data. The Groq run has its own receipts. Production activation and authenticated browser acceptance are separate. [Draft PR 1804](https://github.com/nirvanamahlou/Rubi/pull/1804).
