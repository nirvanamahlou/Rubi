# Agency call source — 2026-11-02

COMPUTER_ID=PC-C; CALL-CENTER-AGENCY-SOURCE-1102.

Add `آژانس` to the shared Call Center `sources` list before `سایر`. Every existing shared CallForm popup and source filter consumes this list; values submitted and filtered remain identical. The existing English translation is `Agency`; no catalog generation, API, schema, permissions or layout change is required. The API already accepts bounded source strings.

Source-only change, consistent with the user's preceding no-deployment requests. No SSH, runtime configuration, production deployment or operational data mutation. Live/unmerged SMS and other peer overlays must be retained when integrating a future separately authorized release. Independent draft PRs1314 and1315 are not imported into this branch.

Validation:18 existing Call Center model/form and i18n coverage checks pass, scoped ESLint/format and full Web TypeScript pass. Full Web production build passes in an isolated same-drive copy using existing dependencies to avoid C:/F: junction resolution issues.

