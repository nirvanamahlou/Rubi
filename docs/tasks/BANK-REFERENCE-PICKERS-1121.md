# BANK-REFERENCE-PICKERS-1121

In the Accounting bank account form, the bank branch lookup shows branch name, branch code and city. The plus action opens the native branch form with the selected bank as its initial value. Its fields include bank, branch name, second-language name, code, city, SWIFT, public phone, address and website. Saving a branch selects it in the existing account draft. An existing account stays bound to its original bank.

The type lookup includes checkbook availability. Creating or editing a type uses the existing ledger configuration command and its optimistic version. The form supplies the name and checkbook flag. The normal configuration allocator assigns a code when creating a type.

New accounts default to IRR. The currency lookup lists the available currencies and its plus action opens the Rial profile. It reads the canonical currency when it exists and uses its existing display attributes. An authorized user can add the initial Rial definition if the catalogue has no such record. The flow reuses an active IRR and respects inactive status. The exchange unit, minor-unit display and rounding label describe the Rial reference. Currency calculations use the existing accounting rules.

The new migration adds nullable website and SWIFT columns to MasterBankBranch. The existing bank, city, branch and account identifiers remain in use. The change was applied to a disposable database only. This branch continues BANK-DETAIL-TITLE-1121.

Verification passed for 33 API cases, 40 Web cases, the API and Web type checks, scoped lint, Prisma validation and a disposable PostgreSQL migration rehearsal.
