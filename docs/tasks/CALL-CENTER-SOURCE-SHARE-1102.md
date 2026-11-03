# Contact-based referral source share — 2026-11-02

COMPUTER_ID=PC-C; CALL-CENTER-SOURCE-SHARE-1102. Source-only implementation; no production deployment.

## Root cause and definition

The report grouped call rows with COUNT(*) per source token. Repeated calls therefore inflated a contact's source contribution. The chart used total calls for the percentage denominator and donut center, repeating the same grain mismatch.

Select one row per authorized branch contact/phone-group using DISTINCT ON(contact_id), ordered by occurredAt descending and ID ascending, from the existing filtered, bounded report call set. Group only those chosen source tokens. A contact with28 matching calls contributes exactly1. If source changes, its latest matching call's source is used; calls outside the chosen time window or access/filter scope cannot change the result. Unique source counts sum to the report contact total. Withheld callers remain separate existing groups; no unproven identity merges.

The chart title becomes `سهم منابع آشنایی`; legend, percentage, donut and accessible summary use contacts. Existing call totals/groups/registration/activity/ranking semantics remain unchanged. Known SMS, Agency and Other source tokens receive their actual labels instead of being folded into the unknown fallback. Existing arbitrary historical tokens retain the fallback.

## Compatibility and validation

The existing sources count changes meaning consistently with its Web consumer; additive sourceBasis metadata documents the rule. No migration, schema, dependency, grant, stored contact/call or recording change. Maintain simultaneous API/Web release when separately authorized; preserve other live overlays and independent draft PRs.

Tests include28 repeated calls counting once, latest source selection within the report window, out-of-window source exclusion, and contact-based100% rendering despite28 calls. Existing source-total regression changes from1025 calls to25 contacts. All16 API report/search checks pass against fresh disposable PostgreSQL18 after the full migration history. Six Web render/i18n checks, scoped lint/format, full API/Web types and production API/Web builds pass. The new synthetic regression is last in its shared fixture suite so it cannot alter unrelated pagination/ranking fixture expectations. All database fixtures are synthetic in a new local disposable container; no ERP-server or production data access.

