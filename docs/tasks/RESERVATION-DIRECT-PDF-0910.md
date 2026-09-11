# RESERVATION-DIRECT-PDF-0910

PC-A; branch codex/pc-a-reservation-direct-pdf-0910; base7ab38a2.

## Change
Reservation workflow now offers direct PDF download using an authenticated same-origin route. It retrieves saved, permission-scoped workflow/branding and public references. Existing print remains available. Download is independent of Finance approval; Sales delivery gates remain unchanged. Saved hotel meal-code fallback matches the table.

Normalized API error.message is now shown rather than replaced by the generic connection/permission text. Missing operation reason and confirmation reference are validated locally. This does not grant permissions or prove the exact cause of an earlier failed user operation.

## Rendering and authorization
Server owns HTML/CSS, escapes saved values, accepts embedded raster logos only, uses existing Chrome/font configuration and an isolated temporary profile with sanitized environment. API authorization remains authoritative. Responses are private/no-store. Fixed CSS/brand assets are included in output tracing. No schema, dependency, grants, financial approval or supplier messages changed.

## Validation
13 targeted tests passed, scoped ESLint passed, production Web build and TypeScript passed. Actual renderer produced a synthetic23-passenger3-page A4 PDF; all pages checked visually, hotel UALL and passenger23 present. Artifact: ignored tmp/pdfs/reservation-direct.pdf. Live3100 unauthenticated route redirects to login. Actual authenticated contract operations were not executed.

## Handoff
User-started Next dev on3100 retained; frontend source changes reload automatically. Runtime uses SALES_PDF_CHROME_PATH and SALES_PDF_NAZANIN_PATH already provided by Start-Rubi-Live.cmd. No public push or merge; existing public-origin publication hold retained.
