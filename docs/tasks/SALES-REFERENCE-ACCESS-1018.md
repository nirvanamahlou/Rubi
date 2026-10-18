# Sales reference access — PC-B

The owner requests that new-contract dropdowns remain usable when Master Data administration is denied, followed by push and develop merge. Existing screen/operation grants are not modified.

## Compatible producer/consumer contract

- Master Data owns `MasterSalesDirectory`, projecting active countries, cities, hotels, room types, visa services, banks, currencies, airlines, insurance plans, acquaintance methods and organization names. Only explicit safe relationship/display attributes survive; contacts, financial accounts and arbitrary resources do not.
- Sales exposes authenticated GET `/sales/form-references/:resource` and `/:resource/:id`. New-contract route plus native create permission, or Sales route plus scoped update permission, authorizes the contract picker. A branch is required. Payment-only users can access banks/currencies only. Read-only or Master Data-only authority does not authorize this API.
- Query input permits bounded search/pagination and active/name/ascending compatibility only. The producer always forces active records and name sorting. Detail rejects inactive rows. No write/export/unmask operation exists on this surface.
- Web keeps the existing complete-page loading, focus refresh and cancellation behavior, but sends contract picker requests through the existing authenticated Sales transport. Insurance, tour insurance, organization and acquaintance pickers use the same safe boundary. Customer, tour and payment business commands keep their own native authorization.
- The generic Master Data API, existing user roles/grants, stored contracts and historical output remain unchanged. No schema, migration, dependency, database or deployment operation is included.

## Verification

Focused HTTP tests use actual AuthGuard and PermissionGuard with synthetic authentication and a stubbed owner source. They verify forbidden generic APIs, manual create-only access, denied screens, missing branches, allowlisted active projections, unsupported resources/query tricks and legacy/edit/payment permission cases. Web regression verifies every new-contract reference loader sends authenticated uncached requests to Sales rather than Master Data administration. Full final-head CI is required before the requested merge.
