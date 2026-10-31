# Insurance workspace — Zhenik observation, 2026-10-25

## Evidence and limits

Read-only accessibility inspection of the open Zhenik Windows application,
Insurance Settings child window. No settings, policies, settlements or passenger
records were changed. Native screen capture repeatedly timed out; this inventory
records observed controls, not a verified visual reproduction or hidden behavior.
No production names, identifiers, credentials or configured prices are copied.

## Issuance settings

- Modes: new country settings; edit existing settings.
- Country mapping grid: inactive, country name, country code, plan code,
  insurer country name and English name.
- Plan results: plan code, title, price, age/travel duration.
- Inputs: country mapping, plan title/code, age, duration, inactive toggle.
- Actions: retrieve insurer information; save settings.
- Rate matrix: duration; age bands labelled under12,13–65,66–70,71–75,
  76–80,over80; start/end, plan code/title and registering operator.
- Observed duration bands:0–7,8–15,16–23,24–31,32–45,46–62,63–92,
  six months (93–184), twelve months (185–365).

The reference's under12/13 boundary is ambiguous. Do not silently infer a
provider's underwriting rule from that label; explicit inclusive age bounds and
the insurer's returned quote remain authoritative.

## Policy management and corrections

- Filters: all, issued, missing input, provider/submission error; contract number
  or policy number; all countries or selected country; issue/travel date range.
- Grid: selection, contract number, first/last names, policy number/provider ID,
  birth date, duration, premium, plan, confirmation, settlement, issue date,
  passport/national ID, gender, destination, plan description, travel/return
  dates, cancellation/date, notes, sale, levy, tax, discount, settlement date,
  accounting document, settlement operator/notes, status.
- Actions: view/print, Excel, select all/none, cancel, record settlement.
- Totals: passenger count and payable amount.

No populated policy row was inspected. Correction, cancellation, payment and
printing dialogs were not executed, so their internal validation is unverified.

## Rubi boundaries

Reservations owns each contract/passenger insurance request and issued result.
Integrations owns provider mappings/configuration through the versioned Settings
public service. Master Data remains country/plan/currency owner. Finance remains
payment and settlement owner. Customer identity is read/edited through its public
services and existing permissions.

The reservation passenger column remains empty until an individually confirmed
policy exists. Historical contract-wide insuranceReference must never be
distributed to every passenger. Credentials and a live Noyan adapter are a later
connection milestone; draft preparation must not claim issuance or charge credit.

## Implemented foundation and verification

- Branch settings persist mappings and explicit inclusive age/duration rates through the existing CAS/audit service. Table view groups rates by duration and age; active Master Data currencies are used.
- Management lists branch-authorized contract/passenger requests, supports draft preparation/correction, date/status/country/search filters, revision history and current-page CSV export. Confirmed rows cannot be locally edited as drafts.
- The internal confirmation port validates official provider ID/number, exact premium/currency and issue time, preserves idempotent replay and atomically appends history. It is not an exposed issuance endpoint. Live quote/create/confirm/PDF/cancel and Finance settlement integration require the later provider connection milestone.
- API focused tests:31 passed. Web passenger-column tests:4 passed; System Management tests:7 passed. API/Web typechecks and production builds passed. Browser fixture verified settings/rate matrix rendering and saving an edited plan.
- PostgreSQL proof is added to the hosted database gate; local Docker engine returned HTTP500. No operational DB mutation or live provider call took place.

Browser verification: synthetic settings edit/save and complete draft flow passed; saving closed the dialog, refreshed counts and displayed a blank policy number for the new draft next to the issued fixture. Initial PR1123 head fdbc8e198 passed all four push quality/test/build/PostgreSQL gates, including the new insurance constraint proof. Authorized integration of current develop preserves Financial Workflows schema/exports, other work notes and all translations. Exact merged-head gates still required; source/central/migration locks released for other units once this integration candidate is pushed. No provider call or deployment.
