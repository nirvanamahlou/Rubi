# CUSTOMER-AFFAIRS-CUSTOMER-PICKER — PC-B

The existing Customers public list/detail adapter is reused by lead creation, ticket creation and record editing. No Customers producer, database, shared contract or permission changes.

- Active records with both customer/passenger roles are available (`role=all`, previously `customer` only).
- Search is debounced, paginated in ten-row server pages and reset to page one on search change. Abort guards prevent obsolete responses from replacing the current result.
- Selection survives page/search changes. Existing linkage remains unchanged if the user does not choose a replacement, including when detail lookup is forbidden or unavailable.
- Edit picker resolves the current customer's display name through public detail. Links open the canonical `/customers?customerId=…` dossier in a new tab without losing the open form.
- Labels use «مشتریان و مسافران»; internal contract/version jargon removed. Unique accessible IDs and busy-state selection guards retained. Nora shared controls preserved under senior-frontend guidance.
- Existing server Customers validation and actor scope remain authoritative. No synthetic records, role grants, automatic customer creation or business writes in this task.

Verification: 43 focused Web tests, scoped lint, standalone typecheck and production build (46 routes) passed. Tests cover public endpoint/role/page/signal propagation, current-reference rendering, selected-name rendering and picker source guards; no browser interaction or live-save verification claimed. Runtime restart was previously blocked and not retried; activation on 3100 remains pending.
