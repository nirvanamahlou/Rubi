# ASSISTANT-LIVE-CHAT-1020

PC-C; user approves Groq, message and in-memory session conversation only. ERP evidence, cookies, actor/grants and tool results are excluded from provider payload. Existing six fixed reads and native authorization/release checks remain.

Server activation requires ASSISTANT_CONVERSATION_ENABLED=true, ASSISTANT_MODEL_PROVIDER=groq, ASSISTANT_DATA_POLICY=messages-only and private GROQ_API_KEY. Off is the default. Unknown provider/policy or missing key fails startup safely. Fixed HTTPS endpoint, no redirect, strict JSON schema, 512 output-token budget, six-second planner cap within the existing ten-second request deadline; no retry. Runtime key is server-side only.

Plain REPLY has bounded text and no tool execution; model text is rendered as escaped plain text. ACTION executes a registered deterministic read; CLARIFY uses fixed localized codes. Exact money is rendered from ERP evidence separately, never appended to model history. Session messages are memory-only, bounded to twelve entries. Prepared action buttons remain independent of Groq availability. Route/branch name resolution remains an explicit clarification because no authorized name directory is supplied to the planner.

No schema, migration or dependency changes. Existing model setting openai/gpt-oss-120b supports strict JSON outputs per https://console.groq.com/docs/structured-outputs. Tests exercise opt-in policy, payload allowlist, malformed plans, no-tool replies, scope/permission revocation and invalid output. Actual generic API and Persian reply tests succeed; ERP browser rollout/CI are delivery gates and recorded on the PR.

Local cold identity reads intermittently exceeded the legacy2.5s transport deadline before the model was called. Runtime allows5s only for native identity transport, still under the unchanged10s enclosing request deadline. ERP data reads and read-only SQL statement timeout remain2.5s; no retry/cache or auth bypass.
