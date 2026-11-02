# GHESTIROO-WORKSPACE-1102 — PC-D

Owner requests disconnect/delete, Nora-owned per-user identity with full site
access by default for IAM-authorized connector users, native catalogue/Excel
management inside Integrations, and a site selector/live presence map. Reserve
ghestiroo connector/controller/client/UI and tests, shared Integrations presence
reader/site selection, bounded translations and own notes. No Nora schema,
dependency, IAM implementation or other-module source changes. Existing Nora
branch/section permissions remain authoritative; settings changes remain admin.

Site producer owns additive Nora identity/grant and anonymous90s presence tables;
its importer/catalogue services remain authoritative. Native templates, schema,
validation, preview/apply and concurrency are reused rather than duplicated.
Deletion revokes sessions/grants first, retains audit and never deletes business
records. Each SSO uses an individually bound Nora subject/branch staff identity;
service credentials are not the human actor. Public presence counts browsers,
not verified people, and never fabricates activity or imports customer records.

Implementation complete: trusted IAM actor/name headers, full default site role
for connector-authorized users, native schema editor and catalogue pagination,
workbook templates/export/preview/room review/confirmed apply with bounded files,
actor-bound idempotent commands and version guards, anonymous presence provider
and registry site dropdown. Settings remain manager-only. No Nora schema or IAM
implementation changes. Site has one additive migration; producer deploys first.

Validation: targeted API/Web integration regressions, scoped lint/typechecks,
and real PostgreSQL producer tests. Hosted exact-head quality, test, build and
database gates are required before the separately authorized develop merge.
Production overlays must preserve current source outside these Integrations
files, all mounts/env, Worker image and existing Call Center/HR behavior.

Producer published independently as Ghestiroo PR132, develop merge69e14955;
automatic CI run41409041941 cancelled with no test/check/build step started.
Producer migration20261102_nora_workspace rehearsed on PostgreSQL and applied
after an encrypted host-only backup. Live schemas and native workbook templates
for all seven kinds, personal identity and actual browser presence verified
without catalogue writes. Nora runtime source inventory preserves1020 API and
1815 Web source files outside this scope; environment/mounts and Worker retained.
The full hosted suite caught one missing whole-paragraph English translation;
4306 Web tests passed, and the translation coverage correction is included.

Final live concurrency verification exposed a producer event-loop stall when
multiple workbook/presence requests contended for the connection row lock.
Producer body/form parsing stays asynchronous; blocking ORM/native workbook work
runs in request worker threads. A real single-Uvicorn-loop regression exercises
parallel template/schema/list/presence/heartbeat requests.23 producer tests pass.
Nora's consumer contract/source is unchanged by this producer correction.
