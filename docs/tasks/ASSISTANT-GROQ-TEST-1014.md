# Groq synthetic provider preparation

Owner PC-C; ASSISTANT-GROQ-TEST-1014. The owner stored a local key after being instructed that initial connection tests use synthetic data. This authorizes only the fixed synthetic evaluation, not real-chat activation or transfer of organizational messages/results.

## Delivered

Dependency-free Groq REST adapter at a fixed HTTPS endpoint, openai/gpt-oss-120b, strict JSON Schema, no tool/search/code execution, one request/no retry, 1.5s timeout, 512 completion tokens maximum and 64KiB response cap. Transmits only projected message/history and fixed planner instructions. Cookie, actor, grants and ERP result objects are never serialized. Trusted caller injection only: server.mjs does NOT import or load the provider, even if GROQ_API_KEY is present.

Adapter validates the returned plan independently: only the three read scenarios, <=90 complete Tehran days, valid filters or fixed clarification code. Named routes/branches require clarification because a name-to-ID source has not been provided to the planner. No invented IDs, company selector or silent dropping of requested scope. This is preparation, not complete natural-language route resolution.

## Local evaluation

From the task checkout, run:

```powershell
node --env-file=F:/Projects/Rubi/.env.assistant.local services/assistant/groq-synthetic-eval.mjs --synthetic-only
```

CLI accepts no user text or history and calls no ERP API/database. Four fixed fictional cases cover daily summary, sales dates, contractual follow-up and route ambiguity. Only case ID, pass/fail, generic code and duration are printed. It stops after a failed request; never prints the key or raw provider error. No real network calls occur in CI/unit tests.

## Evidence and limits

2026-10-14: key file exists and is git-ignored; value was never printed or committed. First fixed daily request failed with a generic provider error. A bounded diagnostic GET to /openai/v1/models returned HTTP403 both with and without authentication. This proves a provider/network access denial in this environment, not key validity or successful live inference. No bypass or proxy was configured. Live semantic quality, latency and quota remain unverified. Local unit/HTTP regression tests63/63 pass; CI gates merge.

Real ERP conversation remains disabled. Before activation: approve data processing and location, account Data Controls/ZDR, permitted message/history content and budget; resolve provider access; evaluate Persian/Gregorian/Jalali/relative dates and route/branch lookups; choose a measured time budget; mount session-isolated UI; validate against reference data. No database, dependencies, public API, permissions or runtime change in this delivery.

Official interfaces reviewed: https://console.groq.com/docs/structured-outputs and https://console.groq.com/docs/model/openai/gpt-oss-120b .
