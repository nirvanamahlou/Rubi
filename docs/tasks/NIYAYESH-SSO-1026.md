# NIYAYESH-SSO-1026 — contract and execution

Nora IAM remains the sole authority for staff identities and ERP access. A standards
provider (oidc-provider9) delegates authentication to the current Nora cookie session.
It does not accept passwords or create a second user directory. Only one registered
first-party Niyayesh client, exact callbacks, code response, RS256 and S256 PKCE.

IAM public active-session-v1 validates user/session status and expiry. The private
SSO introspection port returns only current mapped site permissions, subject, branch,
system and organization; authenticated with a separate server-only credential.
Permission requires integrations.home + connections + integrations.niyayesh.login,
explicit user/branch binding and sso.enabled. No implicit grants for other users.

The optional managedAccess branch/resource policy enables a new Nora staff member
without a manually precreated site account. It still requires the current Nora
login checkbox; creating the site account also requires the separate provision
checkbox. The local default only includes ten catalogue resources, no customer,
traveler, order, cart, support or travel-request data. Existing explicit personal
bindings retain their approved allowlists. Native site modules are derived from
the final resource grants; neither checkbox grants owner/user administration.

The provider stores only encrypted protocol state/session references in namespaced
Redis, with expiry and atomic code consumption. No passwords, refresh/access cookies
or business records are stored there. The site validates claims, scope and current
userinfo, creates a deterministic managed account only when trusted JIT is enabled,
and stores its upstream token encrypted in a separate expiring linked-session row.
Every SSO-protected site request rechecks current authorization; network failure
fails closed. Revocation does not depend on browser logout or asynchronous delivery.
Owner/native accounts are never adopted by JIT. Existing password login is retained
for native accounts; new managed accounts cannot use password login.

Local HTTP is an explicit development-only exception restricted to fixed loopback
origins (or explicitly bound local Docker aliases). Production requires HTTPS and
verified public destinations. No certificate validation bypass or new trusted CA.

## Runtime and validation

Three local components: Nora Web/API3100/4192, identity gateway19130, and Niyayesh
Web/API13025/18025. Browser origins are nora.localhost and niyayesh.localhost, so
Nora host-only cookies never travel to the site backend. Gateway protocol state
uses the existing Redis through an encrypted namespaced adapter. Site migration
erp1026b is additive and was rehearsed against a disposable clone before local
application; the pre-migration database dump is outside Git. No Nora migration.

The site revalidates UserInfo on every managed request with no authorization cache.
Normal Nora refresh rotation follows the active session family through the bounded
IAM public method; logout/revocation or an inactive user fails closed. Ordinary
access-token validation retains ACTIVE-only session semantics.

Evidence: six real OIDC/Redis tests (including PKCE/replay/concurrent code
redemption), six IAM/authority tests and32 site OIDC/integration/JIT tests pass.
The six managed-identity tests also pass against the disposable PostgreSQL clone,
including three concurrent first logins creating exactly one personal account.
Both frontends and Nora API production builds completed.
The full118-test Niyayesh suite, Nora API/Web typechecks, scoped lint, English
catalogue synchronization and formatting pass. A fresh-database migration rehearsal
also verifies existing records, managed=false defaults, empty linkage and rollback.

After owner-approved Docker recovery all12 preexisting/new local containers are
running, application services healthy. Real HTTP acceptance passed: missing JIT
grant denied, enabling the checkbox permitted personal provisioning, read-only
catalogue worked, customer access and writes denied, Nora refresh rotation preserved
site access, current Nora logout immediately revoked it, and the existing explicit
ehsan binding worked. The temporary Nora test identity was deactivated via public
IAM API with history retained. Real browser click from Nora opened the Niyayesh
admin dashboard as ehsan (non-owner) without a second password. Screenshot and
private runtime startup script are outside Git. No production site is connected.

Phase4 remains separate: per-resource write policy, owner-module business commands,
two-way outbox/inbox sync, conflict rules and delivery monitoring. This phase does
not claim complete business editing/synchronization or production SSO readiness.
