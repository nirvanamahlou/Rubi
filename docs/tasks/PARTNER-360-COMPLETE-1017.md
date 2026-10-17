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
