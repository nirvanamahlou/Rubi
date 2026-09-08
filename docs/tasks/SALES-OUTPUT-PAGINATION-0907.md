# SALES-OUTPUT-PAGINATION-0907

PC-A; base 5f4e7bf; codex/pc-a-sales-customer-pricing-0907. COMPLETE_LOCAL.

## Scope

Shared customer print/PDF template only. Passenger table column widths total 100% for person and agency layouts, giving room and foreign amounts sufficient space without forced clipping. Header branding and section badges use less vertical space; B Nazanin, professional blue, English money, all fields, notices and Nystkt.ir are preserved.

All passenger rows render without a display-count ceiling. Larger tables flow to following A4 pages, repeat column headings, keep individual rows unbroken where they fit, and keep the financial summary together. Page counters use explicit LTR direction. There is no forced one-page scale, fixed content height, truncation or hidden overflow. Exceptionally long names/addresses or many currencies can still require additional pages even for six passengers, preserving content rather than shrinking it into unreadability.

No backend, booking capacity/count validation, pricing arithmetic, permission, API, migration, dependency, IAM or producer worktree change. Existing renderer safety/size limits remain. Local-only; no public push or merge.

## Verification

- 150 Sales Web tests pass, including all-row/summed-total checks for 6, 42, 100 and 250 passengers and complete column widths for person/agency output.
- Scoped ESLint and Web typecheck pass.
- Actual embedded-B-Nazanin Chrome PDF output: 5 people = 1 page; 6 people = 1 page; 6-person agency = 1 page; 42 people = 2 pages; 100 people = 3 pages. Fixtures include return flight, hotel, visa, transfer and IRR/USD prices.
- All eight rendered pages visually reviewed using Poppler. pypdf confirms the exact page counts and one complete fare value for every passenger, including all 100 rows; headings, totals, notices and signatures preserved.
- Synthetic QA remains in ignored tmp/pdfs/pagination-0907. No real customer data used or changed.
- Production build passed (36 routes); Web3100 restarted. Login and API4000 health both return 200. Prior build preserved at ignored tmp/pagination-web-before-0907. No authenticated real-contract walkthrough. Scoped template/central-doc reservations released.
