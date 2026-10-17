# Partner360 completion — PC-B — in progress

The product owner explicitly authorizes PC-B to implement the bounded Finance
producer as well as the supplier/broker dossier consumer. Other Finance owners
and active work remain unchanged. The prior PR912 producer wait is superseded.

Credit direction: COUNTERPARTY_TO_US. Never use customer receivables as supplier
payables, assign AGENCY to a supplier, combine currencies, or turn unavailable
exposure into zero. Existing agency/corporate paths remain compatible.

Acceptance: the eye action opens the role-specific dossier; all existing agency
sections have real role-safe backends and editable identity/contact/geography;
contracts, permanent/temporary credit, guarantees, rates/discounts/commissions,
financial evidence, documents and activity are branch/permission scoped. Test
multi-role isolation, expired credit, maker/checker, version conflicts and replay.
No production payment, outbound message or destructive operation is authorized.

Source starts from origin/develop@877a7286. No schema/dependency lock is taken
at reservation; inspect current owners before any schema need is implemented.
Push/review/green exact-head CI/merge precede a backed-up local3100 rollout.

Implementation and verification are not yet complete; do not mark delivered.

## Current candidate and acceptance gates

User confirms25 concurrent staff and authorizes both this dossier and manual USD
rate on the same delivery. The currency field is optional unitsPerUsd Decimal,
1USD=N actual record-currency units; no implicit IRR/toman conversion and no
transaction FX replacement. B2B role CHECK and nullable true Finance request
organization/role FKs are forward compatible; migrations are additive and no
legacy free-text party is backfilled. Sole Migration scope is in WORK_ASSIGNMENTS.

All agency dossier sections reuse their public producers, with partner financial
tabs reading actual purchases, version-owned payments, checks/requests,
settlements, disputes and received-credit availability. Old unlinked records use
an explicit audited setup command, not a write on View. Import and native edit
continue to use the canonical dossier/contact/geography persistence from PR912.
Agency customer receivables, passenger access and Finance release are unchanged.

Rollout: verify all gates -> merge exact reviewed head -> fresh verified backup
of the local database/private runtime config -> deploy migrations -> API -> Web.
Rollback application image/config to the saved version while retaining additive
columns and all new financial evidence. Do not drop fields/roles or restore an
old database over new business data. Any destructive rollback requires separate
review/approval. No real business payment, message or imported production record
is used for testing.

Checkpoint:22 isolated PostgreSQL scenarios passed before the currency and role
FK regression additions.65 initial API and42 initial Web tests passed; latest
broader API pass had228 passed and one stale default-role mock expectation,
corrected with an added explicit SUPPLIER forwarding assertion. Final reruns,
build/lint, browser, CI, merge and rollout remain pending.

Database Designer tooling ran on bounded current/target schemas; its migration
generator fails internally serializing Column. Prisma validation/generated types
and actual disposable PostgreSQL migrations/constraint tests are authoritative.
No unsupported tool result is represented as successful migration validation.
