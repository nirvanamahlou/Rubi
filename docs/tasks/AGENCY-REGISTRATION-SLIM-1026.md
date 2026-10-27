# Agency initial registration — 2026-10-26

Owner-marked fields move out of initial AGENCY intake: company national ID,
registration number, economic code, chief executive national ID and job title.
Their storage, full dossier identity/contact editors and native field permissions
remain unchanged. Editing an existing agency retains its stored/prefilled values.

The agency wizard shows identity, representatives, phone verification and final
review. It never mounts the contract/credit editor or uploads contract guarantees.
Its save projection disables any stale contract flag/pending files and defers the
five fields. Attaching an existing agency does not clear its identity attributes.
Successful save uses the existing openProfile flow to open dossier360, which
retains AgreementWorkflowPanel and its full contract/guarantee/version/approval
operations. Corporate-customer registration keeps its previous five-step flow.

No server API, schema, migrations, dependencies, grants, financial rules or
operational records changed. Phone OTP binding, expiry, stale-response invalidation,
native B2B approval and masked-contact preservation remain in force. This is the
existing auth-walled desktop workflow/design system, not a performance or platform
redesign. Push and develop merge authorized; no production rollout requested.

Verification:268 Organizations/English assertions passed, one unrelated optional
test skipped. The final27 focused save/edit tests additionally prove deferred
fields, no hidden contract write with create-only permissions, preservation of an
existing agency, and unchanged Corporate registration. Scoped ESLint, Web
typecheck and the66-route production build pass. Exact-head hosted gates and
verified merge are required before releasing source reservations.
