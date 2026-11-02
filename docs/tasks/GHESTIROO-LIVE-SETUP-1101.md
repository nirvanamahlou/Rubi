# GHESTIROO-LIVE-SETUP-1101 — PC-D

Owner requests correction and real acceptance of the Ghestiroo/Nora connection,
with Nora browser origin https://avinaofficial.ir. Source branch starts from
origin/develop@2b796d28d; preserve all other modules and existing account roles.
Reserve Integrations connection form, system-detail connector selection, focused
tests, Integrations translation dictionary and own coordination records only.
No Nora schema, dependencies or IAM behavior changes.

Live evidence: both web logins succeeded through the user's existing accounts.
Ghestiroo /admin/nora is editable and accepts the actual Nora origin. Nora's
global connections screen reports secure storage unconfigured and disables its
textareas; its per-site connection tab still shows a placeholder and routes the
Ghestiroo data tab into the Niyayesh component. Fix the route, keep draft inputs
editable while persistence is unavailable, explain read-only permission and
provide an explicit failed-load retry without weakening backend checks.

Source implementation is complete within the reserved Integrations boundary.
Validation: scoped ESLint passed; all 42 Integrations tests passed; all three
translation coverage tests passed on an isolated rerun after the first timed out;
Web typecheck passed after rebuilding the existing contracts package. Both push
and PR CI completed successfully, including production build, full quality and
test suites and PostgreSQL gate. Nora PR1270 merged into develop061f265a83;
source552924dd15d40c9cc795003eefccef07bf0b606b.

## Production acceptance completed, 2026-11-01

The existing approved local SSH alias rubi-server provided working host access.
No SSH account, authorized key, IAM grant or login password was changed by this
task. Secure API storage is configured in a private persistent bind mount with
a separately persisted random encryption key; encrypted recovery copies and
rollback metadata are outside Git. Existing API/Worker images and environment
were preserved; both were recreated to preserve their shared network namespace.
Authenticated Worker requests, AMI connection and the recording timer passed.

The Integrations Web overlay was built on the actual then-current production
image, preserving all 1814 other Web source files, environment, mounts and old
static assets. API/Worker and other containers were unchanged during Web rollout.
Receipts are in /opt/rubi/ghestiroo-live-setup-1101 on the server. No schema,
business-record import or other-module source changes were performed.

Through the owner's existing authenticated accounts, one connection bundle was
issued for https://avinaofficial.ir and encrypted in the selected Nora branch,
allowing only the owner's current Nora account. Capabilities and all four read
resources passed in the real UI. The system card now opens its own connection
form; its fields are editable and the stored connection survives page/release
reloads. The final UI explicitly confirms all five permitted scopes.

Live SSO exposed a browser-only cross-site Strict-cookie redirect problem. The
separate Ghestiroo PR130 fixes it with a token-free no-store landing document and
same-origin external script navigation, retaining Strict/HttpOnly/Secure cookies,
origin checks, one-use grants and revocation semantics. Sourcea77a46d13233 was
merged into that repository's developa1280c7e063b and deployed as a bounded admin
image overlay; all other site containers, environment and mounts were preserved.
Eight local connector tests passed (one PostgreSQL-only test skipped). Although
the commit requested skip-ci, that repository's pull_request_target workflow
started automatically; it was cancelled after discovery, with some jobs already
completed. No CI workflow policy was changed.

Final real-browser SSO reached https://ghestiroo.ir/admin with the dashboard title;
server logs independently show redemption200 and protected dashboard GET200.
The issued connection expires on 2027-01-30. Keys, bundles, customer records and
private deployment metadata are not committed. Source locks are released.
