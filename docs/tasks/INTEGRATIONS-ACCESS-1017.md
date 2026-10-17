# INTEGRATIONS-ACCESS-1017

COMPUTER_ID=PC-D. User delegates the bounded repair of missing site-management
access options in native user administration. IAM ownership stays PC-A.
Branch `codex/pc-d-integrations-access-1017` starts from PC-D-Integration and
includes PR909 as an explicit prerequisite. The user now authorizes push and
merge after all hosted checks pass and a review is approved. Since PR909 already
contains the website implementation this access fix serves, publish the fix as
a fast-forward update to PR909 rather than opening a duplicate full-feature PR.

Integrations already requires the existing native `system.settings.manage`
operation, its route, module control and registry field control, plus an assigned
branch. The last two control IDs were enforced but absent from the shared access
catalogue. Manual v3 profiles therefore could not select/persist them through
native IAM administration. Register those controls in the Integrations section
with readable site-management labels. The module screen uses the actual
Integrations route inheritance, while existing system-owned module screens keep
their old inheritance. Native operation, branch enforcement, audit and explicit
manual grants remain required. Existing manual profiles gain nothing silently.

User clarification requires the operation to be visible in the Integrations
section itself. Both new-user and existing-user editors also present the existing
`system.settings.manage` operation there with a searchable website-management
label. It stays visible in System administration and both views edit the same
permission ID/code. No extra native permission, role default or automatic grant
is created. The final UI image layers this presentation onto the first access
image, recreating only Web; the already updated API remains running.

Local diagnosis: the supplied screenshot displays Demo. The existing Docker IAM
directory lists ehsan and the existing fixture administrator, with no Demo user.
Authenticated ehsan already sees Add website and four configured systems in the
assigned branch. No role, grant, branch membership or registry data is changed
to reconcile an unidentified screenshot identity. The screenshot's browser URL
and login are requested from the user.

Local runtime candidate is a bounded overlay on the already running
`rubi-integrations-local:1017-site-onboarding-v2`. The two shared contract sources
match the runtime baseline except for this change. The runtime user-management
source has other differences from the task checkout, so only the two exact label
conditions are inserted into the saved runtime copy. All other runtime source
is retained. Source receipts and rollback launcher remain outside Git under
`C:/Users/Ehsan/Documents/ChatGPT/Rubi-runtime-local/integrations-access-1017`.
No migration, seed, dependency, credential, other-project stop or Docker Engine
restart is needed. Only Rubi API/Web are eligible for local recreation.

## Verification

- 150 contract tests, 53 Integrations/IAM tests and 28 Web access tests pass.
  Tests cover native operation prerequisites, every missing/revoked module/field
  grant, unchanged manual profiles, branch denial, registered selectable IDs,
  shared operation identity and retained System administration presentation.
- Scoped lint and source formatting pass. Contracts build/typecheck and the
  final Web production build pass, including its TypeScript gate and 62 routes.
- The local shared-contract image builds successfully. API runs
  `rubi-integrations-local:1017-access` and Web runs
  `rubi-integrations-local:1017-access-v2`, both healthy. The persistent launcher
  uses the v2 image, whose API contracts are identical to the running API image.
- Native user administration shows all four checked controls for ehsan: route,
  connection-settings module, site-management operation and registry field.
  No Save or grant-changing command is submitted. Fresh login, four existing
  systems and the Add website dialog are verified; dialog cancelled without
  creating a site. Screenshots are saved outside Git with the runtime receipt.
- No destructive operation, seed, migration, role or user access mutation.
  Existing registry version 2 remains unchanged; no external request or provider
  connection claim is introduced.

## Updated delivery direction

The user explicitly requests integration with latest develop, CI and merge after
all checks pass. PR909 now targets develop. The integration merge preserves
all current develop sources, shared translation keys and both task histories.
No local Docker or operational database change is part of this delivery.
