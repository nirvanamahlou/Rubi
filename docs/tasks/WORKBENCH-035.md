# WORKBENCH-035 — Finance and Reservations messenger templates

## Scope

The Workbench messenger now includes the requested editable `خرید` and `پیگیری صورتحساب` templates under Finance and `استعلام از کارگزار` under Reservations. Selecting any of them copies a structured Persian draft into the existing composer, where the user can edit every field and select local attachments.

This is a Workbench presentation change. It does not create a purchase, payment, invoice action, reservation inquiry, document upload or delivered message, and it does not change Finance, Procurement, Reservations, Messaging, API, schema or permissions.

## Validation

All 44 Workbench tests passed. Web lint and TypeScript passed after building the workspace Contracts package, and the production Web build generated all 46 routes. Authenticated browser inspection is performed on the combined Workbench runtime so the earlier unmerged feedback activation remains available on port 3100.
