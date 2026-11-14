# ACCOUNT-TREE-LEVELS-1114

Owner: PC-D under the owner's existing Accounting delegation. Branch: `codex/pc-d-account-tree-levels-1114`, created from PC-D-Integration and fast-forwarded to published develop `ea83ec5b3`.

## Requested behavior

The four owner-provided Rahkaran screenshots show root **ساختار حساب**, account groups, general accounts, then subsidiary accounts. Right-clicking creates the next level. The subsidiary form has independent detail levels four, five and six; selecting or double-clicking a level exposes the book's detail-type catalogue.

## Changes

- Add a contextual creation menu at the pointer, also reachable with Shift+F10 / the context-menu key. Existing menu primitives handle focus, Escape and arrow-key navigation. Root creates GROUP; GROUP creates GENERAL; GENERAL creates SUBSIDIARY. A subsidiary is a leaf. Inactive parents and users without account-management permission cannot create children.
- Both the toolbar and context action use the same hierarchy rule. A new draft highlights its selected parent and inherits its code prefix and nature. Save-and-new retains the existing explicit same-level behavior. Existing account IDs, codes (including leading zeros) and financial rows are preserved.
- Subsidiary detail levels retain their existing single-click, double-click and keyboard selection. Display all of the book's detail types, including inactive rows marked as such. Each level keeps independent choices. Disable mutation while busy or without account-management permission.
- Permit saving a previously selected inactive type only on that same account and level, including migration from the old single-ID field to an array. New inactive assignments, cross-level copies, foreign-book types and invalid hierarchy remain rejected by the API. Existing journal-use/CAS/book-lock/audit guards remain intact.
- No new API shape, schema, migration, dependency or lockfile changes. Add two bilingual UI labels in the existing synchronized catalogues.

## Validation and limits

Validation: 17 focused Web/i18n tests and 77 PostgreSQL tests pass, including legal/illegal parent chains, leading-zero codes, independent per-level rules and preservation of inactive legacy references. Final tree SSR tests and scoped lint pass. API/Web TypeScript, both production builds and formatting pass. Tests use the dedicated synthetic Accounting database only; no restored operational or production records are modified.

The first concurrent validation exhausted Node's default 2 GiB heap and caused a PostgreSQL regression timeout with dependent failures. Re-running the complete 77-test set separately passed; subsequent type/build checks use a 4 GiB Node heap and run sequentially.

Direct browser acceptance is unavailable: the computer-use connection fails while writing kernel assets. This implementation is compared with the supplied screenshots and tested in code; no live Rahkaran read or visual acceptance is claimed. No production deployment or PR/merge is authorized for this new task. Automatic task-branch commit and normal push follow the owner's standing preference.
