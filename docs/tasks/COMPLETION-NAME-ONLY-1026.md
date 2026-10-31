# Name-only passenger completion

PC-A;2026-10-26. Owner explicitly requests only first/last names to be mandatory in correction Add passenger, followed by push and develop merge. This supersedes the full passport/birth requirement in CONTRACT-PASSENGER-COMPLETION-1026 for this historical completion path only.

The Customer entry sheet keeps all optional fields available and removes their mandatory labels. Nonempty optional values retain ordinary format checks. Blank passport numbers do not count as duplicate passports. Existing profiles without passport names display their registered first/last names. Existing identities are reviewed rather than overwritten.

Sales exposes a contract-scoped profile creation endpoint. It authorizes the historical contract before calling Customer's bounded completion creation policy; ordinary Customer creation and new-contract Sales passenger creation retain their previous birth-date requirements. Customer still owns profiles, encrypted identifiers, contacts and duplicate matching. No direct Customer table access or new grant is introduced.

Completion commands may carry the booked ADT/CHD/INF category when birth is unknown. A known birth date remains authoritative and cannot be contradicted by the declared category. Exact booked per-service counts, real customer membership, service/date validity, branch/ownership, version, replay, transaction/audit and Reservations notifications are preserved. No commercial price or inventory reservation is changed.

The additive migration drops only NOT NULL from SalesContractPassenger.birthDate. Unknown birth dates are stored as SQL NULL, never a generated date; existing values/FKs are preserved. Existing string-shaped Sales read contracts encode an unknown birth as an empty string. Null-safe correction/table/list projections retain booked categories, do not manufacture child age bands, and render missing identity information as absent. New-contract validation remains strict.

Apply migration20261026170000 before deploying the API; ordinary Web clients with known dates remain compatible. No operational migration, server deployment, current local runtime/account mutation or real passenger data is part of this publication.

Validation: all repository migrations applied successfully to a fresh temporary local PostgreSQL database; actual nullable schema accepts both unknown/known birth values and retains foreign keys. The temporary database was removed after the check. Focused completion, Customer-policy, correction, Reservations/list and Web regressions cover name-only adults/children/infants, missing names, supplied invalid data, known-date category mismatch and authorization. Final scoped lint, API/Web builds/types, translation coverage and exact-head hosted checks gate the authorized merge.
