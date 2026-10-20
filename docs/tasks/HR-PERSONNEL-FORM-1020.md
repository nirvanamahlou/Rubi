# HR-PERSONNEL-FORM-1020

COMPUTER_ID=PC-B. User authorizes implementation, push and develop merge.

## Observed evidence

Authorized read-only Radan browser visit on2026-10-20: basic/personnel → افزودن shows three steps اطلاعات فردی، اطلاعات کاربری، تایید و ثبت. Personal fields in order: required first/family name and national code, group, identity number, father, birth date, male/female radio, single/married radio, issuing province/city, education, nationality default Iranian, military status, address, typed contact dialog and photo. Blank Next validates only the first three required fields; no Radan data was entered/saved. Subsequent steps remain blocked by required identity fields, so unseen account fields/password provisioning are not claimed as cloned.

## Implementation and compatibility

Sensitive-authorized employee creation uses the existing Nora dialog/styles with personal information first, then existing canonical Nora organization/account inputs, then review/save. Existing editing and users without sensitive permission preserve the existing form and grants. Canonical group/user/branch/unit/position lookups stay connected. Province selection clears the city; city suggestions use only previously authorized HR identity records for that province and retain manual entry; no unobserved official dependent-city dataset is invented. Existing schema codes for male/female and marital status stay unchanged; observed labels render in the form.

Creation accepts optional identityValues and contactValues under the existing identity/phone schemas. Employee, group, assignment, encrypted profile and encrypted contacts are one transaction. Missing/invalid identity, duplicate/invalid/over-limit contacts, missing sensitive permission or mismatched names roll back all employee writes. Actor-bound HMAC protects private idempotency inputs; public employee DTOs, search and audit contain no raw identity/contact data. Existing clients can omit both new fields. Edit rejects create-only payloads; profile edits keep the established versioned flow. No schema/migration/dependency/IAM changes.

Optional photo uploads through the existing Documents contract before employee creation; its document reference is attached by the existing employee command. Uploaded reference is reused on retries with the same file/branch. Documents permission, archive/type/expiry rules continue to apply. The existing Nora photo archive-validity control appears only after a photo is selected, because the established HR document type requires a real expiry date; no date or validity policy is fabricated. An upload is a separate Documents transaction; cancelling or a later failed HR command can leave an authorized archived document, as with the existing HR archive workflow. No cross-module table access or distributed atomicity is claimed.

## Validation

Focused authenticated PostgreSQL test exercises creation/read/replay, masked persistence/audit, invalid input rollback, permission denial, create-only update rejection and idempotency body mismatch.17 focused Web checks pass. First local fixture setup timed out under memory pressure; isolated retry passed. All34 real isolated HR PostgreSQL tests pass after fixing cleanup of the new synthetic encrypted profile before restoring its temporary encryption key. Scoped lint/format/i18n and exact-head hosted quality/types/tests/database/build are delivery gates. Operational records are not used for testing.
