# SITE-API-FORMS-1104 — PC-D

Add real editable connection setup for the three non-Ghestiroo catalogue sites
inside the existing default-closed API disclosure. Keep the common selected-site
layout and independent presence/services. Accept only the implemented signed
ERP v1 contract: HTTPS website origin, client/system/organization/environment,
key identifier and write-only signing secret. Save and test are distinct:
stored configuration is not proof that an upstream service is available.

New settings are branch/site-scoped, encrypted and version-checked in the existing
persistent secret volume (purpose-separated key/subdirectory); support dedicated
site storage variables without requiring them on the currently configured server.
No plaintext secret in registry, DB, response, audit or logs. Blank secret retains
the current secret only for an existing unchanged destination/identity. Changing
destination or signing identity requires a new explicitly supplied secret.

Nora Integrations is both producer and consumer of the additive site configuration
contract. Existing native Niyayesh APIs gain optional systemId; an explicit ID must
never fall back to another website/branch. Legacy private file configuration stays
compatible. Preserve IAM checks and fixed upstream paths/pinned public HTTPS;
current-user subject remains the responsible remote actor. SSO remains policy-
bound to its original producer and cannot launch another selected site's account.

No schema/migration/dependency, external producer code, IAM grant or operational
business writes. Verify encryption/CAS/tamper, authorization and site isolation,
secret replacement/redaction, native routing and form behavior; scoped lint/types,
affected production builds and all final CI checks gate authorized develop merge.

Configuration reference: the upstream must implement the existing signed ERP v1
capabilities/resources/catalogue/workbooks/report/presence contract. The form does
not claim compatibility with arbitrary REST bearer-token APIs. Origin is a public
HTTPS hostname without a path/query/credentials; requests resolve and pin only a
validated public IPv4 address, validate TLS against the hostname and never follow
redirects. Client/system/organization/environment/keyId must match the upstream
signing configuration exactly. Signing secret is write-only,32–4096 printable
ASCII bytes; the current Nora identity is the remote actor. Existing native IAM
and producer resource grants still apply.

Storage: optional NORA_SITE_CONNECTIONS_CONFIG_DIR and
NORA_SITE_CONNECTIONS_STORAGE_KEY (32-byte base64 key). When absent, use the
existing persistent NORA_GHESTIROO_CONFIG_DIR/sites directory and derive a distinct
encryption subkey from the existing storage master with HKDF-SHA256. No Ghestiroo
file/key replacement. AES-256-GCM AAD binds purpose, branch and site. Atomic
no-overwrite version publication plus CAS prevents concurrent overwrites. The
directory/files are created with0700/0600; all configuration versions are encrypted.
The secret is never returned; blank secret retains it only for unchanged identity.

Optional systemId now routes all native operations (including lookup pagination,
form save, workbook preview/apply/export and SSO availability) without cross-site
fallback. Existing callers without systemId preserve their private primary-file
behavior. Primary SSO is offered for a selected site only when the server policy's
primary connection and selected connection still identify the same producer.

Validation:37 API checks (including15 new security/routing cases and existing
Ghestiroo/Niyayesh/SSO regressions),70 Web and3 English checks pass. Scoped lint,
format and translation synchronization pass. Initial local API typecheck hit its
default2GiB heap; full isolated3GiB server typecheck passed. Web exact-optional
props and test request fixture were corrected. All8 hosted quality/full-test/
production-build/PostgreSQL checks passed on aaff2d389; no gate was bypassed.

Full server API/Web typechecks/builds passed in bounded containers under the common
deployment lock. API/Web-only activation preserves1202 API and2004 Web/Contracts
source files outside owned scope, all other containers, environment and mounts.
19 runtime source file copies and49 locale entries match the final source; secure
storage is configured/writable and API/Web healthy. Temporary1GiB build memory
was safely removed. Activation waited for all8 hosted checks; no runtime credential,
IAM policy, schema or business record was changed during acceptance.

Live owner-session acceptance: all3 selected sites show editable origin/client/
system/organization/environment/key-ID and masked secret fields. Changing a field
enables save; the test button stays unavailable before saved configuration. API
collapse/reopen preserves draft, switching site discards it without cross-site
leakage. All synthetic drafts were cleared; no save/test with fabricated production
credentials. GH bundle/native hotel editor remains available. Desktop1451x797
and default narrow viewport have no horizontal overflow or browser errors; viewport
reset and original user tab left on the ready Jahan Bastan API form. Screenshot:
site-api-forms-1104.png in the current chat's visualization directory.

The real three upstream services are not claimed connected: operators must enter
their actual ERP v1 credentials and obtain a successful signed capabilities test.
Final documentation head must pass all8 checks before authorized PR1362 develop
merge. Runtime source remains byte-equivalent; reservation releases on verified
merge. No main release is included.
