# RESERVATION-FORM-PREVIEW-0910

PC-A, base5fab2eb, branch codex/pc-a-reservation-form-preview-0910.

The fixed210mm reservation sheet overflowed narrow RTL dialogs and clipped its left edge. A measured A4 preview wrapper now scales the visual sheet to available width while preserving an independent native-size print copy. Desktop680px and mobile358px containment checked in Chromium. Voucher preview uses the same fitting wrapper; issuance/branding requirements unchanged.

The print/PDF flow waits for fonts, explicitly loads every page logo eagerly before decoding (lazy off-screen images caused multi-page preparation to hang), names the print job using the contract number, prevents duplicate clicks and restores the page title afterward. Print-only layout resets overflow/margins and never uses preview scaling. Saving remains the browser's Save as PDF destination, explained next to the button; no claim of direct server-side PDF download.

Validation:7 existing document/model tests, scoped lint/typecheck and41-route Web build passed. A browser test captured the actual print portal from TravelDocument and verified it contains no preview wrapper. Synthetic23-passenger output rendered to3 A4 pages; all3 pages visually inspected with Poppler, full title/logo/rows21–23/footer preserved. No actual contract data printed or sent. Synthetic artifacts are ignored under tmp/pdfs.

No API/schema/permissions or workflow changes. Web must be restarted from the user's existing terminal; earlier startup policy block is not bypassed. Local publication hold remains.
