# Independent subsidiary detail levels

Each subsidiary account opens with editable level rows 4 through 8. The existing save action persists the account's selected types and level settings. Adding a row extends that account one level at a time and stops at level 12. Empty lower levels are valid and each level uses the ledger's native detail type catalogue.

Journal lines, templates and subsidiary mappings use optional foreign keys for levels 7 through 12. The migration adds those references, widens the mapping key and removes the old mapping-prefix constraint. Existing account and journal records need no backfill. Posted history retains the original links. The journal form, reports and generated accounting documents use the same dimension identifiers.

Release order is database migration, Accounting API and Web. Production data and services have not been changed during implementation.

All 262 migrations applied to a fresh PostgreSQL fixture. The Accounting API suite passed 212 tests and the Web finance and localization suites passed 306 tests with one skip. Scoped lint and both production builds passed.
