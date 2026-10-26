# Agency registration contact roundtrip — 2026-10-26

COMPUTER_ID=PC-B. Owner authorizes ordinary staff contact persistence for agencies without SMS verification or verified-number claims, mobile and landline fields in registration/dossier, removal of the agency executive job-title input, tests, push and develop merge. No operational deployment is included.

## Cause and change

The registration writer created the organization before invoking the development-only verified-contact endpoint. In production that endpoint rejects the call, leaving an organization without the remaining contact/address writes. This is source evidence consistent with the reported server symptom, not a claimed live reproduction.

Agency registration now has identity, contact and final-review steps. Its phone uses the existing authorized Master Data contact writer. Corporate-customer OTP and its development restriction remain unchanged. No verification grant or verified status is fabricated. Existing resource/field authorization, encryption, masking, disclosure audit, version checks and partial-save recovery remain active.

The mobile field is labelled «تلفن همراه», with «تلفن ثابت» beneath it. Office contacts reuse the Excel-native organization-contacts representation (office name, landline job-title discriminator, PHONE channel and non-primary marker when separate). Legacy Excel contacts containing only a landline hydrate into the landline input. Separate office contacts update in place. Primary contact selection no longer depends on alphabetical ordering. Undisclosed sensitive fields and hidden historical executive job titles are not overwritten.

The existing native address/identity APIs continue to persist country, city, address, email and licence data. New contacts are ordinary contact records, not portal-user identities or verified phones. No schema, migration, dependency or permission grant is needed.

## Validation and publication

Regression coverage includes complete agency contact/address writes without OTP, native Excel office-contact edits, legacy landline hydration, office-only entry without an invented representative, malformed-phone rejection, disclosure-denied preservation, partial-save recovery and unchanged Corporate OTP. The native minimum contact requirement and canonical mobile/office duplicate constraint are checked before writing the organization. Organizations/English276 tests passed with one existing optional skip; final focused contact/English48 and native API29 tests passed. Scoped lint, full Web typecheck and production build passed. Exact-head hosted checks gate publication. The PR records final checks and merge identity. Source locks release on verified merge. No server/runtime or production data changes.
