# PERSIAN-CALENDAR-DIRECTION-1003

PC-A implements the explicit project-wide request: the physical right calendar arrow advances and the left arrow goes back. Weekday headers and day cells flow left-to-right; Persian weeks retain Saturday through Friday, with matching date offsets. Persian labels, digits, date values, calendar conversion, selection and month/year paging remain intact; Gregorian keeps its normal left-to-right direction.

Covered surfaces: shared DatePicker (all consuming forms), Customers custom field, Ticket Catalog picker, Sales flight date range, Marketing campaign calendar, Workbench month/week calendar and HR shift calendar. Navigation and date-grid containers explicitly use LTR so they cannot inherit opposite behavior from RTL forms. Icons now agree with the physical direction and accessible previous/next labels.

Validation includes seven AST navigation/grid regressions, Persian month/year rollover and Saturday-first alignment, existing shared/date-picker/customer/ticket/range/workbench/marketing regressions (59 tests), scoped lint, Web typecheck and production build. No API, schema/migration, dependency, stored-data or runtime change. Authenticated browser QA is not claimed.
