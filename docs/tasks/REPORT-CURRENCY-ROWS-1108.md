# REPORT-CURRENCY-ROWS-1108

Currency is a money component, not a display-row identity. Native sales reports group by canonical owner/route/status IDs and deduplicate contracts before pagination. All currency text uses +; financial amounts remain Decimal strings with separate currency codes. Generic travel facts use the persisted sourceItemId to count an item once across currencies; separate service items retain their existing counting semantics.

Operational producers may optionally supply currencyGroupId and distinctCounts to the internal ReportSource contract. The Reporting consumer combines only explicitly declared identities. Cancellation counts union contract IDs, while registered purchases remain additive independent purchase records. Producers without this metadata keep independent record identities (e.g. separate hotel-rate records must not be summed as if they were a single price). There is no migration or new external API requirement: existing sourceValues and amountsByCurrency fields drive table, XLSX and currency-isolated charts. Source authorization, branch scopes and cancellation eligibility remain in the owning modules.

No FX valuation is introduced. Cross-currency amounts are not a numerical total. Existing scalar compatibility fields retain one currency only and the displayed/exported monetary values use sourceValues. Filtering by a particular currency still restricts the source before grouping. Persisted historical export files are unchanged; newly generated exports use this dataset.

Validation: reporting suite and source/chart/XLSX regressions; clean hosted CI required for full typecheck/build because shared local contracts and Prisma outputs predate current develop. No deployment included.
