# SALES-TICKET-THEME-0907

PC-A; base 3046b0b; codex/pc-a-sales-customer-pricing-0907. COMPLETE_LOCAL.

Passenger ticket preview and print now use contract colors #07164b/#173d7a in borders, rules, badges and table headings. Agency logo grows from 140x85 to 205x125 CSS pixels and loads eagerly for print. Recognized demo offers (TEST-AYT-01 through 04 with TEST AIRLINE carrier prefix) show an original code-native Plane badge, sample e-ticket 7143 and RLOC DEMO01. These values appear only with explicit SAMPLE DATA and NOT VALID FOR TRAVEL labels; real, mixed or absent flights keep issuance fields blank. No number is persisted or claimed as issued.

FARE & PAYMENT DETAILS is removed entirely, and NOTICE is renumbered to section 2. Passenger, route, business, directional included transfers and travel notices remain. No API, database, financial, IAM, dependency, real-customer or producer changes.

153 Sales Web tests passed, followed by seven final template/visual-fixture tests. Scoped ESLint, TypeScript and production build (36 routes) passed. Chromium rendered the actual component and CSS with synthetic data; agency image decode, larger logo dimensions, test airline mark, sample numbers and payment removal visually verified. Screenshot stays in ignored apps/web/tmp/flight-theme-preview.png. No authenticated real-customer walkthrough.

Local Web3100 restarted; Web login and API4000 health return 200. Previous build retained at ignored tmp/ticket-theme-web-before-0907. Local commit only; no public push/merge. Scoped template/central-doc reservations released.
