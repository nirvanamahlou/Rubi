# WORKBENCH-035 — Finance and Reservations messenger templates

## Scope

The Workbench messenger now includes the requested editable `خرید` and `پیگیری صورتحساب` templates under Finance and `استعلام از کارگزار` under Reservations. Selecting any of them copies a structured Persian draft into the existing composer, where the user can edit every field and select local attachments.

This is a Workbench presentation change. It does not create a purchase, payment, invoice action, reservation inquiry, document upload or delivered message, and it does not change Finance, Procurement, Reservations, Messaging, API, schema or permissions.

## Validation

All 44 Workbench tests passed. Web lint and TypeScript passed after building the workspace Contracts package, and the production Web build generated all 46 routes. Authenticated browser inspection on the combined Web3100 runtime confirmed both new Finance buttons and the Reservations inquiry button. Selecting `استعلام از کارگزار` inserted its complete 486-character editable text into the composer while the existing attachment control remained available. The earlier feedback activation also remains present on port 3100.
