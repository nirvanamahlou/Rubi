# Insurance draft identity conflicts — 2026-11-09

PC-C; owner explicitly authorizes coordinated independent repair, preserving PC-A source, and green develop merge. No insurance provider issuance is used for testing.

Production reported two PUT /reservations/insurance/draft HTTP500 failures. Read-only native database verification of the owner-selected contract and entered identity returned one policy and one national identity match owned by a different customer. No identifiers/values were committed and no business rows were changed. Customers has unique national-ID and passport fingerprints. Unlike the ordinary Customers mutation path, insurance saveCorrection allowed P2002 from its customer.updateMany to escape as a generic500.

The bounded repair translates that existing identity uniqueness violation into the same409 codes/messages used by Customers. It does not merge customers, reassign passengers, overwrite another identity, weaken uniqueness, change provider retry or send another insurance request. The surrounding transaction still rolls back. Other errors propagate. Tests cover both fingerprint conflicts, no further contact writes after conflict, sanitized messages and unexpected error propagation.

A duplicate existing identity cannot be made a successful correction safely: the operator must use the correct passenger/customer link through the owning workflow or enter that passenger's real identity. No automatic identity merge is introduced. Separate catalogue BAD_GATEWAY failures remain separate from this proven draft identity conflict.
