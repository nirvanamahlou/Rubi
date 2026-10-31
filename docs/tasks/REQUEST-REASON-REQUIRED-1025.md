# REQUEST-REASON-REQUIRED-1025

PC-C; user requires the request reason on creation and every edit. Previously the UI and service only required it when closing or reopening. The form now marks the field as required and rejects whitespace before submitting. DTO validation rejects missing/blank/oversized reasons; the service independently rejects missing/blank reasons before starting a write transaction. Existing saved requests are unchanged and must receive a meaningful reason when next edited. English validation text follows the existing translation catalogs.

No migration, dependency, PBX, ownership or popup-policy changes. Existing generated next-env.d.ts changes are preserved outside the commit. Tests cover creation/edit markup, DTO edge cases, service rejection across request states, and unchanged stored data on rejected edits. Valid request fixtures now supply a reason.



Verification so far:58 API tests pass against dedicated disposable nora_ci on54398;6 Web form/i18n tests pass. Scoped lint, affected API source/test typecheck and API build pass. The regression test runs after existing shared-fixture assertions to preserve their isolation. Initial attempts hit a wrong disposable database guard and resource timeouts; the correct dedicated database rerun passes completely. The isolated Web build moved onto the same drive as Next dependencies after a Windows cross-drive module-resolution failure; no shared dependencies changed.

The production compiler succeeds with webpackBuildWorker disabled and cpus2 in the ignored temporary build configuration; the repository next.config.ts remains unchanged. This avoids the stalled worker observed during the initial build. Full Web typecheck and65-page generation pass. Browser acceptance passed below.


Local acceptance passed onlocalhost3000: required attribute and asterisk are present; submitting a synthetic title with spaces-only reason shows the expected validation error before any write. No operational request saved. WebPID18012 and APIPID26816 use F:/Projects/Rubi/tmp/request-reason-1025; API dependency links are private absolute package junctions. Incoming/outbound popup settings and worker preserved. Screenshot:tmp/request-reason-1025/required-reason.png (ignored).64 tests, scoped lint, affected API types/build and full Web types/build65 pages pass.
