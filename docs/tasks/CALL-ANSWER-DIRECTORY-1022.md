# CALL-ANSWER-DIRECTORY-1022

Owner requests automatic person/unit/extension in the existing Call Center connected-to field. The owner confirms a shared extension must not identify one responder by guesswork.

Implementation uses confirmed ANSWERED events, retaining the latest answer timestamp despite delayed earlier events and terminal events. A bounded HR-owned public projection resolves active staff in the call's branch. All matches are displayed for shared extensions. The encrypted call payload retains the answer snapshot; both completion paths preserve it and ignore client attempts to replace the technical destination. No recipient permissions, contact ownership, PBX routing or popup delivery are enabled by this display mapping.

For the owner's empty local HR database only, CALL_CENTER_ANSWER_DIRECTORY_FILE may point to a private UTF-8 JSON document outside Git. Version1 contains branchId, connectionId and employees[{extension,name,unit}]. It is bounded to64KiB/200 entries and exact branch/connection; malformed or missing configuration shows only the confirmed extension. Once any HR employee exists in that branch, this bootstrap fallback is disabled, including when a mapped employee has been removed/inactivated. The operator-supplied personnel list is never embedded in code or fixtures. Existing historical calls are not guessed/backfilled.

No database migration or dependency change. The current form layout is preserved; only the connected-to control is read-only when a confirmed technical snapshot exists. Manual/non-answered records retain existing behavior.

Acceptance: delayed event ordering, shared directory match, branch/connection isolation, unknown extensions, private-file validation, encrypted projection preserving saved notes and the read-only form. Local runtime acceptance and exact-head CI remain to be recorded before claiming completion.

Local validation:31 API tests passed (45 opt-in PostgreSQL cases skipped locally),3 form tests passed; scoped lint, API/Web typechecks and both production builds passed. Compiled public directory verified all16 owner-provided staff entries across15 extensions against the local connection, with shared203=true. Web3000/API4000/Worker4409 health200 after a zero-active-call/zero-pending-inbox cutover. No operational synthetic call or historical backfill. Final real incoming-call acceptance requires a subsequent company call. Private local personnel file is excluded from Git. PR1068 tracks exact-head CI; source reservation freezes on publication.
