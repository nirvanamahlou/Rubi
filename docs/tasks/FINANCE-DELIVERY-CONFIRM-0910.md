# FINANCE-DELIVERY-CONFIRM-0910

PC-A, base92e99cf, branch codex/pc-a-finance-delivery-confirm-0910.

The approval buttons were disabled until an unlabelled global reason input was filled. Each contract now opens an explicit decision dialog with contract number, consequences and required labelled reason. Submit preserves the existing API permission, branch, optimistic version and audit rules. Errors stay in the dialog; success updates the row and announces the result. Starting another decision clears the prior reason; cancel performs no mutation. Empty search results are explained.

Read-only inspection confirmed the local account already has finance.financial_release.read and .approve. No grants, schema/API changes or real financial decisions were made.

Validation: scoped ESLint and TypeScript, nine Finance tests, 41-route production build; synthetic browser covered enabled entry, missing-reason prevention, correct contract/version, approval, reason reset, cancellation without writes and revocation with the returned version. Browser harness used mocked API only.

Runtime: API4000 already runs passenger/document changes from the previous task. Web3100 user-started PID24460 retained; execution policy rejected the exact normal startup command before any stop. User needs Ctrl+C and the same pnpm.cmd exec next start --hostname 127.0.0.1 --port 3100 command in their existing terminal. No public push due existing publication hold.
