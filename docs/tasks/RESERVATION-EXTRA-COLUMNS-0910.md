# RESERVATION-EXTRA-COLUMNS-0910

PC-A; branch codex/pc-a-reservation-extra-columns-0910; base a8160d7.

Adds services, seller, contract party, hotel meal service and hotel notes after the existing correction date, preserving the existing hotel action/confirmation/correction columns. Table and filtered XLSX share the same projection. The workbook filter now derives its last column from the header instead of stopping at O. Compact rows and horizontal scrolling are preserved; clipped text has a full-value tooltip.

Sources: service titles come from the intake snapshot; seller name resolves the intake sales owner through the public IAM service only when iam.users.read is present. Contract party is the current profile for snapshot.customerId, read through CustomerService under customers.read and its branch scope (not a passenger substitution). Customer lookups are deduplicated per page; only display names are projected. The hotel's meal-service ID resolves through the existing master-data API/name cache. Hotel notes use the latest persisted hotel arrangement reason; no new note storage or fabricated notes. Missing/unavailable fields display an em dash. Search also covers meal service, notes and service titles.

No migration, dependency, permissions, financial approvals or commercial data changed. Customers/IAM/Master Data producers unchanged. Local-only publication hold retained.

Validation:13 API and41 Web tests passed, including permission-sensitive labels and A:T XLSX filtering; scoped lint/typechecks and production API/Web builds passed. API4000 updated and health200 verified. Web needs restart of the user-started process; no new attempt to bypass the known execution-policy block.
