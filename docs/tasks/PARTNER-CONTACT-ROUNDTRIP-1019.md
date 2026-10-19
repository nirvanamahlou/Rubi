# PARTNER-CONTACT-ROUNDTRIP-1019

PC-B; user authorizes supplier/broker contact and address repair, tests, push and develop merge. No production rollout or migration is authorized by this unit.

## Findings

- Supplier address form read the native legacy address rather than the canonical dossier address. Imported/canonical values could appear blank and be overwritten by a later edit.
- A dossier edit always replayed the native office phone, even when that field was untouched. An older native snapshot could replace or clear a newer canonical contact.
- Broker edit inputs deliberately start empty for protected contacts, but placeholders alone were mistaken for unsaved data. Broker profile also omitted mobile, email and address.
- Clearing an existing email produced a fully empty organization contact, violating the database's required-value check.

## Repair

Read canonical address consistently in supplier projection/form; preserve existing canonical address on unrelated writes. Synchronize office phone only for explicit phone mutations (creation still initializes it). Return active canonical office masks in partner projection. Keep untouched mobile/email drafts omitted. Show saved contact masks explicitly beside edit inputs, including a deliberate clear action, and show broker mobile/email/address in the profile. Cleared emails become inactive while retaining encrypted history, just like phones; projections exclude inactive entries. No plaintext returned, auto-unmask, account grants or schema changes.

## Validation

Initial focused run:38 API and30 Web tests pass. New disposable PostgreSQL scenarios cover both suppliers and brokers: save, reread, canonical contact/address update, unrelated rename, explicit replacement and mobile/email clear. Exact-head hosted tests, quality, builds and PostgreSQL gates must pass before merge. Browser check of the pre-existing synthetic QA broker hit a stale-version guard; it was not counted as a successful new save. Previous deployed shared-number failure is not claimed fixed on the server by a Git merge alone.
