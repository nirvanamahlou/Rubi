# PACKAGE-GENERATOR-THAILAND-XLSX-0928

PC-B fixes Thailand Package Generator imports and poster layout for Phuket, Bangkok+Phuket and Pattaya. The user-provided Pattaya workbook is read-only input for verification and is not checked into Git.

The sample sheet contains raw supplier rates followed by final display rates. The importer must select the final section as a unit, reject incomplete adult display columns, keep unavailable child prices blank, and place hotel, grade/room and four sale prices within the six poster columns. Pattaya's labelled footer amounts and flight details belong in their own cards or text areas rather than the services paragraph.

Scope is limited to the static Package Generator, focused tests and bounded task/status documentation. No shared contract, database, API, migration, dependencies, permissions or operational data change is required.

Verification: the real Pattaya sheet imported 67 hotel rows. The first display row showed DBLE 195.88 as $196, SINGLE 294.52 as $295, CWB 288.65 as $289 and CNB 130.29 as $130; the raw DBL 97 and SGL 194 were absent. A missing final CWB stayed «—». All three Thailand posters kept six table columns with no detected overflow: Pattaya one page, Phuket two and Bangkok+Phuket three. The Pattaya services paragraph retained only the trip services, while ticket and rate increase populated their own cards. Eleven affected tests, static JS syntax, focused lint, Web typecheck and production Web build (53 routes) passed. The source workbook remains outside Git.
