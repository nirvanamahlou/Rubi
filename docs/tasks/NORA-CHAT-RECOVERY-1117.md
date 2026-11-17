# Nora chat recovery —2026-11-17

## Confirmed root cause

Authenticated production browser POST /api/assistant/v2/conversation returns503. The mounted Nora runtime uses authorized-erp-results with Agent enabled and therefore intentionally reports legacyConversationEnabled=false. Current Web runtime flags are true, but the served client composer retains a runtime reference to NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED instead of an inlined true value; the browser consequently selects v2. A reload reproduces it. Retained older static chunks also contain enabled composers, so scanning an arbitrary old file is not evidence of the active build.

Nora health200, native unauthenticated snapshot401, tunnel active and real synthetic Groq completion200 were separately verified. The actual mounted provider also successfully completed a synthetic tool-planning call. These checks identify a Web build mismatch rather than a stopped service or expired model credential.

## Repair and prevention

Rebuild only the currently deployed Web image with NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED=true and ASSISTANT_AGENT_ENABLED=true available before Next build. Preserve all current product source, private runtime configuration, existing hashed assets, TLS/Origin/CSRF checks, native authentication and data permissions. Do not enable legacy messages-only fallback or change model/SQL policy. Nora, its read boundary, API, worker, database and Germany tunnel remain unchanged; demo/danial quota exemptions remain configured.

New scripts/operations/nora-agent/verify-web-build.mjs certifies the fresh generated client composer before retaining old assets. It rejects missing composers/builds, non-inlined/disabled flags and mixed stale/current outputs. This is intentionally a release admission check for an Agent-enabled build, not a runtime endpoint or a product heuristic. If the bundler representation changes, update the explicit guard with regression evidence rather than silently accepting an unknown bundle.

Example within an explicitly Agent-enabled image build:

```sh
NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED=true ASSISTANT_AGENT_ENABLED=true node node_modules/next/dist/bin/next build --webpack
node /nora-release/verify-web-build.mjs /workspace/apps/web/.next/static
# Only after the check succeeds, retain previous hashed static assets.
```

Five targeted Node tests pass. Scoped formatting and syntax checks apply; no package/schema/migration/native module source changes. Current production build runs full Web compilation/type validation plus the fresh-bundle guard. Final activation and authenticated browser evidence are recorded in this task's PR release notes after execution; preparatory health/provider tests alone do not certify browser recovery.

## Operational boundaries and rollback

Private host receipts and backup Compose are in /opt/rubi/nora-chat-recovery-1117. All phases use /opt/rubi/avina-deploy.lock and baseline container IDs plus Compose digest; a competing deployment stops activation. Activate changes only the Web image and checks local/public health; automatic failure restores the previous image. Explicit rollback restores only the saved Web image, retaining current private config. No business data or schema rollback is needed. Never commit private environment values, customer data, headers/cookies, keys or connection strings.