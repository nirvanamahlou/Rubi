# Phase1 continuation — PC-C

Base develop04acd08a. Human requests remaining Phase1 work and explicitly allows
operational contractual balances separately while Finance receivables wait for an
approved producer. V1 still sends no data to a model and has no write tools.

## Sources and meaning

Sales weekly keeps creation-date windows and confirmation/lifecycle checks. New
optional contractAmountsBeforeRefunds supplies exact separate-currency discounted
contract amounts, explicitly before refunds. These are not refund-adjusted net sales.

GET /sales/assistant/contract-balances requires sales.contracts.read.all AND
sales.payments.read. Current confirmed noncancelled contracts only. More than5000
matching contracts fails closed; aggregate totals are never silently truncated.
Discounted contract amounts, confirmed/pending receipts and contractual outstanding
use existing Sales Decimal logic per currency. First30 positive-outstanding contracts
link to /sales; list truncation is separate from totals. Refunds, due dates and
accounting receivables remain explicitly unavailable. Pending/rejected receipts
never reduce outstanding; overpayment can create a negative credit balance.

GET /customer-affairs/assistant/call-conversion requires lead.read and Sales
all-read. Actor branch scope is retained. Each lead with logged CALL evidence
counts once per period; accepted handoffs only convert when the Sales public reader
confirms a valid contract confirmed after that period's first call, as of request.
No customer-ID guessing, probability or repeated-handoff counting. Logged CALL is
not proof of an answered call or complete attribution. Null denominator returns
null percentage. No lead/customer/call text or contract IDs leave this aggregate.

Sales action includes optional validated conversion. Receivables shortcut returns
PARTIAL contractual balances plus explicit accounting/due/refund gates. Daily
summary retains SELF evidence and separate permission-controlled corporate Sales
and balance sections. IAM is rechecked before release; extra fields are stripped.
Unavailable and denied sources remain distinct and never become invented zero.

## Local read runtime decision

The shared Core predates these endpoints; replacing it could activate unrelated
dispatchers/migrations. An ERP-owned Nest runtime in apps/api composes existing
native IAM and the owned read controllers only. It starts no business/background
module, login/write controller or migration. AI backend remains a separate
HTTP-only consumer with no database credential or arbitrary query capability.

Before constructing any database pool, force default_transaction_read_only=on
and statement_timeout2500ms; verify the session setting. Accept only GET/HEAD and
bind loopback4301. Native JWT issuer/audience, session, role and branch checks stay.
The optional server-configured report base applies only to three allowlisted
 report paths; personal data reads keep the normal ERP base. Identity can use the
 current native IAM authority on that report runtime through ERP_AUTH_API_BASE_URL
 (default: configured report base). Fixed personal-source preflight and release
 checks use native manual screen policy, preserving new revocations even while
 Core is older. No IAM policy file or grant is changed. The normal ERP API
can serve all sources after those endpoints are published in its approved runtime.

```powershell
node --env-file=<private-ERP-env> apps/api/dist/assistant-read/main.js
$env:ERP_REPORTS_API_BASE_URL='http://127.0.0.1:4301/api/v1'
# ERP_API_BASE_URL stays the ordinary ERP base for IAM and personal sources.
node services/assistant/server.mjs
```

Production still needs least-privilege DB credentials, private HTTPS ingress,
central limits/audit/retention and owner acceptance. Local session read-only is
verified enforcement, not a production certification. No secrets or real records
are committed, and Core/database operational state is preserved.

## Acceptance and dependencies

Tests cover exact discount/multiple-currency/partial-payment money, cancellation,
cap/scope/permission, logged-call dedup/confirmation order, ratios and source
windows, field stripping, safe links and revocation. A disposable random
nora_assistant_test_* database applies existing migrations and tests PostgreSQL →
native JWT report API → independent assistant → Web proxy/schema. SQL writes are
refused; cleanup removes only the verified disposable database.

Finance-approved accounting receivables are deliberately deferred by the human.
A refunded receipt is not automatically a commercial sales reduction; net sales
needs an approved adjustment projection avoiding double subtraction after repricing
or cancellation. Full multi-segment routes, answered-call attribution and owner
reference reconciliation are not certified by synthetic tests. No forecasts,
news, LLM or Write capabilities are introduced.
