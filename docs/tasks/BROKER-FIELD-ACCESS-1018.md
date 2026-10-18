# BROKER-FIELD-ACCESS-1018

PC-B. Reproduced in a focused service test: manual-access actor with permission
to create brokers and edit name is rejected when the valid internal dossierVersion
marker is present. The marker and dossierImport are protocol metadata validated
by preparePartnerDossier, not editable user fields. Exclude only these markers
for suppliers/brokers from the generic field-control projection. Supplier
dossierAddress aliases the existing address control; raw address authority cannot
be bypassed using the nested dossier payload. Other resources are unchanged.

Add missing optional email/mobile controls for both partner resources and broker
address to the editable-field catalogue, so administrators can actually configure
them. This does not grant any actor new permissions. Real denied contacts, name,
organization links and leader payloads still fail before persistence. The broker
create payload omits optional blank inputs and an empty leader list; edit clears
remain explicit and permission-checked. Nonempty denied inputs remain denied.

64 API,10 Web and3 Contracts regressions pass, including the reproduced metadata failure,
actual field denials, alias protection and create-vs-edit payload behavior.
Scoped lint/format and Contracts build pass. Regenerated stale local Prisma and
Database artifacts without a database connection; full API and Web typechecks
then pass. API production build also passes; hosted exact-head
quality/tests/build/PostgreSQL checks gate any later authorized merge. No actual
account or role modified; no migration, live data, runtime or merge applied
by this report alone. Publish only this task branch/PR under repository workflow.
The previous browser policy limitation remains; no live
authenticated successful creation is claimed.
