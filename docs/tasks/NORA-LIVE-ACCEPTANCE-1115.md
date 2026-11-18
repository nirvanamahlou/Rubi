# Nora v3 live acceptance — in progress

PC-C, 2026-11-15. Continuation of PR1700; PR1708 is included. The Agent implementation is already in develop, but v3 remains disabled on production.

## Repairs and verified boundaries

- Advertise tools by protocol stage and expose the actual plan-size limits to the model.
- Require the operational plan before introducing final-answer formatting instructions. Accept a successful, strictly validated four-field JSON final response after planning; do not advertise the problematic final-answer function in that stage.
- Preserve current-request result-ID validation, native context revalidation, SQL policy, the60s/8-turn/6-query limits and Germany-only egress.
- Permit one provider `tool_use_failed` protocol repair inside the same eight-turn budget, charging a conservative token reserve. Never execute or parse `failed_generation` into a tool call. Do not retry429 or rotate same-Organization keys.
- Respect Retry-After and distinguish access denial, rejected requests, quota and transport failures. Release the bounded response reader before handling generic JSON errors.
- Correct Windows HTTP-test port allocation without removing the real HTTP assertions. Change the misleading one-minute quota message to a neutral quota-availability message.

Verified locally:96 service tests,75 API/PostgreSQL/boundary tests,176 Assistant Web tests; API and Agent-enabled Web builds. API typecheck and focused lint pass; two extra exact-value oracle safeguards pass.

## Native authenticated environment

A dedicated loopback database `nora_agent_test_browser_1115` received all246 published migrations after integrating develop33efad76b, including the Agent views. A unique read-only login inherits only `nora_agent_reader`; native API startup admission succeeded. No migration was applied to the operational Rubi database or production by this acceptance unit.

Native IAM/API/BFF checks:24 successful checks, covering login, exact discounted100.0000 USD, read-only/private-table rejection, missing-session and invalid-Origin rejection, own/branch/all scopes, hidden contracts, payment permission, company changes, stale context and revoked sessions. A deterministic control provider with native IAM also confirmed mid-flight session revocation returns401 before any SQL executes; this is not a Groq-model test. Temporarily renaming the amounts view in this test database returned503 rather than zero; the view was restored and the financial reference rechecked.

Browser: native login with an explicitly synthetic account succeeded. The existing contract guide, Persian navigation arrows, closing/reopening and conversation retention were observed. Web -> BFF -> Nora -> Groq was reached; final financial response was blocked by Groq quota. This is **not** completed model/browser acceptance. The isolated runtime uses Web3000, API4000 and Nora44320; these ports are test services, not production data.

## Live model gate

Actual Germany-routed Groq responses and native tool calls were observed. Earlier attempts produced real plans, SQL, current-request result IDs and a grounded count response. Subsequent attempts exposed remaining protocol/ambiguity failures and depleted the Organization quota. Both TPM and TPD429 were observed; TPD Retry-After values included513 and294 seconds. A delay sufficient for one next model call is not necessarily sufficient for the entire Agent conversation. The owner chose waiting for quota rather than increasing the Organization allowance.

**Certified on the final source:0/30.** Do not combine successful samples from different source revisions into a passed matrix. No final-source financial-model or complete authorization-model certification is claimed.

The fixture now includes two companies/branches/owners, hidden/draft/cancelled contracts, ADT/CHD/INF, multiple services, USD/IRR, discount, actual payment status names and fixed timestamps around Tehran midnight. Trusted raw-fixture SQL checks visibility and monetary reference values independently of model SQL. Supported counts must produce cited ANSWER responses; needless clarification is a failure. Unique receipts preserve all attempts outside Git.

`run-live-acceptance.mjs --run-synthetic` runs serial isolated cases, initially accumulating one hour of quota and pacing later cases against the verified200000-token daily allowance. It retries only quota failures, stops on a semantic/assertion failure, fingerprints source files to reject mixed-version results, and never merges or deploys. It is not a substitute for final browser testing and human review of the financial receipts.

## Remaining and rollback

Complete the same-source30-case matrix, repair any remaining non-quota failures, manually verify financial/access outcomes and finish the authenticated browser matrix, including selected-contract/follow-up and negative transport cases. Only then may CI-approved changes be merged and v3 enabled under the deployment lock with reviewed backup/rollback.

Production v3 configuration, database and services were not changed by this unit. The separately authorized stable release22f85a6e3 remains installed; preserve it and peer runtime overlays during future rollout. Local rollback stops only the owned test services/runner; keep synthetic receipts and identify test databases/logins by exact recorded names before cleanup. Do not drop shared NOLOGIN roles or operational records. Background evaluation must stop if the pinned source changes.

Quota-paced runner started2026-11-15 at13:45 Tehran on the fixed source fingerprint c9c0ee075d96b365acd9935d6ea7de2f4c08cee74fc750e479c6a8aaf9e3bfb4. Initial eligible attempt14:45 Tehran. Local metadata: F:/DevData/Temp/nora-quota-acceptance-1115-134526/nora-live-acceptance-progress.json. It is waiting, not a passed matrix.
