# Flight purchase date range — 2026-11-09

PC-A; codex/pc-a-flight-purchase-date-filter-1109 from develop0a209c797. User requests a date filter beside the search/status controls in the flight-purchase list and develop merge after validation; no deployment.

Add Persian/Gregorian system DatePicker controls for inclusive from/to flight days, either open boundary, and explicit range reset. An inverted range is announced as invalid and yields no results. Use the same flightGroup.departureDate / request.serviceDate source as the displayed flight column, keeping date-only values without timezone shifts. Combine with existing parent filters, search, status and initial offer selection. Refresh retains the chosen local filter; pricing/payment edit scope and summary KPI definitions remain unchanged.

No API/schema/dependency or operational-data changes. Tests cover inclusive/open/exact boundaries, authoritative flight-date precedence, date-only comparison, missing dates and inverted bounds. Full final-head hosted gates precede authorized develop merge.
