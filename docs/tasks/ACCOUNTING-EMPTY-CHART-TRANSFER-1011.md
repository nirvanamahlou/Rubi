# Accounting chart without a ledger

Owner: PC-B. Direct user request authorizes this bounded Finance Web change and develop merge.

When the books request succeeds with no accessible ledgers, the chart route keeps the existing chart/editor visible. Users can inspect group, general and subsidiary forms and the detail-level controls. Create/select-ledger links explain the prerequisite. Unbound draft edits are local and are discarded when selecting a ledger; all persistence actions remain disabled and submission rejects a missing ledger. Existing book permissions and backend scope are unchanged. Loading/request failures remain distinct from the empty state.

Nine chart regressions, scoped lint and Web typecheck pass. Production Web build and remote CI are recorded in the PR. No migration or dependency change.

The local transfer package is deliberately outside Git. Its snapshot contains 1 book, 222 accounts and 27 configurations (26 detail types, 1 approval policy). Other business accounting tables are empty. The 248 source command records refer to source users and are preserved in a separate archive, not replayed or attributed to a destination user. The importer requires an explicit existing active destination branch, exact database name, package checksum and empty destination accounting tables. Default execution validates the complete transfer and rolls back. Apply requires a destination backup; generated IDs and all nested references are remapped within a serializable transaction. No existing rows/users are changed. Destination Web stays3000/API4000. Receiving-machine execution is not claimed.

PR789 implementation head `5aaddb93` passed all eight push/PR CI checks (quality, full tests, production build and PostgreSQL migration/seed). The local i18n inventory exceeded its 30-second time limit under resource contention; the same check passed in full remote CI.
