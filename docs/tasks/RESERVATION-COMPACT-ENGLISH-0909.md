# RESERVATION-COMPACT-ENGLISH-0909
PC-A; base 0e8ab21. Reservations Web display only.

Registered hotel attributes.englishName is preferred through the existing public Master Data detail API in queue cards, details, hotel operations, reservation form and voucher. Snapshot names remain unchanged and are used if no English reference is available. Async display ignores stale responses on unmount/hotel change. Voucher printing waits for reference loading.

The shared DatePicker gains an optional defaultCalendarSystem, still Persian by default. Only Reservations queue date filters opt into Gregorian and English month/date labels; users can switch calendars. Queue spacing/padding reduced while preserving the full-card selection button and at least 44px identity target.

Validation: Reservations and existing date picker tests passed; additional default-calendar rendering test protects other consumers. Scoped lint/typecheck and 40-route build passed; Web3100 refreshed with PDF environment preserved. No API, migration, IAM change or real contract writes. Public repository publication remains pending the earlier explicit approval; local commit only.
