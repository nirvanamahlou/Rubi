# CALL-SOURCE-SMS-1101

Owner explicitly requests SMS in Call Center popup acquaintance-source options and contact filter. PC-C; branch codex/pc-c-call-source-sms-1101. Add SMS before Other in the existing shared sources constant consumed by call-form.tsx and workspace.tsx; same stored source value and existing filter binding. No API/schema/dependency/permission or unrelated UI change.

Production build based on the current develop-d0845c8fd-1101 Web image preserves queue layout and other approved overlays. Scope: model.ts only plus task/status notes. Existing model/form tests:15 pass; scoped lint passed. Full Web typecheck/build and Web-only activation verification follow before completion. No tests or writes against operational contact records.

Completion: full Web typecheck/build passed. Web-only image call-source-sms-1101 activated under global deployment lock; login/static assets, exact Web environment/mounts and unchanged API/Worker/Postgres/Redis IDs verified. Original Compose and previous Web image retained for rollback. Receipt /opt/rubi/CALL-SOURCE-SMS-RELEASE-1101.json. Source PR targets develop without automatic merge.
