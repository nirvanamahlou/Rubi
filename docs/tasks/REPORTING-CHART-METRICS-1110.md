# REPORT-CHART-METRICS-1110 — PC-C

## Problem and behavior

Report bars expanded each report row into currency rows, repeating the expert label. The sort selector changed server ordering but the chart still plotted the default amount. The adapter also discarded the producer's chartMeasure metadata.

Horizontal bars now follow the Dashboard comparison layout: stable right-side dimension labels, middle gradient tracks, exact left-side values, bounded scrolling and a currency legend. Each original report grain is one group. Amount/currency pairs are isolated with bidi markup and separated by `+`, matching table components. Multiple currencies have independently scaled colored tracks inside the same group; no cross-currency sum or FX value is invented. Column bars likewise keep one labeled group per original row. Signed bar axes include zero and zero values have no artificial minimum bar.

Selecting a numeric sort column also selects that chart measure. Contract/passenger counts use the original row count once, rather than one copy for each currency. Selecting a name changes ordering and retains the last numeric chart measure; labels remain the original primary/secondary dimensions. Horizontal, column and pie titles/values use the selected measure. Monetary pie charts retain independent currency groups. Operational charts retain the producer's chartMeasure and visible source columns instead of being mislabeled as sales.

No backend query, schema, monetary calculation, table/export content, dashboard source or permissions change. The additive chartMeasure field is only preserved in the existing frontend adapter. Existing saved filter/sort and five-row table behavior remain intact. No server publication is requested.

## Validation

Model regressions cover metric aliases, unique counts, exact long currency values, selected refund amounts, zero operational capacity and source immutability. Rendering regressions cover grouped gradient bars, combined currency labels, stable expert labels and selecting contract/passenger counts in all three chart types. Existing report suites and scoped lint are run; clean hosted quality/build/tests remain the full integration gate.

All92 Web Reports tests and scoped ESLint pass. Full local typecheck is not accepted as a pass: shared older dependencies lack generated workspace contracts and report React JSX type errors in existing pages. No dependency or peer generated output was changed; clean hosted build/typecheck is required.
