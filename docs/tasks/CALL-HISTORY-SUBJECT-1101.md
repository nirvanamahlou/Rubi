# CALL-HISTORY-SUBJECT-1101

Owner requests actual call subject directly below the expanded history summary and above call note in contact dossier. PC-C; branch codex/pc-c-call-history-subject-1101. Bounded workspace.tsx display adds موضوع تماس: using each timeline call's own subject; blank/whitespace subject displays ثبت نشده. Existing note fallback, heading, date, destination, recording action and call data remain unchanged. No API/schema/grant/dependency changes.

Web-only build on current call-source-sms-1101 preserves SMS, queue filters, popup behavior and all other approved runtime overlays. Retain original Web image/Compose for rollback and verify unchanged API/Worker/data service IDs and Web environment/mounts during locked rollout. No test business data written.

Completion:17 existing model/form/dossier tests, scoped lint, full Web typecheck/build pass. Web-only production activation verified; login/static assets and same Web environment/mounts, unchanged API/Worker/Postgres/Redis IDs. Receipt /opt/rubi/CALL-HISTORY-SUBJECT-RELEASE-1101.json. No operational data changed.

Final integration 2026-11-03: the later owner request removes the duplicate subject inside expanded details; the existing history heading retains the subject. This supersedes the initial placement without reintroducing it.
