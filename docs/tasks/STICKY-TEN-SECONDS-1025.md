# STICKY-TEN-SECONDS-1025

PC-C; user changes the preferred previous sales-agent no-answer budget from20 to10 seconds. Branch codex/pc-c-sticky-ten-seconds-1025 from developd0f8c587.

StickyDecision PREFER now carries ringSeconds10 and the selector returns10. Existing preview/service/PostgreSQL regressions assert10; queue1002 fallback, availability checks, last-answer selection, lookup deadlines and privacy behavior stay intact. Existing SSH handoff documents reflect the new policy and explicitly retain pending physical installation/controlled-call acceptance. No Web changes or popup activation.

Validation:8 preview/service tests plus12 isolated PostgreSQL tests pass; scoped ESLint passes; affected API TypeScript compilation/build passes with a bounded tsconfig. Isolated data only in the existing disposable test database. No migration/dependency change, local runtime restart, PBX write, PR or merge. A real10-second ringing timer remains dependent on installing and testing the prequeue route on the actual PBX through authorized access.
