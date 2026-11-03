# Remove report summary cards — 2026-11-02

COMPUTER_ID=PC-C; CALL-CENTER-REMOVE-REPORT-KPIS-1102.

Owner explicitly requests removal of the three annotated cards from the registered-data report: registered calls, unique telephone contacts and needs completion. Remove their complete stats wrapper and the two icon imports used only by those cards. Report heading, filters/range, index warning and the three report highlights remain in place. Other Call Center KPIs, source-share calculations and backend report values are unchanged. Existing layout naturally closes the space; no CSS or API change is required.

Source-only, no server publication consistent with preceding requests. No SSH, production configuration, permissions, schema, dependency or operational data change. Prior independent drafts are preserved and not merged into this branch.

Validation: both existing report-highlights checks, scoped lint/format, full Web types and production build pass. The production build uses an isolated same-drive directory to avoid Windows dependency junction resolution across C:/F:. No new implementation-mirroring tests added for this bounded reversible UI removal.

