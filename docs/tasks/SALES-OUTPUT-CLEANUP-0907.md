# SALES-OUTPUT-CLEANUP-0907

- PC-A; local Sales branch, base 8bb1fdf. Scope: template/test, output dialog and task documentation only.
- User-marked notes beneath signatures and template/generated-date footer metadata are removed from both HTML print and direct PDF. Signature spaces, company name/website, amounts, cancelled notice and all other sections remain.
- Operator-only active-company/receipt/reservation/official-archive disclosures move to the dialog outside the printed iframe; authorization and official issuance policy are unchanged.
- Browser-generated localhost/date/page headers are not HTML content and are not controlled by the template. Dialog guidance points to More settings > Headers and footers; direct PDF already uses no-pdf-header-footer. Do not claim browser print preferences were changed.
- Eleven focused print/download tests and scoped lint passed. Actual renderer samples: one-page two-passenger PDF and three-page 42-passenger PDF; all four pages inspected, with marked notes absent and no layout clipping. QA files are synthetic and ignored.
- No database/API/IAM/dependency change, producer modification or public push. Previous local Web retained under tmp/output-cleanup-web-before-0907 for recovery.
- Production TypeScript/build passed (36 static pages plus dynamic PDF route); Web3100 restarted with existing PDF runtime/font configuration. Complete locally; task reservations released.
