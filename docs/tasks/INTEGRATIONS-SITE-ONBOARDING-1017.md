# INTEGRATIONS-SITE-ONBOARDING-1017

PC-D; task branch from PC-D-Integration. The accepted dashboard remains intact.
New-site registration becomes a direct action, without opening catalogue
administration, entering a Latin code, or initializing unrelated presets first.

The same form creates a new site and completes an existing site's setup: choose
or create a brand, enter identity/site address, then optionally describe the
connection and intended capabilities. Generate immutable UUID-based internal
codes; persist everything through the existing branch-scoped versioned registry.

Producer IntegrationRegistryService and Web consumer ship an additive optional
setup object in integrations.registry.v1. It contains only public HTTPS website,
API/documentation URLs, environment and intended protocol/authentication method.
No credential field, server request, connection test or live-success claim.
Reject URL credentials, queries/fragments, IP/local hosts and unknown fields;
deduplicate normalized website URLs. Actual adapters must separately validate
DNS/IP/redirects at request time. This metadata alone never enables a connection.

Legacy records remain valid. Old clients omitting setup preserve the saved
metadata; an explicit replacement object permits deliberate field clearing.
Keep native IAM, screen/module/field checks, exact assigned branch, advisory/CAS
and audited public SystemManagement writes. Deploy producer before consumer.
Once setup metadata is saved, rollback must retain this producer (older strict
validators do not understand the additive field); rolling back only the Web is
safe. Health-failure rollback before writes may restore the previous image.
No migration, dependency, IAM or other domain changes. Root/public registry
exports and bounded translation registrations are reserved only for this slice.

PC-D-Integration currently predates PR889. Reuse only the already reviewed
Integrations foundation/dashboard source as a prerequisite, excluding unrelated
develop changes. No GitHub publication or merge is authorized in this follow-up.
