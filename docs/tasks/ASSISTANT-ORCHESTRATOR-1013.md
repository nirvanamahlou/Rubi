# Gated conversation preparation

Owner PC-C; branch codex/pc-c-assistant-orchestrator-1013; stacked on PR822.

## Delivered preparation

Prepared-action composition is extracted unchanged from HTTP and shared with the
bounded orchestrator. Six tool calls maximum, one planner call, 1.5s planner budget
inside the existing 10s request deadline; no retries. The registry/executor and
fresh native IAM remain authoritative. Planner output accepts only one of three
actions plus v2 filters, or a fixed clarification code. No model-produced amount,
URL, SQL, scope, permission or arbitrary answer is accepted. Evidence comes from
the existing validated action output; no financial arithmetic is moved to a model.

POST /v2/assistant/conversation is additive. Native authentication/rate limits,
64KiB body cap, strict version/message/history schema and final identity recheck
apply. History is untrusted context, never source evidence or permissions. Audit
records metadata/outcomes only, not messages, cookies or provider errors. The BFF
also requires same-origin POST JSON and bounds body size/time before fixed transport.

There is deliberately NO production provider adapter or activation environment
variable. The runtime entrypoint never injects a provider: conversations return503
CONVERSATION_DISABLED. Tests alone inject synthetic planners. No organization data
is transmitted to an external model. A provider adapter requires a separate approved
processing/location/retention/cost policy, token accounting and release review.

The separate AssistantConversation component is prepared but NOT mounted in the
live workspace while that policy gate is closed. It uses React memory only, bounded
12-message history, escaped text, explicit clear, abort-on-unmount, and keyed identity/
session remount. Activation must wire the actual authenticated session key and the
existing evidence renderer; no localStorage/sessionStorage/database persistence.
Fixed actions and filter controls remain operational independently of conversation.

## Validation and limitations

Native HTTP and unit tests cover default-off/no-provider traffic, synthetic planner
through real read composition, malformed/forged messages, unknown/write/URL plans,
timeout/no retry, clarification, revocation and audit minimization. Web schema/BFF
and disabled component tests verify evidence validation, no invented text, same-origin
and body limits. Live natural-language quality, provider cost and session-switch UI
acceptance cannot be claimed before actual policy-approved activation.

No DB migration, new dependency, permission grant, cache or model framework.
CI on exact head and merged develop gates localhost rollout. Restore prior service
and Web build to roll back; no database rollback is needed.

## Pilot entry checklist

- Sales owner reconciles approved contracts/discounts/cancellation/currencies and
  route/branch cohorts against anonymized reference cases.
- Finance owner supplies/approves accounting receivables; until then contractual
  balances remain separately labeled and due recommendations stay gated.
- CEO evaluates usefulness; postponed business thresholds remain unconfigured.
- Access matrix and audit retention/deletion policy are approved before wider rollout.
- Provider policy, budget/cost metrics and natural-language acceptance set are
  approved before enabling conversation. Require zero unauthorized disclosures in
  the acceptance corpus and exact report equality to the owner reference.
- Verify latency/error dashboards, HTTPS/secret handling, shared rate limits for
  multiple instances and rollback/load/recovery before production expansion.

These are explicit uncompleted business/production gates, not technical-test claims.
