# Shared hotel supplier form

COMPUTER_ID=PC-A. Owner authorizes develop merge after verification; operational deployment is not part of this task.

Reservations remains producer of supplier quotations. An additive optional `VoucherSettingsV1.sharedHotelBroker` on the primary stay opts into one supplier output for all hotel stays. Omitted/false retains independent forms. Web consumes the existing workflow commands and scoped per-hotel settings; no database, API endpoint, migration or dependency changes.

The editor stacks each hotel and its independent quotation. Additional hotel supplier inputs follow the primary registered supplier. Save each quotation, then issue from the primary hotel. Issuance validates that every stay has saved settings for the same supplier before transitioning any stay; all sent settings and versions are frozen in one workflow revision. A failed or stale command writes nothing. Purchase ownership, sale amounts, currency conversion and vouchers remain unchanged.

The common preview/PDF contains one header and per-hotel accommodation/date/room and quotation tables. Separate transfer documents remain separate. Sent output selects each stay's sent quotation even when transfer scoping clones settings. Manual preview edits never post a purchase. Source snapshot is a derived Web-only read model retaining hotel facts across scoped rendering.

Validation includes workflow atomicity/independence, common preview/PDF, independent-mode compatibility and immutable sent quotations. Synthetic Chrome PDFs cover short and long passenger lists; repeated footer and page numbering are visually checked. Final exact-head hosted quality/tests/type/build/PostgreSQL checks gate merge.
