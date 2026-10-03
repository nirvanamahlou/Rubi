# FINANCE-TICKET-PAYMENT-0928

COMPUTER_ID=PC-A. Branch: codex/pc-a-finance-ticket-payment-0928, base origin/develop@e4eb048c.

Payment methods now use a native accessible select within the payment dialog. Failed reads and empty active outgoing-method lists produce explicit feedback with a retry button; no payment method is invented or enabled automatically. The user selects an existing method from Finance's public options endpoint.

Existing persisted seat-count/unit-cost pricing and server-side Decimal multiplication are retained. The client invoice preview now uses exact four-decimal integer arithmetic instead of floating point and rejects fractional/unsafe seat counts and unsupported precision. Existing Finance payment revisions support multiple partial payments, reject overpayment and release purchase costs only when fully paid. The dialog explains staged payments and falls back to the invoice total when settlement has not begun.

Validation: 11 targeted Web tests and scoped ESLint passed; Web TypeScript and production build (53 routes) passed. No new migration, dependency, shared contract, permission, operational payment or data changes. Original checkout edits and running Web3100/API4000 are preserved. Local runtime runs from .worktrees/develop-finance-integration on develop; apply the reviewed task through a separately approved integration/runtime update. Browser interaction with the authenticated live page is not verified.
