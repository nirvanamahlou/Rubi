# SHARED-RESERVATION-INBOX-1109

PC-A; branch codex/pc-a-shared-reservation-inbox-1109 from develop 0fb77974b.
Owner requests one Reservations inbox independent of selected issuer company and
authorizes develop merge after checks. Reserve Reservations public list, Sales
public visibility projection and focused tests. No schema/dependency/deployment.

Sales produces the IDs of non-hidden contracts within the caller's authorized
branches; Reservations consumes these IDs before search, distinct and paging.
This bounded operational projection does not use active issuer selection or
grant aggregate Sales/Finance access. Sales lists and Finance remain company
scoped. Saved contract owner continues to determine document branding.
