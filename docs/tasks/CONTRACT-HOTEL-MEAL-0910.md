# CONTRACT-HOTEL-MEAL-0910

PC-A; base d7d9e13; branch codex/pc-a-contract-hotel-meal-0910.

The user clarified that the hotel master record is the source of hotel service. Read-only inspection confirmed ROYAL WINGS has UALL, while the five existing contracts omit a separate mealServiceId. The existing hotel response already exposes mealServiceCodes and mealServiceNames, but the queue ignored them.

The queue now consumes those fields in the same existing hotel lookup, requiring no extra requests. Hotel meal codes fill the service column whenever no explicit contract meal selection exists; multiple registered plans remain visible and duplicate codes are removed. Explicit contract selection retains precedence and is never silently replaced after failed lookup. The filtered XLSX uses the same projected value.

Final changes are Reservations Web only. No Sales form changes, API/schema/permissions, real contract writes or snapshot backfill. Local-only publication hold retained. Web needs restart of the user's existing PowerShell process; API unchanged.

Validation:49 Reservations tests passed, covering actual hotel code fallback, multiple plans, explicit contract precedence and matching XLSX output. Scoped ESLint/typecheck and41-route Web production build passed.
