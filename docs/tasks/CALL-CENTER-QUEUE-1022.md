# CALL-CENTER-QUEUE-1022

User-authorized queue simplification on the approved local b14dce24 stack.
Visible views in order: ALL (همه درخواست‌ها), OPEN (درخواست‌های باز),
CLOSED (درخواست‌های بسته‌شده), MINE (کارهای من). ALL stays the default.
Today/overdue/unassigned/no-action queue buttons are removed. Other dossier controls,
assignment rules, layout, native capture and popup suppression remain unchanged.

CLOSED is an additive queue DTO/service value, matching status CLOSED within all
actor-authorized branches. OPEN continues to cover every non-closed request.
Counts share the existing repeatable-read transaction and predicates with results.
Legacy API views remain accepted for older clients; no database migration required.

Validation: isolated PostgreSQL workflow suite 13/13, Web client suites 10/10.
Added assertions for CLOSED rows/count, ALL = OPEN + CLOSED and branch isolation.
Scoped Web lint passes. Final build/runtime results recorded in PROJECT_STATUS.
No production deployment or PR/merge in this unit. Local login requires user
credentials; automated authenticated visual acceptance is not claimed.
