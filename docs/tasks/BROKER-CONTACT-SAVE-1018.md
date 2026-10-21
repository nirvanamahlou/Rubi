# BROKER-CONTACT-SAVE-1018

PC-B; user authorizes repair, tests, push and develop merge. No runtime deployment is included.

## Cause and repair

Equal normalized office and mobile numbers previously created two organization contacts with the same unique phone fingerprint. The partner transaction now groups these two reserved roles into one encrypted contact. Distinct numbers remain separate. Editing, merging and clearing a role preserves the other role; redundant owned contacts are deactivated without deleting encrypted history. Each desired fingerprint already in use retains its owning row, including role swaps; new values cannot collide with those assignments. Unrelated contacts, uniqueness constraints, permissions and encrypted storage remain unchanged.

The broker email input uses native email semantics and LTR direction, without rewriting typed case. Existing backend case-insensitive normalization and encrypted storage remain unchanged.

Database verification caught that temporary slot release violates existing crypto and nonempty-value checks. The final algorithm never clears slots or creates empty contacts: existing fingerprints keep their original rows and unused contacts become inactive with their encrypted history intact. Constraints remain enabled throughout; any failed write rolls back the complete operation.

## Verification

44 focused API/Web tests pass, including shared numbers, split/merge/clear, rollback propagation and uppercase email payload. Scoped lint passes. Disposable PostgreSQL regression exercises actual broker creation, uppercase email normalization and repeated role transitions. Hosted exact-head checks must pass before merge; local Docker engine is unavailable. Browser verification is not claimed. No schema, migration, dependency or account grant changes.
