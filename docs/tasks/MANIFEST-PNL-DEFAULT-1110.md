# MANIFEST-PNL-DEFAULT-1110

PC-A; owner authorizes develop merge after green checks. No production deployment requested.

## Behavior

Each Reservations MANIFEST ticket row starts on **دیفالت منیفست**. Its independent searchable dropdown also offers **گزارش‌گیری** and every registered active template (all pages). The offer's previously assigned template does not override this new export default. Switching one row preserves other rows and does not update Ticket Catalog definitions.

The default is the owner-supplied Iran Airtour PNL **XLSM**, confirmed for direct airline import. Preserve the original eleven multiline headers, widths, header height, help/lookup sheets and airline VBA project; data starts at row2. Header auto-filter covers all exported rows and the header is frozen. The bundled asset contains zero sample identities. The application copies the airline project but never executes it. Registered/uploaded templates still use the existing macro-stripping XLSX path.

| Column | Canonical value |
| --- | --- |
| NAME | Uppercase Latin passport first name (A–Z and spaces) |
| SURENAME | Uppercase Latin passport surname (airline's original spelling) |
| GENDER | MR / MS |
| PAX type | ADULT / CHILD / INFANT; operational override first, then assignment, then birth date at travel |
| BIRTHDAY | Gregorian yyyy/mm/dd |
| NATIONAL_ID | Iranian passengers on domestic flights only; text preserves leading zeros |
| Nationality | ISO alpha-3 |
| Passport No | Uppercase passport number |
| The Country of passport issuing | ISO alpha-3 issuing country |
| Place of Birth | ISO alpha-3 birth country |
| Date of Expiry | Gregorian yyyy/mm/dd |

Missing or malformed values remain blank with the existing EMPTY CELLS review sheet. Do not invent nationality, issuing country or birth country. Preserve passenger assignment/room ordering and only include passengers assigned to that ticket, with cancellation/branch/date/new-only rules unchanged. Builtin rows can expand for aircraft loads beyond the old 61-row uploaded-template limit.

The previous builtin XLSX is named **گزارش‌گیری**, retains its columns and appends **فروشنده**. Resolve the contract owner's display name using IAM's branch-authorized Reservations responsibility boundary; do not substitute the exporting user or require user administration access.

## Compatibility

Additive optional `builtinTemplate: DEFAULT_MANIFEST | REPORT` on the existing ticket export input. An explicit builtin bypasses assigned/uploaded templates; it cannot be combined with `manifestTemplateId`. Omission preserves the previous API behavior. Registered UUID overrides remain supported. Both backend persisted idempotency scope and browser retry key include the selected builtin. New-only export history remains about contracts/tickets, independent of template.

The existing authenticated POST route stays stable. MIME and Content-Disposition match XLSM/XLSX; the browser uses the returned format for the saved filename. No schema, dependency, record changes, or actual airline submission.

## Validation

Focused API/Web tests cover exact columns and codes, child/infant bands, dates, filters, leading zeros, full aircraft expansion, formula-safe strings, independent dropdowns, custom/builtin switching, seller ownership, idempotency and real HTTP XLSM/XLSX downloads. The generated synthetic workbook is independently reloaded with openpyxl and compared to the supplied headers and original VBA SHA256. Source passenger identities are checked absent from all packaged template parts. Full hosted quality/tests/build/PostgreSQL gates precede merge.
