# AGENCY-IMPORT-BLANKS-1012

- Owner: PC-B. Base: origin/develop@08a7c20c.
- Branch: codex/pc-b-agency-import-blanks-1012, isolated checkout.
- Request: allow agency spreadsheet uploads with empty optional fields.
- Root causes: mandatory optional column headers and external telephone/web hyperlink metadata; empty styled rows were counted as records.
- Required legal name remains required. Empty optional values are accepted, no fake email/license/contact is created. Invalid nonempty values remain errors, rather than being silently discarded. No operational import was executed.
- Hyperlinks are metadata only: the reader never follows or renders them. Only strict mailto/tel and credential-free HTTP(S) hyperlink relationships are allowed. External workbook/data relationships, formulas, macros, unsafe protocols, integrity/size violations remain rejected.
- Partial geographical input remains editable address text instead of a fabricated city/country reference.
- Verification: 31 focused unit tests plus the private-file container test pass; complete Organizations suite240 passes with the private-file test skipped by default. The opt-in test uses AGENCY_WORKBOOK_PATH without committing customer data. Scoped ESLint, TypeScript and final Webpack production build of59 routes pass. Turbopack cannot traverse this temporary worktree's external dependency junctions; no project config was changed to bypass that environment limitation.
- The supplied file also contains website addresses in its email column. These remain validation errors pending the user's choice; accepting blanks does not make a nonempty website a valid email.
- No schema/migration, dependency version, shared API contract or user permissions change. No automatic merge/deploy. The main checkout contains concurrent work and its Git index is locked; do not overwrite it.
