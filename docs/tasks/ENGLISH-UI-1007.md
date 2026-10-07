# ENGLISH-UI-1007 — application display language

PC-A, owner-authorized application-wide English UI and develop integration. No dependency, schema, permission or migration change.

## Display contract

The header and login page select a personal `fa`/`en` display language. The local preference and `nora-display-language` cookie persist an explicit selection; they never modify the company's general settings. English uses left-to-right layout, Latin digits and readable Gregorian dates by default. An explicitly selected Persian calendar retains its calendar semantics with English month names.

The JSX factories at `apps/web/src/i18n` localize fixed visible text and native accessibility attributes using a checked-in offline catalogue. They preserve submitted values, IDs, permission checks, event handlers, refs, concurrency headers and user drafts. Localized Next Image/Link adapters also cover framework-generated accessibility text. Page metadata follows the request cookie. The normal translation path performs no network request and does not mutate React's DOM.

Print HTML, searchable canvas reports and spreadsheet headers use the same display choice. Server Excel exports receive it through `Accept-Language` or the locale cookie. Stored descriptions and unknown names are not guessed or rewritten. Decimal cells, currencies, ISO dates, source enums and authorization scopes remain canonical. The isolated legacy editor has a dedicated reversible DOM/canvas adapter; editable values are left intact and parent messages must originate from the same origin and actual parent window.

## Adding or changing UI text

1. Supply the new fixed Persian text and its reviewed English counterpart in `apps/web/src/i18n/en-catalog.json`. Human terminology corrections belong in `en-overrides.json`.
2. Use the locale adapters for `next/image` and `next/link`, `localizedFetch` for application API requests, and the existing document/export helpers for outputs. Keep wire and persisted values outside translation calls.
3. Run `node apps/web/scripts/i18n-sync.cjs` to regenerate bounded API and standalone editor catalogues entirely offline. `--check` verifies their current state.
4. Run the English coverage/render tests plus affected module tests, lint, typecheck and production builds. Coverage fails for missing fixed labels/errors or empty/Persian translation targets; it also checks the derived catalogues. The existing Web CI test job therefore prevents untranslated additions from passing.

The initial machine translation received only fixed UI labels and visible API/contract texts, with explicit owner approval for both scopes. Source code, credentials and customer data were not transmitted. Translation tools and intermediate source inventories stay outside Git.

## Validation and integration

Validation is in progress. Production compilation, personal-language persistence, English rendering, canonical form values, calendar labels, print HTML escaping and current output tests have passed. Final integrated results and develop PR are recorded in PROJECT_STATUS and WORK_ASSIGNMENTS when complete. No runtime/database deployment is implied by this implementation.
